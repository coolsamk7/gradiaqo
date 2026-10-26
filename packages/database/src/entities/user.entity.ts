import { PlatformRole } from '@studylog/schemas/enums';
import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity( 'users' )
export class User {
    @PrimaryGeneratedColumn( 'uuid' )
    id: string;

    // Always stored lowercase, so the unique index is effectively case-insensitive.
    @Column( { type: 'varchar', length: 255, unique: true } )
    email: string;

    @Column( { name: 'first_name', type: 'varchar', length: 100 } )
    firstName: string;

    @Column( { name: 'last_name', type: 'varchar', length: 100 } )
    lastName: string;

    // Excluded from queries by default so it can't leak into API responses.
    @Column( { name: 'password_hash', type: 'varchar', select: false } )
    passwordHash: string;

    // Never set from user input: signup always creates an application_user.
    @Column( {
        name: 'platform_role',
        type: 'enum',
        enum: PlatformRole,
        enumName: 'platform_role',
        default: PlatformRole.ApplicationUser,
    } )
    platformRole: PlatformRole;

    // Set when the user enters the code emailed to them (or resets their password with one).
    @Column( { name: 'email_verified_at', type: 'timestamptz', nullable: true } )
    emailVerifiedAt: Date | null;

    // Set at login and every time the access token is renewed, so it's at most a few minutes behind.
    @Column( { name: 'last_active_at', type: 'timestamptz', nullable: true } )
    lastActiveAt: Date | null;

    @CreateDateColumn( { name: 'created_at', type: 'timestamptz' } )
    createdAt: Date;

    @UpdateDateColumn( { name: 'updated_at', type: 'timestamptz' } )
    updatedAt: Date;
}
