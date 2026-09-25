import { OrderParentType } from '@studylog/schemas/enums';
import type { Relation } from 'typeorm';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { Enrollment } from './enrollment.entity.js';

/**
 * A user's own order for one parent's children. Children not listed (e.g. added by the admin later) follow in
 * the admin's order.
 */
@Entity( 'enrollment_orders' )
export class EnrollmentOrder {
    @PrimaryColumn( { name: 'enrollment_id', type: 'uuid' } )
    enrollmentId: string;

    @ManyToOne( () => Enrollment, ( enrollment ) => enrollment.orders, { onDelete: 'CASCADE' } )
    @JoinColumn( { name: 'enrollment_id' } )
    enrollment: Relation<Enrollment>;

    @PrimaryColumn( { name: 'parent_type', type: 'enum', enum: OrderParentType, enumName: 'order_parent_type' } )
    parentType: OrderParentType;

    @PrimaryColumn( { name: 'parent_id', type: 'uuid' } )
    parentId: string;

    @Column( { name: 'ordered_ids', type: 'uuid', array: true } )
    orderedIds: string[];
}
