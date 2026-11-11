import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

describe('AuthController (IMS-05.1)', () => {
  let authController: AuthController;
  let mockAuthService: { validateAndLogin: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockAuthService = {
      validateAndLogin: vi.fn(),
    };
    authController = new AuthController(mockAuthService as unknown as AuthService);
  });

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
