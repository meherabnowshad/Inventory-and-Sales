import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService, LoginResponse, AuthUserResponse } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from './guards/auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/login
   * IMS-05.1: Authenticates user credentials with Argon2id hash check
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<LoginResponse> {
    return this.authService.validateAndLogin(loginDto);
  }

  /**
   * POST /api/auth/logout
   * IMS-05.2: Revokes the bearer token so it can never be used again (FR-AUTH-02)
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Headers('authorization') authHeader?: string): Promise<{ message: string }> {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is required for logout');
    }
    await this.authService.revokeToken(authHeader);
    return { message: 'Logged out successfully' };
  }

  /**
   * GET /api/auth/me
   * Protected endpoint returning current user profile
   * Calling this with an old revoked token yields HTTP 401 Unauthorized
   */
  @Get('me')
  @UseGuards(AuthGuard)
  async getProfile(@Req() req: { user: AuthUserResponse }): Promise<AuthUserResponse> {
    return req.user;
  }
}
