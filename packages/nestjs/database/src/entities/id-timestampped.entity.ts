import { BeforeInsert, CreateDateColumn, DeleteDateColumn, PrimaryColumn, UpdateDateColumn } from 'typeorm'
import { ulid } from 'ulid'

export class IdTimestamppedEntity {
    @PrimaryColumn( { type: 'varchar', length: 26 } )
    id: string

    @CreateDateColumn()
    createdAt: Date

    @UpdateDateColumn()
    updatedAt: Date

    @DeleteDateColumn()
    deletedAt: Date

    @BeforeInsert()
    setId() {
        if ( !this.id ) {
            console.log( this.id, ulid() )
            this.id = ulid()
        }
    }
}
