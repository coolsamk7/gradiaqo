import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { PublicGuard } from 'src/guards/public.guard';

function createExecutionContext(): ExecutionContext {
    return {
        getHandler: jest.fn(),
        getClass: jest.fn(),
    } as unknown as ExecutionContext;
}

describe( 'PublicGuard', () => {
    async function createGuard( isPublic: boolean ) {
        const reflector = {
            getAllAndOverride: jest.fn().mockReturnValue( isPublic ),
        };

        const module = await Test.createTestingModule( {
            providers: [
                PublicGuard,
                {
                    provide: Reflector,
                    useValue: reflector,
                },
            ],
        } ).compile();

        return {
            guard: module.get( PublicGuard ),
            reflector,
        };
    }

    it( 'allows routes marked as public', async () => {
        const { guard } = await createGuard( true );

        expect( guard.canActivate( createExecutionContext() ) ).toBe( true );
    } );

    it( 'rejects routes that are not public until auth is configured', async () => {
        const { guard } = await createGuard( false );

        expect( () => guard.canActivate( createExecutionContext() ) )
            .toThrow( UnauthorizedException );
    } );
} );
