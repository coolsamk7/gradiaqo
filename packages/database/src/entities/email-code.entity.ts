import { EmailCodePurpose } from '@studylog/schemas/enums';
import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
} from 'typeorm';

import { User } from './user.entity.js';

/**
 * A 6-digit code emailed to a user, to verify their email, reset their password or change their email. Only its
 * hash is kept. A new code for the same purpose replaces the old one, so each user has at most one live code per
 * purpose.
 */
@Entity( 'email_codes' )
@Unique( [ 'userId', 'purpose' ] )
export class EmailCode {
    @PrimaryGeneratedColumn( 'uuid' )
    id: string;

    @Column( { name: 'user_id', type: 'uuid' } )
    userId: string;

    @ManyToOne( () => User, { onDelete: 'CASCADE' } )
    @JoinColumn( { name: 'user_id' } )
    user: User;

    @Column( { type: 'enum', enum: EmailCodePurpose, enumName: 'email_code_purpose' } )
    purpose: EmailCodePurpose;

    @Column( { name: 'code_hash', type: 'varchar' } )
    codeHash: string;

    // For changing the email: the new address, which the code was sent to. It replaces the old one once the code
    // is entered.
    @Column( { name: 'new_email', type: 'varchar', length: 255, nullable: true } )
    newEmail: string | null;

    // Wrong guesses so far; the code is thrown away after too many.
    @Column( { type: 'smallint', default: 0 } )
    attempts: number;

    @Column( { name: 'expires_at', type: 'timestamptz' } )
    expiresAt: Date;

    // When it was sent, to keep resends apart.
    @CreateDateColumn( { name: 'created_at', type: 'timestamptz' } )
    createdAt: Date;
}
