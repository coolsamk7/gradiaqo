import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { CatalogImport } from '@studylog/database';
import { CatalogStatus, importCatalogFile } from '@studylog/database';
import { Command, CommandRunner, Option } from 'nest-commander';

import { DatabaseService } from '../database/database.service.js';
import { output, runSafely } from '../output.js';

/**
 * The file's text; `-` reads it from stdin (for `kubectl exec -i ... < file`). A relative path is from where the command
 * was run: `yarn cli` runs it in apps/cli, so it passes the folder you ran it from as CLI_CWD.
 */
export async function readInput(
    file: string,
    stdin: AsyncIterable<Buffer | string> = process.stdin,
    from = process.env.CLI_CWD ?? process.cwd(),
): Promise<string> {
    if ( file !== '-' ) {
        return readFile( resolve( from, file ), 'utf8' );
    }

    let text = '';

    for await ( const chunk of stdin ) {
        text += chunk.toString();
    }

    return text;
}

const plural = ( count: number, one: string, many = `${one}s` ) => `${count} ${count === 1 ? one : many}`;

@Command( {
    name: 'catalog:import',
    arguments: '<file>',
    description: 'Create or update an official learning path from a YAML file (content/paths/*.yaml; - reads stdin)',
} )
export class CatalogImportCommand extends CommandRunner {
    constructor( private readonly database: DatabaseService ) {
        super();
    }

    @Option( { flags: '--dry-run', description: 'Show what would change, without saving anything' } )
    parseDryRun(): boolean {
        return true;
    }

    async run( [ file ]: string[], options: { dryRun?: boolean } ): Promise<void> {
        await runSafely( async () => {
            const text = await readInput( file );
            const result = await this.database.withDataSource(
                ( dataSource ) => importCatalogFile( dataSource, text, { dryRun: options.dryRun } ),
            );

            print( result );
            if ( options.dryRun ) {
                output.warn( 'Dry run: nothing was saved.' );
            }
        } );
    }
}

function print( { path, size, report }: CatalogImport ): void {
    let what = 'already there';

    if ( report.path.created ) {
        what = 'created';
    } else if ( report.path.updated ) {
        what = 'updated';
    }

    output.success( `${path.title} (${path.slug}): ${what}, ${report.path.status}` );
    output.info( `  ${plural( size.modules, 'module' )}: ${report.modules.created} new, ${report.modules.updated} changed` );
    output.info( `  ${plural( size.topics, 'topic' )}: ${report.topics.created} new, ${report.topics.updated} changed` );
    output.info( `  ${plural( size.items, 'item' )}: ${report.items.created} new, ${report.items.updated} changed`
        + ` · ${report.items.linked} added to topics, ${report.items.unlinked} taken out` );
    for ( const missing of report.notInFile ) {
        output.warn( `Not in the file, kept: ${missing}` );
    }
    for ( const hidden of report.unpublishedItems ) {
        output.warn( `Not published, so learners don't see it: ${hidden} (publish it in Admin › Catalog › Items)` );
    }
    if ( report.path.status === CatalogStatus.Draft ) {
        output.info( output.dim( 'Learners see it once it\'s published: Admin › Catalog, or PATCH /admin/catalog/paths/:id.' ) );
    }
}
