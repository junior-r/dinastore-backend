import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { TokenPayload } from '@/modules/users/domain/services/token-service';

/**
 * Companion to `CurrentUser` for routes behind `OptionalJwtAuthGuard`, where
 * there may be no authenticated user. Kept separate rather than widening
 * `CurrentUser`'s return type, so the many guarded routes that legitimately
 * treat the user as always-present don't all have to start null-checking.
 */
export const OptionalCurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TokenPayload | undefined => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user?: TokenPayload }>();
    return request.user;
  },
);
