import { Inject, Injectable } from "@nestjs/common";
import { KEYCLOAK_ADMIN_CLIENT } from "src/constants";
import KeycloakAdminClient from "@keycloak/keycloak-admin-client";

@Injectable()
export class KeycloakUserService {
    constructor(
        @Inject( KEYCLOAK_ADMIN_CLIENT )
        private readonly kc: KeycloakAdminClient
    ) {}
    .//TODO: Lets create realm dynamic
    async createUser( data: {
        email: string;
        password: string
    } ) {
        const user = await this.kc.users.create( {

        } )
    }
}
