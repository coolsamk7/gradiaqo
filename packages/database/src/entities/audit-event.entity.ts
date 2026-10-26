import { AuditAction } from '@studylog/schemas/enums';
import type { Relation } from 'typeorm';
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { User } from './user.entity.js';

/**
 * Something a superadmin did: who, what, to what, and when. Names are copied when it happens, so the log still reads
 * right after the admin, the user or the path is renamed or deleted.
 */
@Entity( 'audit_events' )
@Index( 'idx_audit_events_created', [ 'createdAt' ] )
export class AuditEvent {
    @PrimaryGeneratedColumn( 'uuid' )
    id: string;

    @Column( { name: 'actor_id', type: 'uuid', nullable: true } )
    actorId: string | null;

    @ManyToOne( () => User, { onDelete: 'SET NULL', nullable: true } )
    @JoinColumn( { name: 'actor_id' } )
    actor: Relation<User> | null;

    @Column( { name: 'actor_name', type: 'varchar', length: 201 } )
    actorName: string;

    @Column( { type: 'enum', enum: AuditAction, enumName: 'audit_action' } )
    action: AuditAction;

    // Not a foreign key: the user, path or item may be deleted (that is often the event).
    @Column( { name: 'target_id', type: 'uuid' } )
    targetId: string;

    /** The target's email or title at the time. */
    @Column( { name: 'target_label', type: 'varchar', length: 255 } )
    targetLabel: string;

    /** E.g. the moderator's note on a report. */
    @Column( { type: 'text', nullable: true } )
    note: string | null;

    @CreateDateColumn( { name: 'created_at', type: 'timestamptz' } )
    createdAt: Date;
}
