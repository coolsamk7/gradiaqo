import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';

import { AuthGuard } from './auth.guard.js';

function contextFor( request: object ): ExecutionContext {
    return { switchToHttp: () => ( { getRequest: () => request } ) } as unknown as ExecutionContext;
}

describe( 'AuthGuard', () => {
    const payload = { sub: 'user-1', email: 'sam@example.com', platformRole: 'application_user' };
    const jwt = {
        verifyAsync: vi.fn( ( token: string ) =>
            ( token === 'good' ? Promise.resolve( payload ) : Promise.reject( new Error( 'invalid signature' ) ) ) ),
    };
    const guard = new AuthGuard( jwt as unknown as JwtService );

    it.each( [
        [ 'no header', undefined ],
        [ 'another scheme', 'Basic good' ],
        [ 'no token', 'Bearer' ],
        [ 'a bad token', 'Bearer forged' ],
    ] )( 'rejects %s', async ( _, authorization ) => {
        const request = { headers: { authorization } };

        await expect( guard.canActivate( contextFor( request ) ) ).rejects.toThrow( UnauthorizedException );
    } );

    it( 'attaches the token payload as request.user', async () => {
        const request: { headers: object; user?: unknown } = { headers: { authorization: 'Bearer good' } };

        await expect( guard.canActivate( contextFor( request ) ) ).resolves.toBe( true );
        expect( request.user ).toEqual( payload );
    } );
} );
