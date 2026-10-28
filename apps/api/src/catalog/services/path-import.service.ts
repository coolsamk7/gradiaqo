import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { CatalogImport } from '@studylog/database';
import { AuditAction, CatalogFileError, importCatalogFile } from '@studylog/database';
import type { ImportPathFileRequest, PathImportResult } from '@studylog/schemas';
import { DataSource } from 'typeorm';

import { AuditService } from '../../audit/services/audit.service.js';

/**
 * Official paths from a path file (content/paths/README.md), the way `yarn cli catalog:import` brings them in: a new
 * path starts as a draft, and importing the same file again changes nothing.
 */
@Injectable()
export class PathImportService {
    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly audit: AuditService,
    ) {}

    /** A file with problems is a 400 listing them. An import that changed something goes in the audit log. */
    async import( { content, dryRun = false }: ImportPathFileRequest, actorId: string ): Promise<PathImportResult> {
        let result: CatalogImport;

        try {
            result = await importCatalogFile( this.dataSource, content, { dryRun } );
        } catch ( error ) {
            if ( error instanceof CatalogFileError ) {
                throw new BadRequestException( error.message );
            }
            throw error;
        }

        const { path, size, report } = result;
        const changed = report.path.created || report.path.updated
            || [ report.modules, report.topics, report.items ].some( ( counts ) => counts.created + counts.updated > 0 )
            || report.items.linked + report.items.unlinked > 0;

        if ( !dryRun && changed ) {
            await this.audit.record( {
                actorId,
                action: AuditAction.PathImported,
                targetId: report.path.id,
                targetLabel: path.title,
                note: `${size.modules} modules, ${size.topics} topics, ${size.items} items: `
                    + `${report.modules.created + report.topics.created + report.items.created} new, `
                    + `${report.modules.updated + report.topics.updated + report.items.updated} changed`,
            } );
        }

        return {
            dryRun,
            path: { ...report.path, slug: path.slug, title: path.title },
            modules: { total: size.modules, ...report.modules },
            topics: { total: size.topics, ...report.topics },
            items: { total: size.items, ...report.items },
            notInFile: report.notInFile,
            unpublishedItems: report.unpublishedItems,
        };
    }
}
