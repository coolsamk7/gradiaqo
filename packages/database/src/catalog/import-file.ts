import type { DataSource } from 'typeorm';

import type { CatalogPath } from './catalog-file.js';
import { itemKey, parseCatalogFile } from './catalog-file.js';
import type { ImportOwner, ImportReport } from './catalog-import.js';
import { importPath } from './catalog-import.js';

/** What importing a path file did (or, on a dry run, would do). */
export interface CatalogImport {
    /** The file as read. */
    path: CatalogPath;
    /** How big the file's path is: its modules, topics and distinct items. */
    size: { modules: number; topics: number; items: number };
    report: ImportReport;
}

/** Thrown inside the transaction on a dry run, so everything the import did is rolled back. */
class DryRun extends Error {
    constructor( readonly report: ImportReport ) {
        super( 'dry run' );
    }
}

/**
 * Reads a path file (content/paths/README.md) and makes a catalog (the global one unless `owner` says otherwise)
 * match it, in one transaction: all of it is saved, or none. A dry run does the same work and then rolls it back, so it reports exactly what an import would
 * change. Throws a CatalogFileError for a file with problems, before touching the database.
 */
export async function importCatalogFile(
    dataSource: Pick<DataSource, 'transaction'>,
    text: string,
    { dryRun = false, owner }: { dryRun?: boolean; owner?: ImportOwner } = {},
): Promise<CatalogImport> {
    const path = parseCatalogFile( text );
    let report: ImportReport;

    try {
        report = await dataSource.transaction( async ( manager ) => {
            const result = await importPath( manager, path, owner );

            if ( dryRun ) {
                throw new DryRun( result );
            }

            return result;
        } );
    } catch ( error ) {
        if ( !( error instanceof DryRun ) ) {
            throw error;
        }
        report = error.report;
    }

    const topics = path.modules.flatMap( ( module ) => module.topics );

    return {
        path,
        size: {
            modules: path.modules.length,
            topics: topics.length,
            items: new Set( topics.flatMap( ( topic ) => topic.items.map( itemKey ) ) ).size,
        },
        report,
    };
}
