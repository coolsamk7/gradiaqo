import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata( IS_PUBLIC_KEY, true );

@Injectable()
export class PublicGuard implements CanActivate {
    constructor( private readonly reflector: Reflector ) {}

    canActivate( context: ExecutionContext ): boolean {
        const isPublic = this.reflector.getAllAndOverride<boolean>( IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ] );

        if ( isPublic ) {
            return true;
        }

        throw new UnauthorizedException( 'Authentication guard is not configured for this route.' );
    }
}
