import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseFilters,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService, LoginResponse, RefreshResponse, AuthUserResponse } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { AuthGuard } from './guards/auth.guard';
import { TemporarilyLockedFilter } from './filters/temporarily-locked.filter';
import { Public } from './decorators/public.decorator';

export const REFRESH_COOKIE_NAME = 'refreshToken';

export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/auth',
  maxAge: 8 * 60 * 60 * 1000, // 8 hours (matches SRS rotating refresh TTL)
};

@Controller('auth')
@UseFilters(TemporarilyLockedFilter)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/login
   * IMS-05.1 & IMS-05.3: Authenticates user credentials with Argon2id hash check,
   * returning 15-min access token and setting 8-hr rotating refresh token in an HttpOnly cookie (FR-AUTH-01, FR-AUTH-03).
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<Omit<LoginResponse, 'refreshToken'>> {
    const result = await this.authService.validateAndLogin(loginDto);
    const { refreshToken, ...response } = result;
    if (res) {
      res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
    }
    return response;
  }

  /**
   * POST /api/auth/refresh
   * IMS-05.3: Renews session using a valid refresh token with token rotation (FR-AUTH-03, NFR-SEC-05).
   * Reads from HttpOnly cookie first, then falls back to request body or Authorization header.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() refreshDto?: RefreshDto,
    @Headers('authorization') authHeader?: string,
    @Req() req?: Request,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<Omit<RefreshResponse, 'refreshToken'>> {
    const token =
      req?.cookies?.[REFRESH_COOKIE_NAME] ||
      refreshDto?.refreshToken ||
      (authHeader ? this.authService.cleanToken(authHeader) : '');

    if (!token) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const result = await this.authService.refreshSession(token);
    const { refreshToken, ...response } = result;
    if (res) {
      res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
    }
    return response;
  }

  /**
   * POST /api/auth/logout
   * IMS-05.2: Revokes the bearer/refresh token so it can never be used again (FR-AUTH-02).
   * Revokes token from cookie/header/body and clears the HttpOnly cookie.
   */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Headers('authorization') authHeader?: string,
    @Body() body?: { refreshToken?: string },
    @Req() req?: Request,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<{ message: string }> {
    const rawToken = req?.cookies?.[REFRESH_COOKIE_NAME] || authHeader || body?.refreshToken;

    if (!rawToken) {
      throw new UnauthorizedException(
        'Authorization header, cookie, or refreshToken is required for logout',
      );
    }
    await this.authService.revokeToken(rawToken);
    if (res) {
      res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_OPTIONS.path });
    }
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
