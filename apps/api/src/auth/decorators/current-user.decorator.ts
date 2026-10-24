import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import type { AccessTokenPayload } from '@studylog/casl';

import type { AuthedRequest } from '../guards/auth.guard.js';

/** The JWT payload of the logged-in user. Only use on routes protected by AuthGuard. */
export const CurrentUser = createParamDecorator(
    ( _data: unknown, context: ExecutionContext ): AccessTokenPayload =>
        context.switchToHttp().getRequest<AuthedRequest>().user!,
);
