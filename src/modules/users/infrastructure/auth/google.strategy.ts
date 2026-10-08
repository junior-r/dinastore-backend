import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, StrategyOptions } from 'passport-google-oauth20';
import { ENV_DEFAULTS } from '@/shared/infrastructure/config/env';
import { OAuthProfile } from './oauth-profile';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    super({
      // Fall back to placeholder, non-empty values rather than getOrThrow —
      // an unconfigured Google app shouldn't crash the whole backend on boot,
      // it should just make /auth/google fail until real credentials are set.
      clientID: configService.get<string>(
        'GOOGLE_CLIENT_ID',
        ENV_DEFAULTS.GOOGLE_NOT_CONFIGURED,
      ),
      clientSecret: configService.get<string>(
        'GOOGLE_CLIENT_SECRET',
        ENV_DEFAULTS.GOOGLE_NOT_CONFIGURED,
      ),
      callbackURL: configService.get<string>(
        'GOOGLE_CALLBACK_URL',
        ENV_DEFAULTS.GOOGLE_CALLBACK_URL,
      ),
      scope: ['email', 'profile'],
    } satisfies StrategyOptions);
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): OAuthProfile {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      throw new UnauthorizedException(
        'Google account has no accessible email address',
      );
    }

    return {
      providerAccountId: profile.id,
      email,
      name: profile.displayName || email,
      avatarUrl: profile.photos?.[0]?.value ?? null,
    };
  }
}
