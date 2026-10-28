import { THROTTLER_LIMIT, THROTTLER_TTL } from '@nestjs/throttler/dist/throttler.constants.js';

import { AuthController } from '../../src/auth/controllers/auth.controller.js';
import { PathImportController } from '../../src/catalog/controllers/path-import.controller.js';
import { PathReportsController } from '../../src/moderation/controllers/reports.controller.js';
import { OrganizationInvitationsController } from '../../src/organizations/controllers/invitations.controller.js';
import { RATE_LIMITS } from '../../src/rate-limits.js';

/** The limit a route handler declares for the default throttler, if any. */
function limitOf( controller: { prototype: object }, method: string ) {
    const handler = ( controller.prototype as Record<string, object> )[method];

    return {
        limit: Reflect.getMetadata( `${THROTTLER_LIMIT}default`, handler ) as number | undefined,
        ttl: Reflect.getMetadata( `${THROTTLER_TTL}default`, handler ) as number | undefined,
    };
}

describe( 'rate limits', () => {
    it.each( [
        [ AuthController, 'login', RATE_LIMITS.login ],
        [ AuthController, 'signup', RATE_LIMITS.signup ],
        [ AuthController, 'refresh', RATE_LIMITS.refresh ],
        [ AuthController, 'changePassword', RATE_LIMITS.sensitive ],
        [ AuthController, 'deleteAccount', RATE_LIMITS.sensitive ],
        [ OrganizationInvitationsController, 'create', RATE_LIMITS.invite ],
        [ PathReportsController, 'create', RATE_LIMITS.report ],
        [ PathImportController, 'import', RATE_LIMITS.import ],
    ] )( '%o.%s has its tighter limit', ( controller, method, expected ) => {
        expect( limitOf( controller, method ) ).toEqual( expected );
    } );

    it( 'the tight limits are really tighter than the default', () => {
        const perMinute = ( { limit, ttl }: { limit: number; ttl: number } ) => limit / ( ttl / 60_000 );

        for ( const [ name, rule ] of Object.entries( RATE_LIMITS ) ) {
            if ( name !== 'default' ) {
                expect( perMinute( rule ) ).toBeLessThan( perMinute( RATE_LIMITS.default ) );
            }
        }
    } );
} );
