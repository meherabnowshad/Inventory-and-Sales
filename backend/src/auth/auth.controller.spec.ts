import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

describe('AuthController (IMS-05.1 & IMS-05.2)', () => {
  let authController: AuthController;
  let mockAuthService: {
    validateAndLogin: ReturnType<typeof vi.fn>;
    revokeToken: ReturnType<typeof vi.fn>;
    validateToken: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockAuthService = {
      validateAndLogin: vi.fn(),
      revokeToken: vi.fn(),
      validateToken: vi.fn(),
    };
    authController = new AuthController(mockAuthService as unknown as AuthService);
  });

  describe('login (IMS-05.1)', () => {
    it('delegates login requests to AuthService and returns response', async () => {
      const mockResponse = {
        user: {
          id: 1,
          name: 'Sadia Rahman',
          username: 'sadia',
          email: 'sadia@smartmart.local',
          role: 'Administrator',
        },
        token: 'mock_token',
      };

      mockAuthService.validateAndLogin.mockResolvedValue(mockResponse);

      const dto = new LoginDto();
      dto.usernameOrEmail = 'sadia';
      dto.password = 'Smart@1234';

      const result = await authController.login(dto);

      expect(mockAuthService.validateAndLogin).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('logout (IMS-05.2 / FR-AUTH-02)', () => {
    it('successfully calls revokeToken with bearer token and returns success message', async () => {
      const authHeader = 'Bearer smartmart_token_123';
      const result = await authController.logout(authHeader);

      expect(mockAuthService.revokeToken).toHaveBeenCalledWith(authHeader);
      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    it('throws UnauthorizedException if authorization header is missing', async () => {
      await expect(authController.logout(undefined)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getProfile', () => {
    it('returns the user attached to the request by AuthGuard', async () => {
      const mockUser = {
        id: 1,
        name: 'Sadia Rahman',
        username: 'sadia',
        email: 'sadia@smartmart.local',
        role: 'Administrator',
      };

      const result = await authController.getProfile({ user: mockUser });
      expect(result).toEqual(mockUser);
    });
  });
});
