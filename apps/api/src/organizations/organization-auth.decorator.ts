import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiNotFoundResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AbilityGuard } from '@studylog/casl';

import { AuthGuard } from '../auth/auth.guard.js';
import { OrganizationGuard } from './organization.guard.js';

/**
 * For routes inside an organization: logged in → member of the organization → allowed by
 * `@CheckAbilities()`. Guards run in this order.
 */
export const OrganizationAuth = () =>
    applyDecorators(
        UseGuards( AuthGuard, OrganizationGuard, AbilityGuard ),
        ApiBearerAuth(),
        ApiUnauthorizedResponse( { description: 'Missing or invalid access token' } ),
        ApiForbiddenResponse( { description: 'Your role in this organization does not allow this' } ),
        ApiNotFoundResponse( { description: 'Organization not found, or you are not a member' } ),
    );
