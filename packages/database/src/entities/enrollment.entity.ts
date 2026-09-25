import { EnrollmentStatus } from '@studylog/schemas/enums';
import type { Relation } from 'typeorm';
import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    Unique,
    UpdateDateColumn,
} from 'typeorm';

import { EnrollmentOrder } from './enrollment-order.entity.js';
import { EnrollmentRule } from './enrollment-rule.entity.js';
import { LearningPath } from './learning-path.entity.js';
import { User } from './user.entity.js';

/**
 * A user following a learning path. Without rules it covers the whole path, including content the admin
 * adds later; rules narrow it down.
 */
@Entity( 'enrollments' )
@Unique( 'uq_enrollments_user_path', [ 'userId', 'learningPathId' ] )
export class Enrollment {
    @PrimaryGeneratedColumn( 'uuid' )
    id: string;

    // Covered by the unique (user, path) index.
    @Column( { name: 'user_id', type: 'uuid' } )
    userId: string;

    @ManyToOne( () => User, { onDelete: 'CASCADE' } )
    @JoinColumn( { name: 'user_id' } )
    user: Relation<User>;

    @Index()
    @Column( { name: 'learning_path_id', type: 'uuid' } )
    learningPathId: string;

    @ManyToOne( () => LearningPath, { onDelete: 'CASCADE' } )
    @JoinColumn( { name: 'learning_path_id' } )
    learningPath: Relation<LearningPath>;

    @Column( {
        type: 'enum',
        enum: EnrollmentStatus,
        enumName: 'enrollment_status',
        default: EnrollmentStatus.Active,
    } )
    status: EnrollmentStatus;

    // Order on the user's dashboard.
    @Column( { type: 'int', default: 0 } )
    position: number;

    @OneToMany( () => EnrollmentRule, ( rule ) => rule.enrollment )
    rules: Relation<EnrollmentRule[]>;

    @OneToMany( () => EnrollmentOrder, ( order ) => order.enrollment )
    orders: Relation<EnrollmentOrder[]>;

    @CreateDateColumn( { name: 'created_at', type: 'timestamptz' } )
    createdAt: Date;

    @UpdateDateColumn( { name: 'updated_at', type: 'timestamptz' } )
    updatedAt: Date;
}
