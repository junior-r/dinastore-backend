import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from '@/modules/users/domain/entities/permission';
import { Role } from '@/modules/users/domain/entities/user.entity';
import { PERMISSION_KEY } from '@/modules/users/presentation/decorators/require-permission.decorator';
import { USER_REPOSITORY } from '@/modules/users/domain/repositories/user.repository';
import type { UserRepository } from '@/modules/users/domain/repositories/user.repository';
import type { TokenPayload } from '@/modules/users/domain/services/token-service';

// Second layer: ADMIN always passes (superuser). STAFF is looked up fresh
// from the DB on every admin request -- not read off the JWT payload -- so
// a permission change or deactivation takes effect immediately here, unlike
// the rest of the site where JwtStrategy stays deliberately stateless.
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: TokenPayload }>();
    const tokenPayload = request.user;
    if (!tokenPayload) {
      return false;
    }
    if (tokenPayload.role === Role.ADMIN) {
      return true;
    }

    const user = await this.userRepository.findById(tokenPayload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('This account has been deactivated');
    }
    return user.permissions.includes(required);
  }
}
