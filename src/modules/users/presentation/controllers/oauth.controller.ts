import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandBus } from '@nestjs/cqrs';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { ENV_DEFAULTS } from '@/shared/infrastructure/config/env';
import { OAuthProvider } from '@/modules/users/domain/entities/user.entity';
import { OAuthLoginCommand } from '@/modules/users/application/commands/oauth-login/oauth-login.command';
import { LoginResult } from '@/modules/users/application/commands/login-user/login-user.handler';
import { OAuthProfile } from '@/modules/users/infrastructure/auth/oauth-profile';

/**
 * One provider = one Passport strategy (registered in UsersModule) + a pair
 * of routes here that mirror the Google ones below, guarded by
 * `AuthGuard('<provider>')`. The callback route always does the same three
 * things: read `req.user` (an `OAuthProfile`, whatever the provider), run it
 * through `OAuthLoginCommand`, redirect to the frontend with a token.
 */
@Controller('auth')
export class OAuthController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly configService: ConfigService,
  ) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    // Never reached — the guard redirects to Google's consent screen.
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(
    @Req() req: Request & { user: OAuthProfile },
    @Res() res: Response,
  ) {
    const result = await this.commandBus.execute<
      OAuthLoginCommand,
      LoginResult
    >(
      new OAuthLoginCommand(
        OAuthProvider.GOOGLE,
        req.user.providerAccountId,
        req.user.email,
        req.user.name,
        req.user.avatarUrl,
      ),
    );

    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      ENV_DEFAULTS.FRONTEND_URL,
    );
    res.redirect(
      `${frontendUrl}/auth/callback?token=${encodeURIComponent(result.accessToken)}`,
    );
  }
}
