import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';

import { AuthGuard } from '../../../../src/auth/guards/auth.guard.js';

function contextFor( request: object, response = { setHeader: vi.fn() } ): ExecutionContext {
    const http = { getRequest: () => request, getResponse: () => response };

    return { switchToHttp: () => http } as unknown as ExecutionContext;
}

describe( 'AuthGuard', () => {
    const payload = { sub: 'user-1', email: 'sam@example.com', platformRole: 'application_user' };
    const jwt = {
        verifyAsync: vi.fn( ( token: string ) =>
            ( token === 'good' ? Promise.resolve( payload ) : Promise.reject( new Error( 'invalid signature' ) ) ) ),
    };
    const guard = new AuthGuard( jwt as unknown as JwtService );

    it.each( [
        [ 'no header', undefined, 'Bearer' ],
        [ 'another scheme', 'Basic good', 'Bearer' ],
        [ 'no token', 'Bearer', 'Bearer' ],
        [ 'a bad or expired token', 'Bearer forged', 'Bearer error="invalid_token"' ],
    ] )( 'rejects %s, telling the client to renew its token', async ( _, authorization, challenge ) => {
        const response = { setHeader: vi.fn() };

        await expect( guard.canActivate( contextFor( { headers: { authorization } }, response ) ) )
            .rejects.toThrow( UnauthorizedException );
        expect( response.setHeader ).toHaveBeenCalledExactlyOnceWith( 'WWW-Authenticate', challenge );
    } );

    it( 'attaches the token payload as request.user', async () => {
        const request: { headers: object; user?: unknown } = { headers: { authorization: 'Bearer good' } };

        await expect( guard.canActivate( contextFor( request ) ) ).resolves.toBe( true );
        expect( request.user ).toEqual( payload );
    } );
} );
