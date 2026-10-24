import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenPayload, AuthorizedRequest } from '@studylog/casl';
import type { Request, Response } from 'express';

export type AuthedRequest = Request & AuthorizedRequest;

@Injectable()
export class AuthGuard implements CanActivate {
    constructor( private readonly jwtService: JwtService ) {}

    async canActivate( context: ExecutionContext ): Promise<boolean> {
        const http = context.switchToHttp();
        const request = http.getRequest<AuthedRequest>();
        const [ scheme, token ] = request.headers.authorization?.split( ' ' ) ?? [];

        // WWW-Authenticate (RFC 6750) tells clients the access token is the problem, so they can renew it with
        // /auth/refresh and retry. Other 401s (e.g. a wrong password) don't send it.
        if ( scheme !== 'Bearer' || !token ) {
            http.getResponse<Response>().setHeader( 'WWW-Authenticate', 'Bearer' );
            throw new UnauthorizedException();
        }
        try {
            request.user = await this.jwtService.verifyAsync<AccessTokenPayload>( token );
        } catch {
            // Expired, or not signed by us.
            http.getResponse<Response>().setHeader( 'WWW-Authenticate', 'Bearer error="invalid_token"' );
            throw new UnauthorizedException();
        }

        return true;
    }
}
