import { UserEntity } from "@gradiaqo/nestjs-database/entities";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { KeycloakModule } from "@gradiaqo/nestjs-keycloak-admin";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthController } from "./controller";
import { AuthService } from "./service";

@Module( {
    imports: [
        TypeOrmModule.forFeature( [ UserEntity ] ),
        KeycloakModule.forRootAsync( {
            imports: [ ConfigModule ],
            inject: [ ConfigService ],
            useFactory( configService: ConfigService ) {
                return configService.getOrThrow( 'keycloak.config' );
            },
        } ),
    ],
    controllers:[
        AuthController
    ],
    providers: [ AuthService ]
} )
export class AuthModule {

}
