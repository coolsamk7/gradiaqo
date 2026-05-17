import { Inject, Injectable } from '@nestjs/common';
import KeycloakAdminClient from '@keycloak/keycloak-admin-client';
import { KEYCLOAK_ADMIN_CLIENT, KEYCLOAK_MODULE_OPTIONS } from '../constants/keycloak.constants.js';
import type { KeycloakModuleOptions } from '../interfaces/keycloak-module-options.interface.js';

@Injectable()
export class KeycloakUserService {
    constructor(
        @Inject( KEYCLOAK_ADMIN_CLIENT )
        private readonly kc: KeycloakAdminClient,
        @Inject( KEYCLOAK_MODULE_OPTIONS )
        private readonly options: KeycloakModuleOptions
    ) {}

    private async authenticate() {
        if ( this.options.auth.grantType === 'password' ) {
            await this.kc.auth( {
                username: this.options.auth.username!,
                password: this.options.auth.password!,
                grantType: 'password',
                clientId: this.options.auth.clientId,
            } );
            return;
        }

        await this.kc.auth( {
            clientId: this.options.auth.clientId,
            clientSecret: this.options.auth.clientSecret!,
            grantType: 'client_credentials',
        } );
    }

    async createUser( data: {
        email: string;
        password: string;
        firstName?: string;
        lastName?: string;
    } ) {
        await this.authenticate();

        return this.kc.users.create( {
            email: data.email,
            username: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            enabled: true,
            emailVerified: false,
            credentials: [
                {
                    type: 'password',
                    value: data.password,
                    temporary: false,
                },
            ],
        } );
    }

    async deleteUser( userId: string ) {
        await this.authenticate();

        await this.kc.users.del( {
            id: userId,
        } );
    }
}
