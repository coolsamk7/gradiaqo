import { registerAs } from '@nestjs/config';
import { KeycloakModuleOptions } from '@gradiaqo/nestjs-keycloak-admin';

export const keycloakConfig = registerAs( 'keycloak.config', (): KeycloakModuleOptions => {
    const env = process.env;
    const requiredKeys = [
        'KEYCLOAK_BASE_URL',
        'KEYCLOAK_REALM',
        'KEYCLOAK_CLIENT_ID',
        'KEYCLOAK_CLIENT_SECRET',
    ] as const;

    const missingKeys = requiredKeys.filter( ( key ) => !env[key]?.trim() );
    if ( missingKeys.length ) {
        throw new Error( `Missing Keycloak configuration: ${missingKeys.join( ', ' )}` );
    }

    return {
        baseUrl: env['KEYCLOAK_BASE_URL']!,
        realm: env['KEYCLOAK_REALM']!,
        auth: {
            grantType: 'client_credentials',
            clientId: env['KEYCLOAK_CLIENT_ID']!,
            clientSecret: env['KEYCLOAK_CLIENT_SECRET']!,
        },
    };
} );
