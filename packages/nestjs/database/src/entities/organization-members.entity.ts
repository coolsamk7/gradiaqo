import { Column, CreateDateColumn, Entity, ManyToOne, Unique } from "typeorm";
import { IdTimestamppedEntity } from "./id-timestampped.entity.js";
import { UserEntity } from "./user.entity.js";
import { OrganizationsEntity } from "./organizations.entity.js";
import { OrganizationRole } from "@gradiaqo/nestjs-shared";


@Entity( 'organization_members' )
@Unique( [ 'user', 'organization' ] )
export class OrganizationMember extends IdTimestamppedEntity {

    @ManyToOne( () => UserEntity, {
        nullable: false,
        onDelete: 'CASCADE',
    } )
    user: UserEntity;

    @ManyToOne( () => OrganizationsEntity, {
        nullable: false,
        onDelete: 'CASCADE',
    } )
    organization: OrganizationsEntity;

    @Column( {
        type: 'enum',
        enum: OrganizationRole,
    } )
    role: OrganizationRole;

    @Column( {
        default: true,
    } )
    isActive: boolean;

    @CreateDateColumn()
    joinedAt: Date;
}
