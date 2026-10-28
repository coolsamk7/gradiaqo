import { TypeboxResponse } from '@gradiaqo/nestjs-typebox';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AccessTokenPayload } from '@studylog/casl';
import { CheckAbilities } from '@studylog/casl';
import { ImportPathFileBody, Responses } from '@studylog/nestjs';
import type { ImportPathFileRequest, PathImportResult } from '@studylog/schemas';

import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { RateLimit } from '../../rate-limits.js';
import type { CatalogOwner as CatalogOwnerId } from '../catalog.helpers.js';
import { CatalogAuth, CatalogOwner } from '../decorators/catalog-auth.decorator.js';
import { PathImportService } from '../services/path-import.service.js';

@ApiTags( 'catalog: manage' )
@Controller( [ 'admin/catalog/import', 'organizations/:organizationId/catalog/import' ] )
@CatalogAuth()
@CheckAbilities( [ 'manage', 'LearningPath' ] )
export class PathImportController {
    constructor( private readonly pathImport: PathImportService ) {}

    @Post()
    @HttpCode( HttpStatus.OK )
    @RateLimit( 'import' )
    @ApiOperation( {
        summary: 'Create or update a path from a path file (content/paths/README.md)',
        description: 'Matches the path, modules and topics by slug and items by type and URL within this catalog, so '
            + 'importing the same file again changes nothing. A new global path is a draft until it\'s published; an '
            + 'organization\'s is private and usable right away, and its creator is enrolled in a personal workspace. '
            + 'Send dryRun to see what would change first.',
    } )
    @TypeboxResponse( Responses.PathImportResult )
    @ApiBadRequestResponse( { description: 'The file has problems: the message lists each one and where it is' } )
    import(
        @CatalogOwner() owner: CatalogOwnerId,
        @CurrentUser() user: AccessTokenPayload,
        @Body( { schema: ImportPathFileBody } ) dto: ImportPathFileRequest,
    ): Promise<PathImportResult> {
        return this.pathImport.import( owner, dto, user.sub );
    }
}
