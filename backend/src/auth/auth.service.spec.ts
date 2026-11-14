import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Algorithm, hash } from '@node-rs/argon2';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from '../prisma/prisma.service';

interface MockRefreshTokenRow {
  id: bigint;
  userId: bigint;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

describe('AuthService (IMS-05.1 & IMS-05.2 | FR-AUTH-01, FR-AUTH-02, FR-AUTH-03, FR-AUTH-04)', () => {
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
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    storedTokens = new Map();
    nextTokenId = BigInt(1);
    sampleArgonHash = await hash('Smart@1234', { algorithm: Algorithm.Argon2id });
    mockUser.passwordHash = sampleArgonHash;

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

    authService = new AuthService(mockPrisma as unknown as PrismaService);
  });

  describe('IMS-05.1: Login & Password Hash Verification (FR-AUTH-01, FR-AUTH-04)', () => {
    it('successfully authenticates with valid username, verifies Argon2id hash, and stores SHA-256 token hash in DB', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

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
      expect(result.token).toBeDefined();

      // Verify SHA-256 hash was persisted in refresh_tokens
      const expectedHash = authService.hashToken(result.token);
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
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const dto = new LoginDto();
      dto.usernameOrEmail = 'SADIA@SMARTMART.LOCAL';
      dto.password = 'Smart@1234';

      const result = await authService.validateAndLogin(dto);

      expect(result.user.username).toBe('sadia');
      expect(result.user.role).toBe('Administrator');
    });

    it('rejects wrong password with HTTP 401 and generic error (FR-AUTH-01 / FR-AUTH-04)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

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

  describe('IMS-05.2: Logout and Database Token Revocation (FR-AUTH-02 - Done when: Old token gets 401)', () => {
    it('generates an active token on login and validates successfully before logout', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const dto = new LoginDto();
      dto.usernameOrEmail = 'sadia';
      dto.password = 'Smart@1234';

      const loginRes = await authService.validateAndLogin(dto);
      expect(loginRes.token).toBeDefined();

      const profile = await authService.validateToken(loginRes.token);
      expect(profile.username).toBe('sadia');
      expect(profile.role).toBe('Administrator');
    });

    it('marks revoked_at in refresh_tokens upon logout (FR-AUTH-02)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const dto = new LoginDto();
      dto.usernameOrEmail = 'sadia';
      dto.password = 'Smart@1234';

      const { token } = await authService.validateAndLogin(dto);
      expect(await authService.isTokenRevoked(token)).toBe(false);

      // Logout
      await authService.revokeToken(token);
      expect(await authService.isTokenRevoked(token)).toBe(true);
      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: BigInt(1) },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rejects the old token with HTTP 401 after logout (Done when: Old token gets 401)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const dto = new LoginDto();
      dto.usernameOrEmail = 'sadia';
      dto.password = 'Smart@1234';

      const { token } = await authService.validateAndLogin(dto);

      // Successfully logged in, token is valid
      await expect(authService.validateToken(token)).resolves.toBeDefined();

      // Perform logout
      await authService.revokeToken(token);

      // CRITICAL ACCEPTANCE CRITERIA: Old token must be rejected with HTTP 401
      await expect(authService.validateToken(token)).rejects.toThrow(UnauthorizedException);
      await expect(authService.validateToken(token)).rejects.toThrow('Token has been revoked');
    });

    it('rejects subsequent logout attempts with the same old token (HTTP 401)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const dto = new LoginDto();
      dto.usernameOrEmail = 'sadia';
      dto.password = 'Smart@1234';

      const { token } = await authService.validateAndLogin(dto);

      // First logout succeeds
      await authService.revokeToken(token);

      // Second logout attempt with the same token must fail with 401
      await expect(authService.revokeToken(token)).rejects.toThrow(UnauthorizedException);
      await expect(authService.revokeToken(token)).rejects.toThrow(
        'Token has already been revoked',
      );
    });

    it('rejects expired tokens with HTTP 401 (FR-AUTH-03)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const dto = new LoginDto();
      dto.usernameOrEmail = 'sadia';
      dto.password = 'Smart@1234';

      const { token } = await authService.validateAndLogin(dto);
      const tokenHash = authService.hashToken(token);
      const row = storedTokens.get(tokenHash)!;
      storedTokens.set(tokenHash, { ...row, expiresAt: new Date(Date.now() - 1000) });

      await expect(authService.validateToken(token)).rejects.toThrow(UnauthorizedException);
      await expect(authService.validateToken(token)).rejects.toThrow('Invalid or expired token');
    });

    it('rejects unauthenticated requests with empty or missing token (HTTP 401)', async () => {
      await expect(authService.validateToken('')).rejects.toThrow(UnauthorizedException);
      await expect(authService.revokeToken('')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects fake or random unregistered tokens (HTTP 401)', async () => {
      await expect(authService.validateToken('fake_unregistered_token_123')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(authService.revokeToken('fake_unregistered_token_123')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
