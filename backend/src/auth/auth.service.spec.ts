import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Algorithm, hash } from '@node-rs/argon2';
import {
  AuthService,
  ACCESS_TOKEN_TTL_SEC,
  MAX_FAILED_LOGINS,
  THROTTLE_WINDOW_MS,
} from './auth.service';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from '../prisma/prisma.service';
import { TemporarilyLockedException } from './exceptions/temporarily-locked.exception';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_minimum_32_characters_long';

interface MockRefreshTokenRow {
  id: bigint;
  userId: bigint;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

describe('AuthService (IMS-05.1, IMS-05.2, IMS-05.3, IMS-05.4 | FR-AUTH-01 to FR-AUTH-05)', () => {
  let authService: AuthService;
  let sampleArgonHash: string;
  let storedTokens: Map<string, MockRefreshTokenRow>;
  let nextTokenId: bigint;

  const mockUser: {
    id: bigint;
    name: string;
    username: string;
    email: string;
    passwordHash: string;
    roleId: number;
    isActive: boolean;
    failedLogins: number;
    firstFailedAt: Date | null;
    lockedUntil: Date | null;
    role: { id: number; name: string };
  } = {
    id: BigInt(1),
    name: 'Sadia Rahman',
    username: 'sadia',
    email: 'sadia@smartmart.local',
    passwordHash: '',
    roleId: 1,
    isActive: true,
    failedLogins: 0,
    firstFailedAt: null,
    lockedUntil: null,
    role: { id: 1, name: 'Administrator' },
  };

  const mockPrisma = {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'unit_test_jwt_secret_key_32_characters_long';
    storedTokens = new Map();
    nextTokenId = BigInt(1);
    sampleArgonHash = await hash('Smart@1234', { algorithm: Algorithm.Argon2id });
    mockUser.passwordHash = sampleArgonHash;
    mockUser.isActive = true;
    mockUser.failedLogins = 0;
    mockUser.firstFailedAt = null;
    mockUser.lockedUntil = null;

    mockPrisma.user.findFirst.mockResolvedValue(mockUser);
    mockPrisma.user.findUnique.mockImplementation(async ({ where }: { where: { id: bigint } }) => {
      if (where.id === mockUser.id) return mockUser;
      return null;
    });
    mockPrisma.user.update.mockImplementation(
      async ({
        data,
      }: {
        where: { id: bigint };
        data: Partial<{
          failedLogins: number;
          firstFailedAt: Date | null;
          lockedUntil: Date | null;
        }>;
      }) => {
        Object.assign(mockUser, data);
        return mockUser;
      },
    );

    mockPrisma.refreshToken.create.mockImplementation(
      async ({ data }: { data: { userId: bigint; tokenHash: string; expiresAt: Date } }) => {
        const row: MockRefreshTokenRow = {
          id: nextTokenId++,
          userId: data.userId,
          tokenHash: data.tokenHash,
          expiresAt: data.expiresAt,
          revokedAt: null,
        };
        storedTokens.set(data.tokenHash, row);
        return row;
      },
    );

    mockPrisma.refreshToken.findUnique.mockImplementation(
      async ({
        where,
        include,
      }: {
        where: { tokenHash?: string; id?: bigint };
        include?: { user?: unknown };
      }) => {
        let row: MockRefreshTokenRow | undefined;
        if (where.tokenHash) {
          row = storedTokens.get(where.tokenHash);
        } else if (where.id !== undefined) {
          for (const r of storedTokens.values()) {
            if (r.id === where.id) {
              row = r;
              break;
            }
          }
        }
        if (!row) return null;
        if (include?.user) {
          return { ...row, user: mockUser };
        }
        return row;
      },
    );

    mockPrisma.refreshToken.findMany.mockImplementation(
      async ({ where }: { where: { userId: bigint; revokedAt: null } }) => {
        const matches: MockRefreshTokenRow[] = [];
        for (const row of storedTokens.values()) {
          if (row.userId === where.userId && row.revokedAt === null) {
            matches.push(row);
          }
        }
        return matches;
      },
    );

    mockPrisma.refreshToken.update.mockImplementation(
      async ({ where, data }: { where: { id: bigint }; data: { revokedAt: Date } }) => {
        for (const [tokenHash, row] of storedTokens.entries()) {
          if (row.id === where.id) {
            const updated = { ...row, revokedAt: data.revokedAt };
            storedTokens.set(tokenHash, updated);
            return updated;
          }
        }
        return null;
      },
    );

    mockPrisma.refreshToken.updateMany.mockImplementation(
      async ({
        where,
        data,
      }: {
        where: { userId?: bigint; id?: bigint; revokedAt: null };
        data: { revokedAt: Date };
      }) => {
        let count = 0;
        for (const [tokenHash, row] of storedTokens.entries()) {
          if (row.revokedAt === null) {
            if (
              (where.userId !== undefined && row.userId === where.userId) ||
              (where.id !== undefined && row.id === where.id)
            ) {
              storedTokens.set(tokenHash, { ...row, revokedAt: data.revokedAt });
              count++;
            }
          }
        }
        return { count };
      },
    );

    mockPrisma.refreshToken.count.mockImplementation(
      async ({ where }: { where: { userId: bigint; revokedAt: null } }) => {
        let count = 0;
        for (const row of storedTokens.values()) {
          if (row.userId === where.userId && row.revokedAt === null) count++;
        }
        return count;
      },
    );

    authService = new AuthService(mockPrisma as unknown as PrismaService);
  });

  describe('JWT Startup Configuration (NFR-SEC-03)', () => {
    it('fails at startup when JWT_SECRET is missing', () => {
      const orig = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      try {
        expect(() => new AuthService(mockPrisma as unknown as PrismaService)).toThrow(
          'JWT_SECRET environment variable is required (NFR-SEC-03)',
        );
      } finally {
        process.env.JWT_SECRET = orig;
      }
    });
  });

  describe('IMS-05.1: Login & Password Hash Verification (FR-AUTH-01, FR-AUTH-04)', () => {
    it('successfully authenticates with valid username, verifies Argon2id hash, and returns token pair', async () => {
      const dto = new LoginDto();
      dto.usernameOrEmail = 'sadia';
      dto.password = 'Smart@1234';

      const result = await authService.validateAndLogin(dto);

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { username: { equals: 'sadia', mode: 'insensitive' } },
            { email: { equals: 'sadia', mode: 'insensitive' } },
          ],
        },
        include: { role: true },
      });

      expect(result.user).toEqual({
        id: 1,
        name: 'Sadia Rahman',
        username: 'sadia',
        email: 'sadia@smartmart.local',
        role: 'Administrator',
      });
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.token).toBe(result.accessToken);

