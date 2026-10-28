import { TypeboxResponse } from '@gradiaqo/nestjs-typebox';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AccessTokenPayload } from '@studylog/casl';
import { CheckAbilities } from '@studylog/casl';
import { ImportPathFileBody, Responses } from '@studylog/nestjs';
import type { ImportPathFileRequest, PathImportResult } from '@studylog/schemas';

import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { PlatformAuth } from '../../auth/decorators/platform-auth.decorator.js';
import { PathImportService } from '../services/path-import.service.js';

@ApiTags( 'catalog: manage' )
@Controller( 'admin/catalog/import' )
@PlatformAuth()
@CheckAbilities( [ 'manage', 'LearningPath' ] )
export class PathImportController {
    constructor( private readonly pathImport: PathImportService ) {}

    @Post()
    @HttpCode( HttpStatus.OK )
    @ApiOperation( {
        summary: 'Create or update an official path from a path file (content/paths/README.md)',
        description: 'Matches the path, modules and topics by slug and items by type and URL, so importing the same '
            + 'file again changes nothing. A new path is a draft until it\'s published. Send dryRun to see what would '
            + 'change first.',
    } )
    @TypeboxResponse( Responses.PathImportResult )
    @ApiBadRequestResponse( { description: 'The file has problems: the message lists each one and where it is' } )
    import(
        @CurrentUser() user: AccessTokenPayload,
        @Body( { schema: ImportPathFileBody } ) dto: ImportPathFileRequest,
    ): Promise<PathImportResult> {
        return this.pathImport.import( dto, user.sub );
    }
}
