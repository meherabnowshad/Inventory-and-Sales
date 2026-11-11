import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Algorithm, hash } from '@node-rs/argon2';
import { AuthService, ACCESS_TOKEN_TTL_SEC, REFRESH_TOKEN_TTL_MS } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from '../prisma/prisma.service';

interface MockRefreshTokenRow {
  id: bigint;
  userId: bigint;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

describe('AuthService (IMS-05.1, IMS-05.2, IMS-05.3 | FR-AUTH-01, FR-AUTH-02, FR-AUTH-03, FR-AUTH-04)', () => {
  let authService: AuthService;
  let sampleArgonHash: string;
  let storedTokens: Map<string, MockRefreshTokenRow>;
  let nextTokenId: bigint;

  const mockUser = {
    id: BigInt(1),
    name: 'Sadia Rahman',
    username: 'sadia',
    email: 'sadia@smartmart.local',
    passwordHash: '',
    roleId: 1,
    isActive: true,
    role: { id: 1, name: 'Administrator' },
  };

  const mockPrisma = {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
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
    storedTokens = new Map();
    nextTokenId = BigInt(1);
    sampleArgonHash = await hash('Smart@1234', { algorithm: Algorithm.Argon2id });
    mockUser.passwordHash = sampleArgonHash;
    mockUser.isActive = true;

    mockPrisma.user.findFirst.mockResolvedValue(mockUser);
    mockPrisma.user.findUnique.mockImplementation(async ({ where }: { where: { id: bigint } }) => {
      if (where.id === mockUser.id) return mockUser;
      return null;
    });

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
        where: { tokenHash: string };
        include?: { user?: unknown };
      }) => {
        const row = storedTokens.get(where.tokenHash);
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
      async ({ where, data }: { where: { userId: bigint; revokedAt: null }; data: { revokedAt: Date } }) => {
        let count = 0;
        for (const [tokenHash, row] of storedTokens.entries()) {
          if (row.userId === where.userId && row.revokedAt === null) {
            storedTokens.set(tokenHash, { ...row, revokedAt: data.revokedAt });
            count++;
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
      await expect(authService.validateToken(tamperedJwt)).rejects.toThrow('Invalid token signature');
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

      await expect(authService.refreshSession(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
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

      await expect(authService.refreshSession(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(authService.refreshSession(refreshToken)).rejects.toThrow(
        'User account is deactivated',
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
      await expect(authService.refreshSession(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('revokes user active session when logging out with access token', async () => {
      const dto = new LoginDto();
      dto.usernameOrEmail = 'sadia';
      dto.password = 'Smart@1234';

      const { accessToken, refreshToken } = await authService.validateAndLogin(dto);

      // Logout with access token
      await authService.revokeToken(accessToken);

      // Refresh token is marked revoked
      expect(await authService.isTokenRevoked(refreshToken)).toBe(true);
      await expect(authService.refreshSession(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects repeated logout attempts with 401', async () => {
      const dto = new LoginDto();
      dto.usernameOrEmail = 'sadia';
      dto.password = 'Smart@1234';

      const { refreshToken } = await authService.validateAndLogin(dto);
      await authService.revokeToken(refreshToken);

      await expect(authService.revokeToken(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects empty or missing token with 401', async () => {
      await expect(authService.validateToken('')).rejects.toThrow(UnauthorizedException);
      await expect(authService.revokeToken('')).rejects.toThrow(UnauthorizedException);
    });
  });
});
