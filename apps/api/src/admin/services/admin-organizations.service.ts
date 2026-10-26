import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { AdminOrganization, AdminOrganizationPage, ListOrganizationsQuery } from '@studylog/schemas';
import { DataSource } from 'typeorm';

type OrganizationRow = Omit<AdminOrganization, 'owners'>;
type OwnerRow = AdminOrganization['owners'][number] & { organizationId: string };

/*
 * $1: whether personal workspaces count; $2: an ILIKE pattern for the name or a member's email, or null.
 * Shared by the page and its total.
 */
const MATCHING = `
    FROM organizations org
    WHERE ( $1::boolean OR NOT org.is_personal )
      AND ( $2::text IS NULL OR org.name ILIKE $2 OR EXISTS (
          SELECT 1 FROM memberships m JOIN users u ON u.id = m.user_id
          WHERE m.organization_id = org.id AND u.email ILIKE $2
      ) )`;

/** Every organization, for superadmins handling abuse and support requests. Opening one uses the organizations API. */
@Injectable()
export class AdminOrganizationsService {
    constructor( @InjectDataSource() private readonly dataSource: DataSource ) {}

    /** Newest first; groups only, unless `personal` asks for personal workspaces too. */
    async list(
        { search, personal = false, limit = 50, offset = 0 }: ListOrganizationsQuery,
    ): Promise<AdminOrganizationPage> {
        // Match the text literally: % and _ are wildcards in ILIKE.
        const pattern = search?.trim() ? `%${search.trim().replace( /[\\%_]/g, '\\$&' )}%` : null;
        const [ rows, [ { total } ] ] = await Promise.all( [
            this.dataSource.query<OrganizationRow[]>(
                `SELECT org.id, org.name, org.is_personal AS "isPersonal", org.created_at AS "createdAt",
                        ( SELECT COUNT(*)::int FROM memberships m WHERE m.organization_id = org.id ) AS "memberCount",
                        ( SELECT COUNT(*)::int FROM learning_paths p WHERE p.organization_id = org.id ) AS "pathCount"
                 ${MATCHING}
                 ORDER BY org.created_at DESC, org.id ASC LIMIT $3 OFFSET $4`,
                [ personal, pattern, limit, offset ],
            ),
            this.dataSource.query<{ total: number }[]>( `SELECT COUNT(*)::int AS total ${MATCHING}`, [ personal, pattern ] ),
        ] );
        const owners = rows.length === 0
            ? []
            : await this.dataSource.query<OwnerRow[]>(
                    `SELECT m.organization_id AS "organizationId", u.id, u.first_name AS "firstName", u.last_name AS "lastName", u.email
                     FROM memberships m JOIN users u ON u.id = m.user_id
                     WHERE m.role = 'owner' AND m.organization_id = ANY( $1 )
                     ORDER BY m.created_at ASC`,
                    [ rows.map( ( row ) => row.id ) ],
                );

        return {
            items: rows.map( ( row ) => ( {
                ...row,
                owners: owners
                    .filter( ( owner ) => owner.organizationId === row.id )
                    .map( ( { organizationId: _, ...owner } ) => owner ),
            } ) ),
            total,
        };
    }
}
