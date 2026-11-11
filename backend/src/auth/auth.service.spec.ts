import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Algorithm, hash } from '@node-rs/argon2';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService (IMS-05.1 & IMS-05.2 | FR-AUTH-01, FR-AUTH-02, FR-AUTH-04)', () => {
  let authService: AuthService;
  let sampleArgonHash: string;

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
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    sampleArgonHash = await hash('Smart@1234', { algorithm: Algorithm.Argon2id });
    mockUser.passwordHash = sampleArgonHash;
    authService = new AuthService(mockPrisma as unknown as PrismaService);
  });

  describe('IMS-05.1: Login & Password Hash Verification (FR-AUTH-01, FR-AUTH-04)', () => {
    it('successfully authenticates with valid username and Argon2id hashed password', async () => {
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

  describe('IMS-05.2: Logout and Token Revocation (FR-AUTH-02 - Done when: Old token gets 401)', () => {
    it('generates an active token on login and validates successfully before logout', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const dto = new LoginDto();
      dto.usernameOrEmail = 'sadia';
      dto.password = 'Smart@1234';

      const loginRes = await authService.validateAndLogin(dto);
      expect(loginRes.token).toBeDefined();

      const profile = authService.validateToken(loginRes.token);
      expect(profile.username).toBe('sadia');
      expect(profile.role).toBe('Administrator');
    });

    it('revokes an active token upon logout (FR-AUTH-02)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const dto = new LoginDto();
      dto.usernameOrEmail = 'sadia';
      dto.password = 'Smart@1234';

      const { token } = await authService.validateAndLogin(dto);
      expect(authService.isTokenRevoked(token)).toBe(false);

      // Logout
      authService.revokeToken(token);
      expect(authService.isTokenRevoked(token)).toBe(true);
    });

    it('rejects the old token with HTTP 401 after logout (Done when: Old token gets 401)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const dto = new LoginDto();
      dto.usernameOrEmail = 'sadia';
      dto.password = 'Smart@1234';

      const { token } = await authService.validateAndLogin(dto);

      // Successfully logged in, token is valid
      expect(authService.validateToken(token)).toBeDefined();

      // Perform logout
      authService.revokeToken(token);

      // CRITICAL ACCEPTANCE CRITERIA: Old token must be rejected with HTTP 401
      expect(() => authService.validateToken(token)).toThrow(UnauthorizedException);
      expect(() => authService.validateToken(token)).toThrow('Token has been revoked');
    });

    it('rejects subsequent logout attempts with the same old token (HTTP 401)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const dto = new LoginDto();
      dto.usernameOrEmail = 'sadia';
      dto.password = 'Smart@1234';

      const { token } = await authService.validateAndLogin(dto);

      // First logout succeeds
      authService.revokeToken(token);

      // Second logout attempt with the same token must fail with 401
      expect(() => authService.revokeToken(token)).toThrow(UnauthorizedException);
      expect(() => authService.revokeToken(token)).toThrow('Token has already been revoked');
    });

    it('rejects unauthenticated requests with empty or missing token (HTTP 401)', () => {
      expect(() => authService.validateToken('')).toThrow(UnauthorizedException);
      expect(() => authService.revokeToken('')).toThrow(UnauthorizedException);
    });

    it('rejects fake or random unregistered tokens (HTTP 401)', () => {
      expect(() => authService.validateToken('fake_unregistered_token_123')).toThrow(
        UnauthorizedException,
      );
      expect(() => authService.revokeToken('fake_unregistered_token_123')).toThrow(
        UnauthorizedException,
      );
    });
  });
});
