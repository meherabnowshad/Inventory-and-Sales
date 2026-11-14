import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValidationPipe, BadRequestException, UnauthorizedException } from '@nestjs/common';
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
  let validationPipe: ValidationPipe;

  beforeEach(() => {
    mockAuthService = {
      validateAndLogin: vi.fn(),
      revokeToken: vi.fn(),
      validateToken: vi.fn(),
    };
    authController = new AuthController(mockAuthService as unknown as AuthService);
    validationPipe = new ValidationPipe({
      whitelist: true,
      transform: true,
    });
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
