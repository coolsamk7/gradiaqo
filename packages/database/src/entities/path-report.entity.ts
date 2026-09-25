import { ReportReason, ReportStatus } from '@studylog/schemas/enums';
import type { Relation } from 'typeorm';
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { LearningPath } from './learning-path.entity.js';
import { User } from './user.entity.js';

/** A user flagging someone else's public learning path for moderators. */
@Entity( 'path_reports' )
// One open report per user and path; they can report again after it's resolved.
@Index( 'uq_path_reports_open', [ 'learningPathId', 'reporterId' ], { unique: true, where: '"status" = \'open\'' } )
@Index( 'idx_path_reports_status_created', [ 'status', 'createdAt' ] )
export class PathReport {
    @PrimaryGeneratedColumn( 'uuid' )
    id: string;

    @Column( { name: 'learning_path_id', type: 'uuid' } )
    learningPathId: string;

    @ManyToOne( () => LearningPath, { onDelete: 'CASCADE' } )
    @JoinColumn( { name: 'learning_path_id' } )
    learningPath: Relation<LearningPath>;

    // Kept (as null) if the reporter deletes their account, so moderators still see the report.
    @Column( { name: 'reporter_id', type: 'uuid', nullable: true } )
    reporterId: string | null;

    @ManyToOne( () => User, { onDelete: 'SET NULL', nullable: true } )
    @JoinColumn( { name: 'reporter_id' } )
    reporter: Relation<User> | null;

    @Column( { type: 'enum', enum: ReportReason, enumName: 'report_reason' } )
    reason: ReportReason;

    @Column( { type: 'text', nullable: true } )
    details: string | null;

    @Column( { type: 'enum', enum: ReportStatus, enumName: 'report_status', default: ReportStatus.Open } )
    status: ReportStatus;

    @Column( { name: 'resolved_by_id', type: 'uuid', nullable: true } )
    resolvedById: string | null;

    @ManyToOne( () => User, { onDelete: 'SET NULL', nullable: true } )
    @JoinColumn( { name: 'resolved_by_id' } )
    resolvedBy: Relation<User> | null;

    @Column( { name: 'resolved_at', type: 'timestamptz', nullable: true } )
    resolvedAt: Date | null;

    @Column( { name: 'resolution_note', type: 'text', nullable: true } )
    resolutionNote: string | null;

    @CreateDateColumn( { name: 'created_at', type: 'timestamptz' } )
    createdAt: Date;
}
