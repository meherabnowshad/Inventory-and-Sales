import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { verify } from '@node-rs/argon2';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

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

@Injectable()
export class AuthService {
  // In-memory token stores for session lifecycle & revocation (FR-AUTH-02)
  private readonly activeTokens = new Map<string, AuthUserResponse>();
  private readonly revokedTokens = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * IMS-05.1: Login endpoint with hashed password check (FR-AUTH-01, FR-AUTH-04)
   * Validates username or email against PostgreSQL users and verifies Argon2id password hash.
   * On any failure (user not found, wrong password, or inactive), returns a generic error.
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

    // FR-AUTH-01: Wrong login shows one generic error that names no field
    // (Protects against account enumeration)
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid username or password');
    }

    // FR-AUTH-04: Argon2id password hash verification
    const isPasswordValid = await verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const authUser: AuthUserResponse = {
      id: Number(user.id),
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role.name,
    };

    // Generate unique session token and track as active
    const token = `smartmart_auth_${user.username}_${randomUUID()}`;
    this.activeTokens.set(token, authUser);

    return {
      user: authUser,
      token,
    };
  }

  /**
   * IMS-05.2: Logout and token revocation (FR-AUTH-02)
   * Revokes the active token so subsequent requests with the old token fail with HTTP 401.
   */
  revokeToken(rawToken: string): void {
    const token = this.cleanToken(rawToken);

    if (!token) {
      throw new UnauthorizedException('Token is required for logout');
    }

    // If already revoked, reject with 401
    if (this.revokedTokens.has(token)) {
      throw new UnauthorizedException('Token has already been revoked');
    }

    // If not found in active tokens, reject with 401
    if (!this.activeTokens.has(token)) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Revoke token
    this.activeTokens.delete(token);
    this.revokedTokens.add(token);
  }

  /**
   * Validates token authenticity and revocation status.
   * Throws HTTP 401 if token is revoked, invalid, or expired.
   */
  validateToken(rawToken: string): AuthUserResponse {
    const token = this.cleanToken(rawToken);

    if (!token) {
      throw new UnauthorizedException('Authentication token is required');
    }

    // FR-AUTH-02 Done-when: Old token gets 401
    if (this.revokedTokens.has(token)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const user = this.activeTokens.get(token);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return user;
  }

  /**
   * Check if a token is explicitly in the revoked list
   */
  isTokenRevoked(rawToken: string): boolean {
    const token = this.cleanToken(rawToken);
    return this.revokedTokens.has(token);
  }

  /**
   * Strip optional "Bearer " prefix and whitespace
   */
  private cleanToken(rawToken: string): string {
    if (!rawToken) return '';
    return rawToken.replace(/^Bearer\s+/i, '').trim();
  }
}
