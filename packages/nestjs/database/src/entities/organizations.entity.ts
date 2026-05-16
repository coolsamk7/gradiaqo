import { Column, Entity } from "typeorm";
import { IdTimestamppedEntity } from "./id-timestampped.entity.js";
import { OrganizationType } from "@gradiaqo/nestjs-shared";


@Entity( 'organizations' )
export class OrganizationsEntity extends IdTimestamppedEntity {

    @Column( {
        unique: true,
        type: 'varchar'
    } )
    slug: string;

    @Column( { type: 'varchar', nullable: false } )
    name: string

    @Column( {
        type: 'enum',
        enum: OrganizationType,
    } )
    type: OrganizationType;

    @Column( {
        nullable: true,
        type: 'varchar'
    } )
    logo?: string;

    @Column( {
        type: 'text',
        nullable: true
    } )
    description?: string;

    @Column( {
        type: 'boolean',
        default: false,
    } )
    verified: boolean;
}
