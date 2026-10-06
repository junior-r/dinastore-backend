import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ENV_DEFAULTS } from '@/shared/infrastructure/config/env';
import { ActivateUserHandler } from './application/commands/activate-user/activate-user.handler';
import { DeactivateUserHandler } from './application/commands/deactivate-user/deactivate-user.handler';
import { LoginUserHandler } from './application/commands/login-user/login-user.handler';
import { OAuthLoginHandler } from './application/commands/oauth-login/oauth-login.handler';
import { RegisterUserHandler } from './application/commands/register-user/register-user.handler';
import { UpdateUserPermissionsHandler } from './application/commands/update-user-permissions/update-user-permissions.handler';
import { UpdateUserRoleHandler } from './application/commands/update-user-role/update-user-role.handler';
import { GetUserByIdHandler } from './application/queries/get-user-by-id/get-user-by-id.handler';
import { GetUserDetailHandler } from './application/queries/get-user-detail/get-user-detail.handler';
import { GetUsersHandler } from './application/queries/get-users/get-users.handler';
import { PASSWORD_HASHER } from './domain/services/password-hasher';
import { USER_REPOSITORY } from './domain/repositories/user.repository';
import { TOKEN_SERVICE } from './domain/services/token-service';
import { GoogleStrategy } from './infrastructure/auth/google.strategy';
import { JwtStrategy } from './infrastructure/auth/jwt.strategy';
import { PermissionsGuard } from './infrastructure/auth/permissions.guard';
import { RolesGuard } from './infrastructure/auth/roles.guard';
import { PrismaUserRepository } from './infrastructure/repositories/prisma-user.repository';
import { JwtTokenService } from './infrastructure/services/jwt-token.service';
import { ScryptPasswordHasher } from './infrastructure/services/scrypt-password-hasher';
import { AdminUsersController } from './presentation/controllers/admin/admin-users.controller';
import { AuthController } from './presentation/controllers/auth.controller';
import { OAuthController } from './presentation/controllers/oauth.controller';

const commandHandlers = [
  RegisterUserHandler,
  LoginUserHandler,
  OAuthLoginHandler,
  UpdateUserRoleHandler,
  UpdateUserPermissionsHandler,
  DeactivateUserHandler,
  ActivateUserHandler,
];
const queryHandlers = [
  GetUserByIdHandler,
  GetUsersHandler,
  GetUserDetailHandler,
];

@Module({
  imports: [
    CqrsModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: Number(
            configService.get<string>(
              'JWT_EXPIRES_IN_SECONDS',
              ENV_DEFAULTS.JWT_EXPIRES_IN_SECONDS,
            ),
          ),
        },
      }),
    }),
  ],
  controllers: [AuthController, OAuthController, AdminUsersController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    JwtStrategy,
    GoogleStrategy,
    RolesGuard,
    PermissionsGuard,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: PASSWORD_HASHER, useClass: ScryptPasswordHasher },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
  ],
  // USER_REPOSITORY is needed by other modules' admin controllers (e.g.
  // Catalog's AdminCatalogController) so their PermissionsGuard instance
  // can look up a STAFF user's current permissions/isActive. JwtModule is
  // needed by RealtimeModule to verify the token on a WebSocket handshake,
  // the same secret/signing config used for HTTP auth.
  exports: [USER_REPOSITORY, JwtModule],
})
export class UsersModule {}
