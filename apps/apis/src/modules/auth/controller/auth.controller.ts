import { Body, ConflictException, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { SignupRequest } from '../dtos/singup.dto';
import type { Static } from 'typebox';
import { Public } from 'src/guards/public.guard';
import { InjectInngestService } from '@gradiaqo/nestjs-inngest';
import type { MinionInngestClient } from '@gradiaqo/nestjs-shared';
import { UserAuthStatus } from '@gradiaqo/nestjs-shared';
import { KeycloakUserService } from '@gradiaqo/nestjs-keycloak-admin';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UserEntity } from '@gradiaqo/nestjs-database/entities';

@ApiTags( 'Auth' )
@Controller( { path: 'auth', version: '1' } )
export class AuthController {
    constructor(
        @InjectInngestService() private readonly inngestService: MinionInngestClient,
        @InjectDataSource() private readonly datasource: DataSource,
        private readonly keycloakUserService: KeycloakUserService
    ) {}

    @Post( 'sigup' )
    @ApiBody( { schema: SignupRequest } )
    @Public()
    async singup( @Body() signupDto: Static<typeof SignupRequest> ) {
        const userRepository = this.datasource.getRepository( UserEntity );
        const existingUser = await userRepository.existsBy( {
            email: signupDto.email,
        } );

        if ( existingUser ) {
            throw new ConflictException( 'User with this email already exists.' );
        }

        const keycloakUser = await this.keycloakUserService.createUser( {
            email: signupDto.email,
            password: signupDto.password,
            firstName: signupDto.firstName,
            lastName: signupDto.lastName,
        } );

        let user: UserEntity;
        try {
            user = await userRepository.save(
                userRepository.create( {
                    email: signupDto.email,
                    keycloakId: keycloakUser.id,
                    firstName: signupDto.firstName,
                    lastName: signupDto.lastName,
                    authStatus: UserAuthStatus.ACTIVE,
                } )
            );
        } catch ( error ) {
            await this.keycloakUserService.deleteUser( keycloakUser.id );
            throw error;
        }

        await this.inngestService.send( {
            name: 'users/user.created',
            data: {
                id: user.id,
                email: user.email,
            },
        } );

        return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            authStatus: user.authStatus,
        };
    }
}
