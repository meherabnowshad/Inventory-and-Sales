import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Algorithm, hash } from '@node-rs/argon2';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService (IMS-05.1 | FR-AUTH-01, FR-AUTH-04)', () => {
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
    await expect(authService.validateAndLogin(dto)).rejects.toThrow('Invalid username or password');
  });

  it('rejects unknown username with identical generic error to prevent enumeration (FR-AUTH-01)', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const dto = new LoginDto();
    dto.usernameOrEmail = 'non_existent_user';
    dto.password = 'Smart@1234';

    await expect(authService.validateAndLogin(dto)).rejects.toThrow(UnauthorizedException);
    await expect(authService.validateAndLogin(dto)).rejects.toThrow('Invalid username or password');
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
    await expect(authService.validateAndLogin(dto)).rejects.toThrow('Invalid username or password');
  });

  it('throws BadRequestException if identifier is empty', async () => {
    const dto = new LoginDto();
    dto.usernameOrEmail = '';
    dto.password = 'Smart@1234';

    await expect(authService.validateAndLogin(dto)).rejects.toThrow(BadRequestException);
  });
});
