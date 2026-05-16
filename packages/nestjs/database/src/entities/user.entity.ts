import { Column, Entity, Index } from 'typeorm'
import { IdTimestamppedEntity } from './id-timestampped.entity.js'

@Entity( 'users' )
export class UserEntity extends IdTimestamppedEntity {
    @Column( { type: 'varchar', unique: true } )
    @Index()
    email: string

    @Column( { unique: true, type: 'varchar' } )
    keycloakId: string

    @Column( { type: 'varchar', nullable: true } )
    firstName?: string

    @Column( { type: 'varchar', nullable: true } )
    lastName?: string

    @Column( {
        default: true,
        type: 'boolean',
        nullable: false
    } )
    isActive: boolean;
}
