import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValidationPipe, BadRequestException, UnauthorizedException } from '@nestjs/common';
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
  let validationPipe: ValidationPipe;

  beforeEach(() => {
    mockAuthService = {
      validateAndLogin: vi.fn(),
      refreshSession: vi.fn(),
      revokeToken: vi.fn(),
      validateToken: vi.fn(),
      cleanToken: vi.fn((t: string) => t.replace(/^Bearer\s+/i, '').trim()),
    };
    authController = new AuthController(mockAuthService as unknown as AuthService);
    validationPipe = new ValidationPipe({
      whitelist: true,
      transform: true,
    });
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
      expect(result).toEqual({
        user: mockResponse.user,
        accessToken: mockResponse.accessToken,
        token: mockResponse.token,
      });
      expect(result).not.toHaveProperty('refreshToken');
    });

    it('sets HttpOnly cookie with refreshToken when Response object is provided', async () => {
      const mockResponse = {
        user: {
          id: 1,
          name: 'Sadia Rahman',
          username: 'sadia',
          email: 'sadia@smartmart.local',
          role: 'Administrator',
        },
        accessToken: 'mock_jwt_access_token',
        refreshToken: 'mock_refresh_token_cookie',
        token: 'mock_jwt_access_token',
      };
      mockAuthService.validateAndLogin.mockResolvedValue(mockResponse);

      const dto = new LoginDto();
      dto.usernameOrEmail = 'sadia';
      dto.password = 'Smart@1234';

      const mockRes = {
        cookie: vi.fn(),
      } as any;

      const result = await authController.login(dto, mockRes);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'mock_refresh_token_cookie',
        expect.objectContaining({
          httpOnly: true,
          path: '/api/auth',
        }),
      );
      expect(result).not.toHaveProperty('refreshToken');
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
      expect(result).toEqual({
        user: mockResponse.user,
        accessToken: mockResponse.accessToken,
        token: mockResponse.token,
      });
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
      expect(result).toEqual({
        user: mockResponse.user,
        accessToken: mockResponse.accessToken,
        token: mockResponse.token,
      });
    });

    it('delegates refresh token from HttpOnly cookie when body and header are omitted', async () => {
      const mockResponse = {
        user: {
          id: 1,
          name: 'Sadia Rahman',
          username: 'sadia',
          email: 'sadia@smartmart.local',
          role: 'Administrator',
        },
        accessToken: 'new_jwt_access_token',
        refreshToken: 'rotated_refresh_token',
        token: 'new_jwt_access_token',
      };

      mockAuthService.refreshSession.mockResolvedValue(mockResponse);

      const mockReq = {
        cookies: { refreshToken: 'cookie_refresh_token_123' },
      } as any;
      const mockRes = {
        cookie: vi.fn(),
      } as any;

      const result = await authController.refresh(undefined, undefined, mockReq, mockRes);

      expect(mockAuthService.refreshSession).toHaveBeenCalledWith('cookie_refresh_token_123');
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'rotated_refresh_token',
        expect.objectContaining({
          httpOnly: true,
          path: '/api/auth',
        }),
      );
      expect(result).toEqual({
        user: mockResponse.user,
        accessToken: mockResponse.accessToken,
        token: mockResponse.token,
      });
      expect(result).not.toHaveProperty('refreshToken');
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
      const result = await authController.logout(undefined, {
        refreshToken: 'smartmart_refresh_123',
      });

      expect(mockAuthService.revokeToken).toHaveBeenCalledWith('smartmart_refresh_123');
      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    it('revokes token from HttpOnly cookie and clears cookie upon logout', async () => {
      const mockReq = {
        cookies: { refreshToken: 'cookie_logout_token_123' },
      } as any;
      const mockRes = {
        clearCookie: vi.fn(),
      } as any;

      const result = await authController.logout(undefined, undefined, mockReq, mockRes);

      expect(mockAuthService.revokeToken).toHaveBeenCalledWith('cookie_logout_token_123');
      expect(mockRes.clearCookie).toHaveBeenCalledWith('refreshToken', { path: '/api/auth' });
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
        mustResetPassword: false,
      };

      const result = await authController.getProfile({ user: mockUser });
      expect(result).toEqual(mockUser);
    });
  });

  describe('ValidationPipe and HTTP Error Semantics (FR-AUTH-01 / NFR-SEC-02)', () => {
    const metadata = { type: 'body' as const, metatype: LoginDto };

    it('allows passwords shorter than 8 chars through ValidationPipe (FR-AUTH-01 does not leak length via 400)', async () => {
      const payload = { usernameOrEmail: 'sadia', password: 'abc' };

      // ValidationPipe must NOT throw 400 on short password
      const transformedDto = await validationPipe.transform(payload, metadata);
      expect(transformedDto).toBeInstanceOf(LoginDto);
      expect(transformedDto.password).toBe('abc');

      // AuthService rejects wrong credentials with HTTP 401 generic error
      mockAuthService.validateAndLogin.mockRejectedValue(
        new UnauthorizedException('Invalid username or password'),
      );
      await expect(authController.login(transformedDto)).rejects.toThrow(UnauthorizedException);
      await expect(authController.login(transformedDto)).rejects.toThrow(
        'Invalid username or password',
      );
    });

    it('rejects missing or empty password with 400 Bad Request via ValidationPipe', async () => {
      const payload = { usernameOrEmail: 'sadia', password: '' };

      await expect(validationPipe.transform(payload, metadata)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('strips non-whitelisted fields via ValidationPipe (whitelist: true)', async () => {
      const payload = {
        usernameOrEmail: 'sadia',
        password: 'Password123',
        injectedAdmin: true,
      };

      const transformedDto = (await validationPipe.transform(payload, metadata)) as Record<
        string,
        unknown
      >;
      expect(transformedDto.injectedAdmin).toBeUndefined();
      expect(transformedDto.password).toBe('Password123');
    });
  });
});
