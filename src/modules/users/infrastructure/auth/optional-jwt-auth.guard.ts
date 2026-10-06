import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TokenPayload } from '@/modules/users/domain/services/token-service';

/**
 * Same JWT validation as `JwtAuthGuard`, but a missing, malformed or expired
 * token leaves `request.user` undefined instead of rejecting with 401.
 *
 * For public endpoints whose *response* varies by reader — e.g. the comment
 * list, which is readable by anyone but marks which comments the current
 * user has liked. Routes that actually require a user must keep using
 * `JwtAuthGuard`.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<T = TokenPayload>(
    _err: unknown,
    user: T | false,
  ): T | undefined {
    return user || undefined;
  }
}
