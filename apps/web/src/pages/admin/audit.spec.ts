import type { AuditEventJson } from '@studylog/schemas';
import { AuditArea } from '@studylog/schemas';
import { AuditAction } from '@studylog/schemas/enums';

import { auditSentence, auditUrl, when } from './audit.ts';

const event = ( action: AuditAction, targetLabel = 'Graphs' ): AuditEventJson => ( {
    id: 'e',
    action,
    actor: { id: 'a', name: 'Ada Admin' },
    targetId: 't',
    targetLabel,
    note: null,
    createdAt: new Date( 2026, 9, 26, 9, 22 ).toISOString(),
} );

describe( 'audit', () => {
    it( 'says what happened, in words', () => {
        expect( Object.values( AuditAction ).map( ( action ) =>
            auditSentence( event( action, action.startsWith( 'user' ) ? 'sam@example.com' : 'Graphs' ) ) ) ).toEqual( [
            'made sam@example.com a superadmin',
            'made sam@example.com a normal user',
            'removed the account sam@example.com',
            'published the path “Graphs”',
            'moved the path “Graphs” to draft',
            'archived the path “Graphs”',
            'deleted the path “Graphs”',
            'imported the path “Graphs” from a file',
            'published the item “Graphs”',
            'moved the item “Graphs” to draft',
            'archived the item “Graphs”',
            'deleted the item “Graphs”',
            'dismissed a report on “Graphs”',
            'hid “Graphs” from the public catalog',
            'un-hid “Graphs”',
        ] );
    } );

    it( 'says when', () => {
        expect( when( event( AuditAction.PathHidden ), new Date( 2026, 9, 26, 12 ) ) ).toBe( 'Today, 9:22 AM' );
    } );

    it( 'asks the API for one page of one area', () => {
        expect( auditUrl( '', 0 ) ).toBe( '/admin/audit?limit=50' );
        expect( auditUrl( AuditArea.Moderation, 50 ) ).toBe( '/admin/audit?area=moderation&limit=50&offset=50' );
    } );
} );
