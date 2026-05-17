import { Column, Entity, Index } from 'typeorm';
import { IdTimestamppedEntity } from './id-timestampped.entity.js';

@Entity( 'user_email_otps' )
export class UserEmailOtpEntity extends IdTimestamppedEntity {
    @Column( { type: 'varchar', length: 26, unique: true } )
    @Index()
    userId: string;

    @Column( { type: 'varchar' } )
    email: string;

    @Column( { type: 'varchar', length: 64 } )
    codeHash: string;

    @Column( { type: 'timestamptz' } )
    expiresAt: Date;
}
