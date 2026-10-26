import type { AdminOrganizationJson } from '@studylog/schemas';

import { organizationsUrl, ownersLabel } from './organizations.ts';

const owner = ( firstName: string ) => ( { id: firstName, firstName, lastName: 'Tester', email: `${firstName}@example.com` } );
const organization = ( owners: AdminOrganizationJson['owners'] ) => ( { owners } ) as AdminOrganizationJson;

describe( 'organizations', () => {
    it( 'asks the API for one page of the filtered organizations', () => {
        expect( organizationsUrl( { search: '', personal: false, offset: 0 } ) ).toBe( '/admin/organizations?limit=50' );
        expect( organizationsUrl( { search: 'study club', personal: true, offset: 50 } ) )
            .toBe( '/admin/organizations?search=study+club&personal=true&limit=50&offset=50' );
    } );

    it( 'names the owner, and how many more there are', () => {
        expect( ownersLabel( organization( [] ) ) ).toBe( 'No owner' );
        expect( ownersLabel( organization( [ owner( 'Alice' ) ] ) ) ).toBe( 'Alice Tester' );
        expect( ownersLabel( organization( [ owner( 'Alice' ), owner( 'Bob' ), owner( 'Carol' ) ] ) ) ).toBe( 'Alice Tester +2' );
    } );
} );
