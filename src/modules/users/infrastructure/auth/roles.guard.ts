import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@/modules/users/domain/entities/user.entity';
import { ROLES_KEY } from '@/modules/users/presentation/decorators/roles.decorator';
import type { TokenPayload } from '@/modules/users/domain/services/token-service';

// First layer of the two-layer admin guard: blocks CUSTOMER from every
// @Roles-decorated route before PermissionsGuard's finer-grained (and
// DB-backed) check even runs. Cheap -- reads the role straight off the JWT
// payload, no DB call.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: TokenPayload }>();
    const role = request.user?.role;
    return role !== undefined && requiredRoles.includes(role);
  }
}
