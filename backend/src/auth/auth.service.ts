import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { verify } from '@node-rs/argon2';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

export interface AuthUserResponse {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
}

export interface LoginResponse {
  user: AuthUserResponse;
  token: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * IMS-05.1: Login endpoint with hashed password check (FR-AUTH-01, FR-AUTH-04)
   * Validates username or email against PostgreSQL users and verifies Argon2id password hash.
   * On any failure (user not found, wrong password, or inactive), returns a generic error.
   */
  async validateAndLogin(dto: LoginDto): Promise<LoginResponse> {
    const identifier = dto.getIdentifier();

    if (!identifier) {
      throw new BadRequestException('Username or email is required');
    }

    // Lookup user by case-insensitive username OR email
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: identifier, mode: 'insensitive' } },
          { email: { equals: identifier, mode: 'insensitive' } },
        ],
      },
      include: {
        role: true,
      },
    });

    // FR-AUTH-01: Wrong login shows one generic error that names no field
    // (Protects against account enumeration)
    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Invalid username or password');
    }

    // FR-AUTH-04: Argon2id password hash verification
    const isPasswordValid = await verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid username or password');
    }

    // Return sanitized user details (excluding password_hash)
    const token = `smartmart_auth_${user.username}_${Date.now()}`;

    return {
      user: {
        id: Number(user.id),
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role.name,
      },
      token,
    };
  }
}
