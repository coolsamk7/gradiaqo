// interfaces/keycloak-module-options.interface.ts

export interface KeycloakModuleOptions {
    baseUrl: string;
    realm: string;

    auth: {
        grantType: 'password' | 'client_credentials';

        clientId: string;
        clientSecret?: string;

        username?: string;
        password?: string;
  };
}
