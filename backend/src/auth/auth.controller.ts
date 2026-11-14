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
  UseFilters,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService, LoginResponse, RefreshResponse, AuthUserResponse } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { AuthGuard } from './guards/auth.guard';
import { TemporarilyLockedFilter } from './filters/temporarily-locked.filter';

@Controller('auth')
@UseFilters(TemporarilyLockedFilter)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/login
   * IMS-05.1 & IMS-05.3: Authenticates user credentials with Argon2id hash check,
   * returning 15-min access token and 8-hr rotating refresh token (FR-AUTH-01, FR-AUTH-03).
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<LoginResponse> {
    return this.authService.validateAndLogin(loginDto);
  }

  /**
   * POST /api/auth/refresh
   * IMS-05.3: Renews session using a valid refresh token with token rotation (FR-AUTH-03, NFR-SEC-05).
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() refreshDto?: RefreshDto,
    @Headers('authorization') authHeader?: string,
  ): Promise<RefreshResponse> {
    const token =
      refreshDto?.refreshToken || (authHeader ? this.authService.cleanToken(authHeader) : '');

    if (!token) {
      throw new UnauthorizedException('Refresh token is required');
    }

    return this.authService.refreshSession(token);
  }

  /**
   * POST /api/auth/logout
   * IMS-05.2: Revokes the bearer/refresh token so it can never be used again (FR-AUTH-02).
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Headers('authorization') authHeader?: string,
    @Body() body?: { refreshToken?: string },
  ): Promise<{ message: string }> {
    const rawToken = authHeader || body?.refreshToken;
    if (!rawToken) {
      throw new UnauthorizedException(
        'Authorization header or refreshToken is required for logout',
      );
    }
    await this.authService.revokeToken(rawToken);
    return { message: 'Logged out successfully' };
  }

  /**
   * GET /api/auth/me
   * Protected endpoint returning current user profile
   * Calling this with an expired or revoked token yields HTTP 401 Unauthorized
   */
  @Get('me')
  @UseGuards(AuthGuard)
  async getProfile(@Req() req: { user: AuthUserResponse }): Promise<AuthUserResponse> {
    return req.user;
  }
}
