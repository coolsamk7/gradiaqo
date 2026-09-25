import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';

import { AuthGuard } from './auth.guard.js';

/** For routes any logged-in user can call, about their own data. */
export const Authenticated = () =>
    applyDecorators(
        UseGuards( AuthGuard ),
        ApiBearerAuth(),
        ApiUnauthorizedResponse( { description: 'Missing or invalid access token' } ),
    );