      // Verify SHA-256 hash was persisted in refresh_tokens table
      const expectedHash = authService.hashToken(result.refreshToken);
      expect(expectedHash).toHaveLength(64);
      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: BigInt(1),
            tokenHash: expectedHash,
            expiresAt: expect.any(Date),
          }),
        }),
      );
    });

    it('successfully authenticates with email identifier (case-insensitive)', async () => {
      const dto = new LoginDto();
      dto.usernameOrEmail = 'SADIA@SMARTMART.LOCAL';
      dto.password = 'Smart@1234';

      const result = await authService.validateAndLogin(dto);

      expect(result.user.username).toBe('sadia');
      expect(result.user.role).toBe('Administrator');
    });

    it('rejects wrong password with HTTP 401 and generic error (FR-AUTH-01 / FR-AUTH-04)', async () => {
      const dto = new LoginDto();
      dto.usernameOrEmail = 'sadia';
      dto.password = 'WrongPassword999';

      await expect(authService.validateAndLogin(dto)).rejects.toThrow(UnauthorizedException);
      await expect(authService.validateAndLogin(dto)).rejects.toThrow(
        'Invalid username or password',
      );
      expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('rejects unknown username with identical generic error to prevent enumeration (FR-AUTH-01)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const dto = new LoginDto();
      dto.usernameOrEmail = 'non_existent_user';
      dto.password = 'Smart@1234';

      await expect(authService.validateAndLogin(dto)).rejects.toThrow(UnauthorizedException);
      await expect(authService.validateAndLogin(dto)).rejects.toThrow(
        'Invalid username or password',
      );
    });

    it('rejects deactivated user accounts with generic 401 error', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      const dto = new LoginDto();
      dto.usernameOrEmail = 'sadia';
      dto.password = 'Smart@1234';

      await expect(authService.validateAndLogin(dto)).rejects.toThrow(UnauthorizedException);
      await expect(authService.validateAndLogin(dto)).rejects.toThrow(
        'Invalid username or password',
      );
    });

    it('throws BadRequestException if identifier is empty', async () => {
      const dto = new LoginDto();
      dto.usernameOrEmail = '';
      dto.password = 'Smart@1234';

      await expect(authService.validateAndLogin(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('IMS-05.3: Access and Refresh Tokens with Expiry (FR-AUTH-03, NFR-SEC-05)', () => {
    it('generates a 15-minute JWT access token that validates successfully while active', async () => {
      const dto = new LoginDto();
      dto.usernameOrEmail = 'sadia';
      dto.password = 'Smart@1234';

      const { accessToken } = await authService.validateAndLogin(dto);
      const payload = authService.verifyJwtToken(accessToken, true);

      expect(payload.sub).toBe(1);
      expect(payload.username).toBe('sadia');
      expect(payload.role).toBe('Administrator');
      expect(payload.exp - payload.iat).toBe(ACCESS_TOKEN_TTL_SEC);

      const profile = await authService.validateToken(accessToken);
      expect(profile.username).toBe('sadia');
    });

    it('rejects an expired access token (>15 minutes) with HTTP 401 (Done when: Expired token 401)', async () => {
      // Create an expired access token (expired 10 seconds ago)
      const user = {
        id: 1,
        name: 'Sadia Rahman',
        username: 'sadia',
        email: 'sadia@smartmart.local',
        role: 'Administrator',
      };
      const expiredJwt = authService.signAccessToken(user, -10);

      await expect(authService.validateToken(expiredJwt)).rejects.toThrow(UnauthorizedException);
      await expect(authService.validateToken(expiredJwt)).rejects.toThrow('Token has expired');
    });

    it('rejects a tampered JWT signature with HTTP 401', async () => {
      const user = {
        id: 1,
        name: 'Sadia Rahman',
        username: 'sadia',
        email: 'sadia@smartmart.local',
        role: 'Administrator',
      };
      const validJwt = authService.signAccessToken(user, ACCESS_TOKEN_TTL_SEC);
      const parts = validJwt.split('.');
      const tamperedJwt = `${parts[0]}.${parts[1]}.tampered_sig_12345`;

      await expect(authService.validateToken(tamperedJwt)).rejects.toThrow(UnauthorizedException);
      await expect(authService.validateToken(tamperedJwt)).rejects.toThrow(
        'Invalid token signature',
      );
    });

    it('renews session with a valid refresh token and rotates it (Done when: refresh works)', async () => {
      const dto = new LoginDto();
      dto.usernameOrEmail = 'sadia';
      dto.password = 'Smart@1234';

      const loginRes = await authService.validateAndLogin(dto);
      const oldRefreshToken = loginRes.refreshToken;

      // Call refresh endpoint
      const refreshRes = await authService.refreshSession(oldRefreshToken);

      expect(refreshRes.accessToken).toBeDefined();
      expect(refreshRes.refreshToken).toBeDefined();
      expect(refreshRes.refreshToken).not.toBe(oldRefreshToken);
      expect(refreshRes.user.username).toBe('sadia');

      // The new access token should be valid
      const newProfile = await authService.validateToken(refreshRes.accessToken);
      expect(newProfile.username).toBe('sadia');

      // CRITICAL: The old refresh token MUST be revoked (rotation)
      const oldHash = authService.hashToken(oldRefreshToken);
      const oldRecord = storedTokens.get(oldHash);
      expect(oldRecord?.revokedAt).not.toBeNull();

      // Subsequent attempt with the already-used/rotated refresh token fails with 401
      await expect(authService.refreshSession(oldRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(authService.refreshSession(oldRefreshToken)).rejects.toThrow(
        'Refresh token has already been revoked',
      );
    });

    it('rejects an expired refresh token (>8 hours) with HTTP 401', async () => {
      const dto = new LoginDto();
      dto.usernameOrEmail = 'sadia';
      dto.password = 'Smart@1234';

      const { refreshToken } = await authService.validateAndLogin(dto);
      const tokenHash = authService.hashToken(refreshToken);

      // Artificially expire the refresh token
      const row = storedTokens.get(tokenHash)!;
      storedTokens.set(tokenHash, {
        ...row,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(authService.refreshSession(refreshToken)).rejects.toThrow(UnauthorizedException);
      await expect(authService.refreshSession(refreshToken)).rejects.toThrow(
        'Refresh token has expired',
      );
    });

    it('rejects refresh when the user account has been deactivated', async () => {
      const dto = new LoginDto();
      dto.usernameOrEmail = 'sadia';
      dto.password = 'Smart@1234';

      const { refreshToken } = await authService.validateAndLogin(dto);

      // Deactivate user
      mockUser.isActive = false;

      await expect(authService.refreshSession(refreshToken)).rejects.toThrow(UnauthorizedException);
      await expect(authService.refreshSession(refreshToken)).rejects.toThrow(
        'Invalid or expired refresh token',
      );
    });
  });

  describe('IMS-05.2: Logout and Token Revocation (FR-AUTH-02)', () => {
    it('revokes refresh token upon logout', async () => {
      const dto = new LoginDto();
      dto.usernameOrEmail = 'sadia';
      dto.password = 'Smart@1234';

      const { refreshToken } = await authService.validateAndLogin(dto);
      expect(await authService.isTokenRevoked(refreshToken)).toBe(false);

      // Logout with refresh token
      await authService.revokeToken(refreshToken);
      expect(await authService.isTokenRevoked(refreshToken)).toBe(true);

      // Subsequent refresh attempt fails with 401
      await expect(authService.refreshSession(refreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('revokes user active session when logging out with access token and invalidates access token (FR-AUTH-02)', async () => {
      const dto = new LoginDto();
      dto.usernameOrEmail = 'sadia';
      dto.password = 'Smart@1234';

      const { accessToken, refreshToken } = await authService.validateAndLogin(dto);

      // Before logout, access token is valid
      const profile = await authService.validateToken(accessToken);
      expect(profile.username).toBe('sadia');

      // Logout with access token
      await authService.revokeToken(accessToken);

      // Both refresh token and access token must now be revoked (FR-AUTH-02 done-when: old token gets 401)
      expect(await authService.isTokenRevoked(refreshToken)).toBe(true);
      await expect(authService.validateToken(accessToken)).rejects.toThrow(UnauthorizedException);
      await expect(authService.validateToken(accessToken)).rejects.toThrow(
        'Token has been revoked',
      );

      await expect(authService.refreshSession(refreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects repeated logout attempts with 401', async () => {
      const dto = new LoginDto();
      dto.usernameOrEmail = 'sadia';
      dto.password = 'Smart@1234';

      const { refreshToken } = await authService.validateAndLogin(dto);
      await authService.revokeToken(refreshToken);

      await expect(authService.revokeToken(refreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects empty or missing token with 401', async () => {
      await expect(authService.validateToken('')).rejects.toThrow(UnauthorizedException);
      await expect(authService.revokeToken('')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('IMS-05.4: Failed-login throttling (FR-AUTH-05 - Done when: Sixth try in 15 min is blocked)', () => {
    it('blocks the 6th login attempt with HTTP 429 TEMPORARILY_LOCKED even with the right password', async () => {
      const wrongDto = new LoginDto();
      wrongDto.usernameOrEmail = 'sadia';
      wrongDto.password = 'WrongPassword999';

      // First 5 failures within 15 minutes return generic 401
      for (let i = 1; i <= MAX_FAILED_LOGINS; i++) {
        await expect(authService.validateAndLogin(wrongDto)).rejects.toThrow(UnauthorizedException);
        expect(mockUser.failedLogins).toBe(i);
      }

      // 5th failure sets lockedUntil ~15 minutes ahead
      expect(mockUser.lockedUntil).toBeInstanceOf(Date);
      expect(mockUser.firstFailedAt).toBeInstanceOf(Date);

      // 6th attempt with the RIGHT password must be blocked with 429 TEMPORARILY_LOCKED
      const rightDto = new LoginDto();
      rightDto.usernameOrEmail = 'sadia';
      rightDto.password = 'Smart@1234';

      try {
        await authService.validateAndLogin(rightDto);
        expect.fail('Expected 6th attempt to throw TemporarilyLockedException');
      } catch (err) {
        expect(err).toBeInstanceOf(TemporarilyLockedException);
        const lockedErr = err as TemporarilyLockedException;
        expect(lockedErr.getStatus()).toBe(429);
        expect(lockedErr.retryAfter).toBeGreaterThan(890);
        expect(lockedErr.retryAfter).toBeLessThanOrEqual(900);
        expect(lockedErr.getResponse()).toMatchObject({
          status: 429,
          code: 'TEMPORARILY_LOCKED',
        });
      }
    });

    it('resets failedLogins, firstFailedAt, and lockedUntil upon successful login', async () => {
      const wrongDto = new LoginDto();
      wrongDto.usernameOrEmail = 'sadia';
      wrongDto.password = 'WrongPassword999';

      // 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await expect(authService.validateAndLogin(wrongDto)).rejects.toThrow(UnauthorizedException);
      }
      expect(mockUser.failedLogins).toBe(3);
      expect(mockUser.firstFailedAt).not.toBeNull();

      // 4th attempt succeeds with right password
      const rightDto = new LoginDto();
      rightDto.usernameOrEmail = 'sadia';
      rightDto.password = 'Smart@1234';
      const result = await authService.validateAndLogin(rightDto);

      expect(result.accessToken).toBeDefined();
      expect(mockUser.failedLogins).toBe(0);
      expect(mockUser.firstFailedAt).toBeNull();
      expect(mockUser.lockedUntil).toBeNull();
    });

    it('starts a fresh 15-minute window if 15 minutes passed since firstFailedAt', async () => {
      // Simulate 4 failures 16 minutes ago
      mockUser.failedLogins = 4;
      mockUser.firstFailedAt = new Date(Date.now() - THROTTLE_WINDOW_MS - 60_000);
      mockUser.lockedUntil = null;

      const wrongDto = new LoginDto();
      wrongDto.usernameOrEmail = 'sadia';
      wrongDto.password = 'WrongPassword999';

      await expect(authService.validateAndLogin(wrongDto)).rejects.toThrow(UnauthorizedException);

      // Should reset counter to 1 instead of locking at 5
      expect(mockUser.failedLogins).toBe(1);
      expect(mockUser.lockedUntil).toBeNull();
    });

    it('allows login again once the 15-minute lockout period expires', async () => {
      // Simulate lock that expired 1 second ago
      mockUser.failedLogins = 5;
      mockUser.firstFailedAt = new Date(Date.now() - THROTTLE_WINDOW_MS - 5000);
      mockUser.lockedUntil = new Date(Date.now() - 1000);

      const rightDto = new LoginDto();
      rightDto.usernameOrEmail = 'sadia';
      rightDto.password = 'Smart@1234';

      const result = await authService.validateAndLogin(rightDto);
      expect(result.accessToken).toBeDefined();
      expect(mockUser.failedLogins).toBe(0);
      expect(mockUser.firstFailedAt).toBeNull();
      expect(mockUser.lockedUntil).toBeNull();
    });

    it('starts a fresh window on wrong password after an expired lockout instead of locking immediately', async () => {
      mockUser.failedLogins = 5;
      mockUser.firstFailedAt = new Date(Date.now() - THROTTLE_WINDOW_MS - 5000);
      mockUser.lockedUntil = new Date(Date.now() - 1000);

      const wrongDto = new LoginDto();
      wrongDto.usernameOrEmail = 'sadia';
      wrongDto.password = 'WrongPassword999';

      await expect(authService.validateAndLogin(wrongDto)).rejects.toThrow(UnauthorizedException);
      expect(mockUser.failedLogins).toBe(1);
      expect(mockUser.lockedUntil).toBeNull();
    });
  });
});
