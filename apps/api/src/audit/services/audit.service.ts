import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { AuditAction } from '@studylog/database';
import { AuditEvent, User } from '@studylog/database';
import type { AuditPage, ListAuditQuery } from '@studylog/schemas';
import { AUDIT_AREAS } from '@studylog/schemas';
import { DataSource, In } from 'typeorm';

export interface AuditEntry {
    /** The superadmin who did it. */
    actorId: string;
    action: AuditAction;
    targetId: string;
    /** The target's email or title now, so the log reads right after it changes. */
    targetLabel: string;
    note?: string | null;
}

/** Records what superadmins do, and lists it for Admin › Audit log. */
@Injectable()
export class AuditService {
    constructor( @InjectDataSource() private readonly dataSource: DataSource ) {}

    async record( { actorId, action, targetId, targetLabel, note = null }: AuditEntry ): Promise<void> {
        const actor = await this.dataSource.getRepository( User ).findOneBy( { id: actorId } );
        const events = this.dataSource.getRepository( AuditEvent );

        await events.insert( events.create( {
            actorId,
            // A token can outlive its user by a few minutes.
            actorName: actor ? `${actor.firstName} ${actor.lastName}` : 'A deleted account',
            action,
            targetId,
            targetLabel,
            note,
        } ) );
    }

    /** Newest first, optionally for one area of Admin (users, catalog or moderation). */
    async list( { area, limit = 50, offset = 0 }: ListAuditQuery ): Promise<AuditPage> {
        const [ events, total ] = await this.dataSource.getRepository( AuditEvent ).findAndCount( {
            ...( area ? { where: { action: In( AUDIT_AREAS[area] ) } } : {} ),
            order: { createdAt: 'DESC', id: 'ASC' },
            take: limit,
            skip: offset,
        } );

        return {
            items: events.map( ( event ) => ( {
                id: event.id,
                action: event.action,
                actor: { id: event.actorId, name: event.actorName },
                targetId: event.targetId,
                targetLabel: event.targetLabel,
                note: event.note,
                createdAt: event.createdAt,
            } ) ),
            total,
        };
    }
}
