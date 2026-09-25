import {
    CanActivate,
    createParamDecorator,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenPayload, AuthorizedRequest } from '@studylog/casl';
import type { Request } from 'express';

type AuthedRequest = Request & AuthorizedRequest;

@Injectable()
export class AuthGuard implements CanActivate {
    constructor( private readonly jwtService: JwtService ) {}

    async canActivate( context: ExecutionContext ): Promise<boolean> {
        const request = context.switchToHttp().getRequest<AuthedRequest>();
        const [ scheme, token ] = request.headers.authorization?.split( ' ' ) ?? [];

        if ( scheme !== 'Bearer' || !token ) {
            throw new UnauthorizedException();
        }
        try {
            request.user = await this.jwtService.verifyAsync<AccessTokenPayload>( token );
        } catch {
            throw new UnauthorizedException();
        }

        return true;
    }
}

/** The JWT payload of the logged-in user. Only use on routes protected by AuthGuard. */
export const CurrentUser = createParamDecorator(
    ( _data: unknown, context: ExecutionContext ): AccessTokenPayload =>
        context.switchToHttp().getRequest<AuthedRequest>().user!,
);
