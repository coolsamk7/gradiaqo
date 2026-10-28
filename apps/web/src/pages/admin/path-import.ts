import type { PathImportResultJson } from '@studylog/schemas';
import { MAX_PATH_FILE_LENGTH } from '@studylog/schemas';
import { CatalogStatus } from '@studylog/schemas/enums';

import { ApiError } from '../../api/client.ts';
import { changeError } from './catalog.ts';

/* Admin › Catalog › Import: reading a path file and saying what importing it changes. */

const plural = ( count: number, one: string ) => `${count} ${count === 1 ? one : `${one}s`}`;

/** A chosen file that can't be sent: empty, or bigger than the API takes. */
export class PathFileError extends Error {}

/** The file's text, or why it can't be imported (checked here so a big file gets a clear answer, not a 413). */
export async function readPathFile( file: File ): Promise<string> {
    const text = await file.text();

    if ( !text.trim() ) {
        throw new PathFileError( 'The file is empty.' );
    }
    if ( text.length > MAX_PATH_FILE_LENGTH ) {
        throw new PathFileError( `The file is too big: ${text.length.toLocaleString( 'en-US' )} characters, and the most is ${MAX_PATH_FILE_LENGTH.toLocaleString( 'en-US' )}.` );
    }

    return text;
}

/** "New path, a draft" / "Updated, published" / "Already there, published": what happens to the path itself. */
export function pathOutcome( { path }: PathImportResultJson ): string {
    let what = 'Already there';

    if ( path.created ) {
        what = 'New path';
    } else if ( path.updated ) {
        what = 'Updated';
    }

    return `${what}, ${path.status === CatalogStatus.Draft ? 'a draft' : path.status}`;
}

/** One line each for modules, topics and items: "9 modules: 9 new, 0 changed". */
export function changeLines( { modules, topics, items }: PathImportResultJson ): string[] {
    return [
        `${plural( modules.total, 'module' )}: ${modules.created} new, ${modules.updated} changed`,
        `${plural( topics.total, 'topic' )}: ${topics.created} new, ${topics.updated} changed`,
        `${plural( items.total, 'item' )}: ${items.created} new, ${items.updated} changed`
        + ` · ${items.linked} added to topics, ${items.unlinked} taken out`,
    ];
}

/** Whether importing would change anything at all. */
export function changesSomething( { path, modules, topics, items }: PathImportResultJson ): boolean {
    return path.created || path.updated
        || [ modules, topics, items ].some( ( counts ) => counts.created + counts.updated > 0 )
        || items.linked + items.unlinked > 0;
}

/**
 * Why the file wasn't imported. A 400 is the file's problems, one per line as the API lists them (e.g.
 * "/modules/0/title: must not have fewer than 1 characters").
 */
export function importError( error: unknown ): string[] {
    if ( error instanceof PathFileError ) {
        return [ error.message ];
    }
    if ( error instanceof ApiError && error.status === 400 ) {
        return error.message.split( '\n' ).map( ( line ) => line.trim() ).filter( Boolean );
    }

    return [ changeError( error ) ];
}
