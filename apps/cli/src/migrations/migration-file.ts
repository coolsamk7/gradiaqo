import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { MIGRATIONS_SOURCE_DIR } from '@studylog/database';

export interface MigrationQuery {
    query: string;
    parameters?: unknown[];
}

export interface MigrationFile {
    className: string;
    fileName: string;
    path: string;
    content: string;
}

/** "add-study-sessions" / "add study sessions" / "addStudySessions" → "AddStudySessions". */
export function toPascalCase( name: string ): string {
    const words = name
        .replace( /([a-z0-9])([A-Z])/g, '$1 $2' )
        .split( /[^a-zA-Z0-9]+/ )
        .filter( Boolean );

    if ( words.length === 0 || !/^[a-zA-Z]/.test( words[0] ?? '' ) ) {
        throw new Error( `Invalid migration name "${name}": use letters, numbers and dashes, starting with a letter.` );
    }

    return words.map( ( word ) => word.charAt( 0 ).toUpperCase() + word.slice( 1 ) ).join( '' );
}

function toKebabCase( pascal: string ): string {
    return pascal.replace( /([a-z0-9])([A-Z])/g, '$1-$2' ).toLowerCase();
}

/** Makes SQL safe to embed in a template literal. */
function toTemplateLiteral( sql: string ): string {
    return `\`${sql.replaceAll( '\\', '\\\\' ).replaceAll( '`', '\\`' ).replaceAll( '${', '\\${' )}\``;
}

function renderQueries( queries: MigrationQuery[] ): string {
    if ( queries.length === 0 ) {
        return '        // Write your migration here, e.g. await queryRunner.query( `ALTER TABLE ...` );';
    }

    return queries
        .map( ( { query, parameters } ) =>
            parameters?.length
                ? `        await queryRunner.query( ${toTemplateLiteral( query )}, ${JSON.stringify( parameters )} );`
                : `        await queryRunner.query( ${toTemplateLiteral( query )} );` )
        .join( '\n' );
}

/**
 * Builds a TypeORM migration file. TypeORM orders migrations by the timestamp at the end of the class name.
 * The output follows the repo's lint style, so generated files pass `yarn lint` untouched.
 */
export function buildMigrationFile(
    name: string,
    up: MigrationQuery[],
    down: MigrationQuery[],
    timestamp = Date.now(),
): MigrationFile {
    const pascal = toPascalCase( name );
    const className = `${pascal}${timestamp}`;
    const fileName = `${timestamp}-${toKebabCase( pascal )}.ts`;
    const content = `import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ${className} implements MigrationInterface {
    name = '${className}';

    async up( queryRunner: QueryRunner ): Promise<void> {
${renderQueries( up )}
    }

    async down( queryRunner: QueryRunner ): Promise<void> {
${renderQueries( down )}
    }
}
`;

    return { className, fileName, path: join( MIGRATIONS_SOURCE_DIR, fileName ), content };
}

export async function writeMigrationFile( file: MigrationFile ): Promise<void> {
    // `wx` fails instead of overwriting if the file somehow exists already.
    await writeFile( file.path, file.content, { flag: 'wx' } );
}
