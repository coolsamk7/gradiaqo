import { UserEntity } from '@gradiaqo/nestjs-database/entities';
import { InjectInngestService } from '@gradiaqo/nestjs-inngest';
import { KeycloakUserService } from '@gradiaqo/nestjs-keycloak-admin';
import { UserAuthStatus } from '@gradiaqo/nestjs-shared';
import type { MinionInngestClient } from '@gradiaqo/nestjs-shared';
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Static } from 'typebox';
import { DataSource } from 'typeorm';
import { SignupRequest, SignupResponse } from '../dtos';

@Injectable()
export class AuthService {
    constructor(
        @InjectInngestService() private readonly inngestService: MinionInngestClient,
        @InjectDataSource() private readonly datasource: DataSource,
        private readonly keycloakUserService: KeycloakUserService
    ) {}

    async signup( signupDto: Static<typeof SignupRequest> ): Promise<Static<typeof SignupResponse>> {
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
                    authStatus: UserAuthStatus.PENDING,
                    isActive: false
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
            firstName: user.firstName ?? signupDto.firstName,
            lastName: user.lastName ?? signupDto.lastName,
            authStatus: user.authStatus,
        };
    }
}
