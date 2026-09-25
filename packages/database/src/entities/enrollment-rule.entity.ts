import { RuleMode, RuleScope } from '@studylog/schemas/enums';
import type { Relation } from 'typeorm';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { Enrollment } from './enrollment.entity.js';

/**
 * Includes or excludes a module, topic or item (and everything under it) from an enrollment. The most specific
 * rule wins, so a user can include a module but exclude one topic in it.
 */
@Entity( 'enrollment_rules' )
export class EnrollmentRule {
    @PrimaryColumn( { name: 'enrollment_id', type: 'uuid' } )
    enrollmentId: string;

    @ManyToOne( () => Enrollment, ( enrollment ) => enrollment.rules, { onDelete: 'CASCADE' } )
    @JoinColumn( { name: 'enrollment_id' } )
    enrollment: Relation<Enrollment>;

    @PrimaryColumn( { type: 'enum', enum: RuleScope, enumName: 'rule_scope' } )
    scope: RuleScope;

    // The module, topic or item id (depending on `scope`), so there is no foreign key. Rules pointing at
    // content that's gone simply match nothing.
    @PrimaryColumn( { name: 'scope_id', type: 'uuid' } )
    scopeId: string;

    @Column( { type: 'enum', enum: RuleMode, enumName: 'rule_mode' } )
    mode: RuleMode;
}
