import { readFile } from 'node:fs/promises';

import { CatalogStatus } from '@studylog/database';
import { Command, CommandRunner, Option } from 'nest-commander';

import { DatabaseService } from '../database/database.service.js';
import { output, runSafely } from '../output.js';
import type { CatalogPath } from './catalog-file.js';
import { itemKey, parseCatalogFile } from './catalog-file.js';
import type { ImportReport } from './catalog-import.js';
import { importPath } from './catalog-import.js';

/** Thrown inside the transaction on a dry run, so everything the import did is rolled back. */
class DryRun extends Error {
    constructor( readonly report: ImportReport ) {
        super( 'dry run' );
    }
}

/** The file's text; `-` reads it from stdin (for `kubectl exec -i ... < file`). */
export async function readInput(
    file: string,
    stdin: AsyncIterable<Buffer | string> = process.stdin,
): Promise<string> {
    if ( file !== '-' ) {
        return readFile( file, 'utf8' );
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
            const path = parseCatalogFile( await readInput( file ) );
            const report = await this.database.withDataSource( async ( dataSource ) => {
                try {
                    return await dataSource.transaction( async ( manager ) => {
                        const result = await importPath( manager, path );

                        if ( options.dryRun ) {
                            throw new DryRun( result );
                        }

                        return result;
                    } );
                } catch ( error ) {
                    if ( error instanceof DryRun ) {
                        return error.report;
                    }
                    throw error;
                }
            } );

            print( path, report );
            if ( options.dryRun ) {
                output.warn( 'Dry run: nothing was saved.' );
            }
        } );
    }
}

function print( path: CatalogPath, report: ImportReport ): void {
    const topics = path.modules.flatMap( ( module ) => module.topics );
    const items = new Set( topics.flatMap( ( topic ) => topic.items.map( itemKey ) ) ).size;
    let what = 'already there';

    if ( report.path.created ) {
        what = 'created';
    } else if ( report.path.updated ) {
        what = 'updated';
    }

    output.success( `${path.title} (${path.slug}): ${what}, ${report.path.status}` );
    output.info( `  ${plural( path.modules.length, 'module' )}: ${report.modules.created} new, ${report.modules.updated} changed` );
    output.info( `  ${plural( topics.length, 'topic' )}: ${report.topics.created} new, ${report.topics.updated} changed` );
    output.info( `  ${plural( items, 'item' )}: ${report.items.created} new, ${report.items.updated} changed`
        + ` · ${report.items.linked} added to topics, ${report.items.unlinked} taken out` );
    for ( const missing of report.notInFile ) {
        output.warn( `Not in the file, kept: ${missing}` );
    }
    if ( report.path.status === CatalogStatus.Draft ) {
        output.info( output.dim( 'Learners see it once it\'s published: Admin › Catalog, or PATCH /admin/catalog/paths/:id.' ) );
    }
}
