import { BadRequestException, ConflictException } from '@nestjs/common';
import { CatalogStatus } from '@studylog/database';
import type { EntityManager, EntityTarget, FindOptionsWhere, ObjectLiteral } from 'typeorm';
import { IsNull, QueryFailedError } from 'typeorm';

/** Who owns catalog content: null for the global catalog, otherwise an organization (e.g. a personal workspace). */
export type CatalogOwner = string | null;

/** `where` value for an `organizationId` column. */
export function ownedBy( owner: CatalogOwner ) {
    return owner ?? IsNull();
}

/**
 * Global content starts as a draft until an admin publishes it; an organization's own content is usable right
 * away.
 */
export function defaultStatus( owner: CatalogOwner ): CatalogStatus {
    return owner === null ? CatalogStatus.Draft : CatalogStatus.Published;
}

const PG_UNIQUE_VIOLATION = '23505';

/** "Arrays & Hashing" → "arrays-hashing". Falls back to "untitled" when the title has no usable characters. */
export function toSlug( title: string ): string {
    const slug = title
        .toLowerCase()
        .normalize( 'NFKD' )
        .replace( /[^a-z0-9\s-]/g, '' )
        .trim()
        .replace( /[\s-]+/g, '-' )
        .slice( 0, 120 )
        .replace( /^-+|-+$/g, '' );

    return slug || 'untitled';
}

/** Runs a save, turning a unique-index violation (a taken slug) into a 409 with `message`. */
export async function saveUnique<T>( save: () => Promise<T>, message: string ): Promise<T> {
    try {
        return await save();
    } catch ( err ) {
        if (
            err instanceof QueryFailedError
            && ( err.driverError as { code?: string } ).code === PG_UNIQUE_VIOLATION
        ) {
            throw new ConflictException( message );
        }
        throw err;
    }
}

/**
 * In the global catalog, published or archived content may already be in users' paths and history, so it can
 * only be archived; drafts were never visible and can be deleted. An organization's own content is its
 * owners' to delete.
 */
export function assertDeletable( owner: CatalogOwner, entity: { status: CatalogStatus }, label: string ): void {
    if ( owner === null && entity.status !== CatalogStatus.Draft ) {
        throw new ConflictException( `Only a draft ${label} can be deleted; archive it instead` );
    }
}

/** Position for a new last child: one past the current maximum among `where`. */
export async function nextPosition<T extends ObjectLiteral & { position: number }>(
    manager: EntityManager,
    target: EntityTarget<T>,
    where: FindOptionsWhere<T>,
): Promise<number> {
    const max = await manager.maximum( target, 'position' as never, where );

    return ( max ?? 0 ) + 1;
}

/**
 * Checks `ids` lists every current child exactly once, so a reorder can't silently drop or invent children
 * (e.g. when two admins edit at once).
 */
export function assertSameChildren( ids: string[], currentIds: string[] ): void {
    const current = new Set( currentIds );

    if ( ids.length !== current.size || !ids.every( ( id ) => current.has( id ) ) ) {
        throw new BadRequestException( 'ids must list every current child exactly once' );
    }
}

/**
 * Sets `position` = 1..n in the order of `ids`, in one statement. `parent` limits the update to one
 * parent's children (null value: rows where the column is null, e.g. global learning paths).
 */
export async function writePositions(
    manager: EntityManager,
    table: string,
    ids: string[],
    parent: { column: string; value: string | null },
    idColumn = 'id',
): Promise<void> {
    if ( ids.length === 0 ) {
        return;
    }

    const parentCondition = parent.value === null ? `t."${parent.column}" IS NULL` : `t."${parent.column}" = $2`;

    await manager.query(
        `UPDATE "${table}" AS t SET position = o.position
         FROM unnest( $1::uuid[] ) WITH ORDINALITY AS o( id, position )
         WHERE t."${idColumn}" = o.id AND ${parentCondition}`,
        parent.value === null ? [ ids ] : [ ids, parent.value ],
    );
}
