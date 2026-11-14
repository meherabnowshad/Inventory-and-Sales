import { Injectable, UnauthorizedException, BadRequestException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { verify } from '@node-rs/argon2';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { TemporarilyLockedException } from './exceptions/temporarily-locked.exception';

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
  accessToken: string;
  refreshToken: string;
  token: string; // Alias for accessToken for backward compatibility
}

export interface RefreshResponse {
  user: AuthUserResponse;
  accessToken: string;
  refreshToken: string;
  token: string;
}

export interface JwtPayload {
  sub: number;
  name: string;
  username: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

/** Access token lifetime: 15 minutes (FR-AUTH-03, NFR-SEC-05) */
export const ACCESS_TOKEN_TTL_SEC = 15 * 60;

/** Refresh token lifetime: 8 hours / one work shift (FR-AUTH-03, NFR-SEC-05) */
export const REFRESH_TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

/** Failed-login throttle constants (FR-AUTH-05, IMS-05.4) */
export const MAX_FAILED_LOGINS = 5;
export const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
export const LOCK_DURATION_MS = 15 * 60 * 1000;

const DEFAULT_JWT_SECRET = 'super_secret_jwt_dev_key_change_in_production_32chars';

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly configService?: ConfigService,
  ) {
    this.jwtSecret =
      this.configService?.get<string>('JWT_SECRET') || process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
  }

  /**
   * IMS-05.1 & IMS-05.3: Login endpoint
   * Validates Argon2id password hash, issues 15-min JWT access token + 8-hr rotating refresh token,
   * and persists the refresh token hash in PostgreSQL (FR-AUTH-01, FR-AUTH-03, FR-AUTH-04, NFR-SEC-05).
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

    const now = new Date();

    // FR-AUTH-05: Block login (even with right password) while account is temporarily locked
    if (user && user.lockedUntil && user.lockedUntil > now) {
      const retryAfterSeconds = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 1000);
      throw new TemporarilyLockedException(retryAfterSeconds);
    }

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
      if (user && user.isActive) {
        await this.recordFailedLoginAttempt(user, now);
      }
      throw new UnauthorizedException('Invalid username or password');
    }

    // IMS-02.4 point 4: Reset all three throttle columns on a successful login
    if ((user.failedLogins ?? 0) > 0 || user.firstFailedAt != null || user.lockedUntil != null) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLogins: 0,
          firstFailedAt: null,
          lockedUntil: null,
        },
      });
    }

    const authUser: AuthUserResponse = {
      id: Number(user.id),
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role.name,
    };

    // Issue tokens (IMS-05.3, FR-AUTH-03, NFR-SEC-05)
    const accessToken = this.signAccessToken(authUser, ACCESS_TOKEN_TTL_SEC);
    const refreshToken = this.generateRefreshToken(user.username);
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    return {
      user: authUser,
      accessToken,
      refreshToken,
      token: accessToken,
    };
  }

  /**
   * IMS-05.3: Session refresh with token rotation (FR-AUTH-03, NFR-SEC-05)
   * Validates the refresh token against PostgreSQL, checks expiration,
   * revokes the old refresh token, and issues a new pair of access & refresh tokens.
   */
  async refreshSession(rawRefreshToken: string): Promise<RefreshResponse> {
    const refreshToken = this.cleanToken(rawRefreshToken);

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const tokenHash = this.hashToken(refreshToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: { role: true },
        },
      },
    });

    if (!record) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // FR-AUTH-02: Revoked tokens cannot be reused
    if (record.revokedAt !== null) {
      throw new UnauthorizedException('Refresh token has already been revoked');
    }

    // FR-AUTH-03: Expiry check (8 hours)
    if (record.expiresAt <= new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Check user active status
    if (!record.user || !record.user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    const authUser: AuthUserResponse = {
      id: Number(record.user.id),
      name: record.user.name,
      username: record.user.username,
      email: record.user.email,
      role: record.user.role.name,
    };

    // ROTATION (NFR-SEC-05): Revoke old refresh token row
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    // Issue new pair of tokens
    const newAccessToken = this.signAccessToken(authUser, ACCESS_TOKEN_TTL_SEC);
    const newRefreshToken = this.generateRefreshToken(record.user.username);
    const newTokenHash = this.hashToken(newRefreshToken);
    const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await this.prisma.refreshToken.create({
      data: {
        userId: record.user.id,
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
      },
    });

    return {
      user: authUser,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      token: newAccessToken,
    };
  }

  /**
   * IMS-05.2: Logout and token revocation (FR-AUTH-02)
   * Revokes the refresh token so subsequent requests with the old token fail with HTTP 401.
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

    if (record) {
      if (record.revokedAt !== null) {
        throw new UnauthorizedException('Token has already been revoked');
      }
      if (record.expiresAt <= new Date()) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      await this.prisma.refreshToken.update({
        where: { id: record.id },
        data: { revokedAt: new Date() },
      });
      return;
    }

    // If it's a JWT access token, extract userId and revoke all active refresh tokens for that session
    if (token.split('.').length === 3) {
      try {
        const payload = this.verifyJwtToken(token, false); // allow expired check during logout
        const userTokens = await this.prisma.refreshToken.findMany({
          where: {
            userId: BigInt(payload.sub),
            revokedAt: null,
          },
        });

        if (userTokens.length === 0) {
          throw new UnauthorizedException('Token has already been revoked');
        }

        await this.prisma.refreshToken.updateMany({
          where: {
            userId: BigInt(payload.sub),
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
        return;
      } catch (err: unknown) {
        if (err instanceof UnauthorizedException) throw err;
        throw new UnauthorizedException('Invalid or expired token');
      }
    }

    throw new UnauthorizedException('Invalid or expired token');
  }

  /**
   * Validates token authenticity and expiration (FR-AUTH-02, FR-AUTH-03).
   * Supports both standard 15-min JWT access tokens and database-backed session tokens.
   * Throws HTTP 401 if token is expired, invalid, or revoked.
   */
  async validateToken(rawToken: string): Promise<AuthUserResponse> {
    const token = this.cleanToken(rawToken);

    if (!token) {
      throw new UnauthorizedException('Authentication token is required');
    }

    // 1. Check if token is a standard JWT access token (3 segments)
    if (token.split('.').length === 3) {
      const payload = this.verifyJwtToken(token, true);

      // Verify user in PostgreSQL to ensure account is still active (FR-USR-03, NFR-SEC-05)
      const user = await this.prisma.user.findUnique({
        where: { id: BigInt(payload.sub) },
        include: { role: true },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      return {
        id: Number(user.id),
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role.name,
      };
    }

    // 2. Check if token is stored in refresh_tokens table
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

    if (record.revokedAt !== null) {
      throw new UnauthorizedException('Token has been revoked');
    }

    if (record.expiresAt <= new Date() || !record.user || !record.user.isActive) {
      throw new UnauthorizedException('Token has expired');
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
   * Check if a token is explicitly marked as revoked in PostgreSQL
   */
  async isTokenRevoked(rawToken: string): Promise<boolean> {
    const token = this.cleanToken(rawToken);
    if (!token) return false;

    const tokenHash = this.hashToken(token);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (record) {
      return record.revokedAt !== null;
    }

    if (token.split('.').length === 3) {
      try {
        const payload = this.verifyJwtToken(token, false);
        const activeCount = await this.prisma.refreshToken.count({
          where: {
            userId: BigInt(payload.sub),
            revokedAt: null,
          },
        });
        return activeCount === 0;
      } catch {
        return true;
      }
    }

    return false;
  }

  /**
   * Issues an RFC 7519 HS256 JWT access token (15-min TTL)
   */
  signAccessToken(user: AuthUserResponse, expiresInSec: number = ACCESS_TOKEN_TTL_SEC): string {
    const nowSec = Math.floor(Date.now() / 1000);
    const payload: JwtPayload = {
      sub: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      iat: nowSec,
      exp: nowSec + expiresInSec,
    };

    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.jwtSecret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Verifies an HS256 JWT signature and optional expiration
   */
  verifyJwtToken(token: string, checkExpiry: boolean = true): JwtPayload {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Invalid token format');
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const expectedSig = createHmac('sha256', this.jwtSecret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      throw new UnauthorizedException('Invalid token signature');
    }

    let payload: JwtPayload;
    try {
      payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Invalid token payload');
    }

    if (checkExpiry) {
      const nowSec = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp <= nowSec) {
        throw new UnauthorizedException('Token has expired');
      }
    }

    return payload;
  }

  /**
   * Generates a cryptographically random refresh token
   */
  generateRefreshToken(username: string): string {
    return `smartmart_refresh_${username}_${randomUUID()}`;
  }

  /**
   * Computes a 64-character hex SHA-256 hash for database indexing (CHAR(64))
   */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Strip optional "Bearer " prefix and whitespace
   */
  cleanToken(rawToken: string): string {
    if (!rawToken) return '';
    return rawToken.replace(/^Bearer\s+/i, '').trim();
  }

  /**
   * IMS-05.4 (FR-AUTH-05): Records a failed login attempt inside a 15-minute window.
   * Resets the window if 15 minutes have elapsed since `firstFailedAt` or a prior lock expired.
   * Locks the account for 15 minutes once `failedLogins` reaches `MAX_FAILED_LOGINS` (5).
   */
  private async recordFailedLoginAttempt(
    user: {
      id: bigint;
      failedLogins: number;
      firstFailedAt: Date | null;
      lockedUntil: Date | null;
    },
    now: Date,
  ): Promise<void> {
    const windowExpired =
      !user.firstFailedAt || now.getTime() - user.firstFailedAt.getTime() >= THROTTLE_WINDOW_MS;
    const priorLockExpired = user.lockedUntil != null && user.lockedUntil <= now;

    const nextFailedLogins = windowExpired || priorLockExpired ? 1 : (user.failedLogins ?? 0) + 1;
    const nextFirstFailedAt = windowExpired || priorLockExpired ? now : user.firstFailedAt;
    const nextLockedUntil =
      nextFailedLogins >= MAX_FAILED_LOGINS ? new Date(now.getTime() + LOCK_DURATION_MS) : null;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLogins: nextFailedLogins,
        firstFailedAt: nextFirstFailedAt,
        lockedUntil: nextLockedUntil,
      },
    });
  }
}
