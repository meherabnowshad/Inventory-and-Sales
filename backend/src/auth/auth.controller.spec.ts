import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

describe('AuthController (IMS-05.1, IMS-05.2, IMS-05.3 | FR-AUTH-01, FR-AUTH-02, FR-AUTH-03)', () => {
  let authController: AuthController;
  let mockAuthService: {
    validateAndLogin: ReturnType<typeof vi.fn>;
    refreshSession: ReturnType<typeof vi.fn>;
    revokeToken: ReturnType<typeof vi.fn>;
    validateToken: ReturnType<typeof vi.fn>;
    cleanToken: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockAuthService = {
      validateAndLogin: vi.fn(),
      refreshSession: vi.fn(),
      revokeToken: vi.fn(),
      validateToken: vi.fn(),
      cleanToken: vi.fn((t: string) => t.replace(/^Bearer\s+/i, '').trim()),
    };
    authController = new AuthController(mockAuthService as unknown as AuthService);
  });

  describe('login (IMS-05.1 & IMS-05.3)', () => {
    it('delegates login requests to AuthService and returns token pair', async () => {
      const mockResponse = {
        user: {
          id: 1,
          name: 'Sadia Rahman',
          username: 'sadia',
          email: 'sadia@smartmart.local',
          role: 'Administrator',
        },
        accessToken: 'mock_jwt_access_token',
        refreshToken: 'mock_refresh_token',
        token: 'mock_jwt_access_token',
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

  describe('refresh (IMS-05.3 / FR-AUTH-03)', () => {
    it('delegates refresh token from request body to AuthService', async () => {
      const mockResponse = {
        user: {
          id: 1,
          name: 'Sadia Rahman',
          username: 'sadia',
          email: 'sadia@smartmart.local',
          role: 'Administrator',
        },
        accessToken: 'new_jwt_access_token',
        refreshToken: 'new_refresh_token',
        token: 'new_jwt_access_token',
      };

      mockAuthService.refreshSession.mockResolvedValue(mockResponse);

      const result = await authController.refresh({ refreshToken: 'valid_refresh_token_123' });

      expect(mockAuthService.refreshSession).toHaveBeenCalledWith('valid_refresh_token_123');
      expect(result).toEqual(mockResponse);
    });

    it('delegates refresh token from Authorization header if body is empty', async () => {
      const mockResponse = {
        user: {
          id: 1,
          name: 'Sadia Rahman',
          username: 'sadia',
          email: 'sadia@smartmart.local',
          role: 'Administrator',
        },
        accessToken: 'new_jwt_access_token',
        refreshToken: 'new_refresh_token',
        token: 'new_jwt_access_token',
      };

      mockAuthService.refreshSession.mockResolvedValue(mockResponse);

      const result = await authController.refresh(undefined, 'Bearer header_refresh_token_123');

      expect(mockAuthService.cleanToken).toHaveBeenCalledWith('Bearer header_refresh_token_123');
      expect(mockAuthService.refreshSession).toHaveBeenCalledWith('header_refresh_token_123');
      expect(result).toEqual(mockResponse);
    });

    it('throws UnauthorizedException if no refresh token is provided', async () => {
      await expect(authController.refresh(undefined, undefined)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(authController.refresh({ refreshToken: '' })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout (IMS-05.2 / FR-AUTH-02)', () => {
    it('successfully calls revokeToken with bearer token and returns success message', async () => {
      const authHeader = 'Bearer smartmart_token_123';
      const result = await authController.logout(authHeader);

      expect(mockAuthService.revokeToken).toHaveBeenCalledWith(authHeader);
      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    it('successfully calls revokeToken with body refreshToken if header is absent', async () => {
      const result = await authController.logout(undefined, { refreshToken: 'smartmart_refresh_123' });

      expect(mockAuthService.revokeToken).toHaveBeenCalledWith('smartmart_refresh_123');
      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    it('throws UnauthorizedException if both header and body are missing', async () => {
      await expect(authController.logout(undefined, undefined)).rejects.toThrow(
        UnauthorizedException,
      );
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
