import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { verify } from '@node-rs/argon2';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

// Precomputed dummy Argon2id hash to mitigate timing-based username enumeration
const DUMMY_ARGON2_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$K17no/In680t+qyuEiWhag$b/X4AzL+Nmg4DZrKXArBf7pKv/OAXi1lgLQhLZvpxl8';

export interface AuthUserResponse {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
}

export interface LoginResponse {
  user: AuthUserResponse;
  token: string;
}

/** 8 hours (one shift) per SRS Engineering Spec v0.3 (NFR-SEC-05, Q17) */
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * IMS-05.1: Login endpoint with hashed password check (FR-AUTH-01, FR-AUTH-04)
   * Validates username or email against PostgreSQL users, verifies Argon2id password hash,
   * and stores the SHA-256 token hash in the PostgreSQL `refresh_tokens` table.
   */
  async validateAndLogin(dto: LoginDto): Promise<LoginResponse> {
    const identifier = dto.getIdentifier();

    if (!identifier) {
      throw new BadRequestException('Username or email is required');
    }

    // Lookup user by case-insensitive username OR email
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: identifier, mode: 'insensitive' } },
          { email: { equals: identifier, mode: 'insensitive' } },
        ],
      },
      include: {
        role: true,
      },
    });

    // Timing attack mitigation: always execute Argon2id verification even if user is missing/inactive
    const hashToVerify = user?.passwordHash || DUMMY_ARGON2_HASH;
    let isPasswordValid = false;
    try {
      isPasswordValid = await verify(hashToVerify, dto.password);
    } catch {
      isPasswordValid = false;
    }

    // FR-AUTH-01: Wrong login shows one generic error that names no field (prevents username enumeration)
    if (!user || !user.isActive || !isPasswordValid) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const authUser: AuthUserResponse = {
      id: Number(user.id),
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role.name,
    };

    // Generate unique session token and persist its SHA-256 hash in refresh_tokens (NFR-SEC-05)
    const token = `smartmart_auth_${user.username}_${randomUUID()}`;
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    return {
      user: authUser,
      token,
    };
  }

  /**
   * IMS-05.2: Logout and token revocation (FR-AUTH-02)
   * Marks `revoked_at` in `refresh_tokens` so subsequent requests with the old token fail with HTTP 401.
   */
  async revokeToken(rawToken: string): Promise<void> {
    const token = this.cleanToken(rawToken);

    if (!token) {
      throw new UnauthorizedException('Token is required for logout');
    }

    const tokenHash = this.hashToken(token);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    // If not found in database, reject with 401
    if (!record) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // If already revoked, reject with 401
    if (record.revokedAt !== null) {
      throw new UnauthorizedException('Token has already been revoked');
    }

    // If expired, reject with 401
    if (record.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Validates token authenticity, expiry, user active state, and revocation status in PostgreSQL.
   * Throws HTTP 401 if token is revoked, invalid, or expired.
   */
  async validateToken(rawToken: string): Promise<AuthUserResponse> {
    const token = this.cleanToken(rawToken);

    if (!token) {
      throw new UnauthorizedException('Authentication token is required');
    }

    const tokenHash = this.hashToken(token);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: { role: true },
        },
      },
    });

    if (!record) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // FR-AUTH-02 Done-when: Old token gets 401
    if (record.revokedAt !== null) {
      throw new UnauthorizedException('Token has been revoked');
    }

    // FR-AUTH-03 & NFR-SEC-05: Expired token or deactivated user gets 401
    if (record.expiresAt <= new Date() || !record.user || !record.user.isActive) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return {
      id: Number(record.user.id),
      name: record.user.name,
      username: record.user.username,
      email: record.user.email,
      role: record.user.role.name,
    };
  }

  /**
   * Check if a token is explicitly marked as revoked in the database
   */
  async isTokenRevoked(rawToken: string): Promise<boolean> {
    const token = this.cleanToken(rawToken);
    if (!token) return false;

    const tokenHash = this.hashToken(token);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    return Boolean(record && record.revokedAt !== null);
  }

  /**
   * Computes a 64-character hex SHA-256 hash of a token for `refresh_tokens.token_hash` (CHAR(64))
   */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Strip optional "Bearer " prefix and whitespace
   */
  private cleanToken(rawToken: string): string {
    if (!rawToken) return '';
    return rawToken.replace(/^Bearer\s+/i, '').trim();
  }
}
