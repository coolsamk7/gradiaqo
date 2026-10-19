import type { Relation } from 'typeorm';
import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';

import { User } from './user.entity.js';

/**
 * What a user is preparing for: a title, a date, and the paths (their enrollments) that count. One per user.
 * Enrollment ids aren't foreign keys: ones the user has since left are ignored when readiness is computed.
 */
@Entity( 'interview_goals' )
export class InterviewGoal {
    @PrimaryColumn( { name: 'user_id', type: 'uuid' } )
    userId: string;

    @OneToOne( () => User, { onDelete: 'CASCADE' } )
    @JoinColumn( { name: 'user_id' } )
    user: Relation<User>;

    @Column( { type: 'varchar', length: 100 } )
    title: string;

    @Column( { name: 'target_date', type: 'date' } )
    targetDate: string;

    @Column( { name: 'enrollment_ids', type: 'uuid', array: true } )
    enrollmentIds: string[];

    @CreateDateColumn( { name: 'created_at', type: 'timestamptz' } )
    createdAt: Date;

    @UpdateDateColumn( { name: 'updated_at', type: 'timestamptz' } )
    updatedAt: Date;
}
