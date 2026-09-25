import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AbilityGuard } from '@studylog/casl';

import { AuthGuard } from './auth.guard.js';

/**
 * For routes outside any organization: logged in → allowed by `@CheckAbilities()` under platform-level
 * rules (e.g. superadmin). Guards run in this order.
 */
export const PlatformAuth = () =>
    applyDecorators(
        UseGuards( AuthGuard, AbilityGuard ),
        ApiBearerAuth(),
        ApiUnauthorizedResponse( { description: 'Missing or invalid access token' } ),
        ApiForbiddenResponse( { description: 'Your role does not allow this' } ),
    );
