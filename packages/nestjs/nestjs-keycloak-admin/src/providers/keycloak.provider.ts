import KcAdminClient  from '@keycloak/keycloak-admin-client'
import { KEYCLOAK_ADMIN_CLIENT, KEYCLOAK_MODULE_OPTIONS } from '../constants/keycloak.constants.js'
import { KeycloakModuleOptions } from '../interfaces/keycloak-module-options.interface.js'

export const keycloakProvider = {
    provide: KEYCLOAK_ADMIN_CLIENT,
    useFactory: async(
        options: KeycloakModuleOptions
    ) => {
        const client = new KcAdminClient( {
            baseUrl: options.baseUrl, 
            realmName: options.realm
        } )
        if( options.auth.grantType === 'password' ) { 
            await client.auth( {
                username: options.auth.username!, 
                password: options.auth.password!, 
                grantType: options.auth.grantType, 
                clientId: options.auth.clientId
            } )
        }
        if( options.auth.grantType === 'client_credentials' ) {
            await client.auth( {
                clientId: options.auth.clientId, 
                clientSecret: options.auth.clientSecret!, 
                grantType: 'client_credentials'
            } )
        }
        return client
    },
    inject: [ KEYCLOAK_MODULE_OPTIONS ]
}
