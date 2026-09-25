import type { Relation } from 'typeorm';
import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

import { User } from './user.entity.js';

@Entity( 'organizations' )
export class Organization {
    @PrimaryGeneratedColumn( 'uuid' )
    id: string;

    @Column( { type: 'varchar', length: 100 } )
    name: string;

    // URL-friendly unique name, e.g. "sameers-workspace-3f9a1c".
    @Column( { type: 'varchar', length: 120, unique: true } )
    slug: string;

    // The workspace created automatically at signup. Every user has exactly one.
    @Column( { name: 'is_personal', type: 'boolean', default: false } )
    isPersonal: boolean;

    // Kept for history; the organization survives if its creator's account is deleted.
    @Column( { name: 'created_by_id', type: 'uuid', nullable: true } )
    createdById: string | null;

    @ManyToOne( () => User, { onDelete: 'SET NULL', nullable: true } )
    @JoinColumn( { name: 'created_by_id' } )
    createdBy: Relation<User> | null;

    @CreateDateColumn( { name: 'created_at', type: 'timestamptz' } )
    createdAt: Date;

    @UpdateDateColumn( { name: 'updated_at', type: 'timestamptz' } )
    updatedAt: Date;
}
