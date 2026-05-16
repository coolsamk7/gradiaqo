import { DynamicModule, Module, Provider } from "@nestjs/common";
import { KeycloakModuleOptions } from "../interfaces/keycloak-module-options.interface.js";
import { KeyclaokModuleAsyncOptions, KeycloakModuleFactory  } from '../interfaces/keycloak-module-async-options.interface.js'
import { KEYCLOAK_MODULE_OPTIONS } from "../constants/keycloak.constants.js";
import { keycloakProvider } from "../providers/keycloak.provider.js";

@Module( {} )
export class KeycloakModule {

    static forRoot(
        options: KeycloakModuleOptions
    ): DynamicModule {
       return {
            module: KeycloakModule,
            providers: [
                {
                    provide: KEYCLOAK_MODULE_OPTIONS,
                    useValue: options
                },
                keycloakProvider
            ],
            exports: [ KEYCLOAK_MODULE_OPTIONS, keycloakProvider ]
        } 
    }
    static forRootAsync(
        options: KeyclaokModuleAsyncOptions
    ): DynamicModule {
        return {
            module: KeycloakModule,
            imports: options.imports || [],
            providers: [
                ...this.createAsyncProviders( options )
            ]
        }
    }

    private static createAsyncProviders (
        options: KeyclaokModuleAsyncOptions
    ): Provider[] {

        if( options.useFactory ) {
            return[
                {
                    provide: KEYCLOAK_MODULE_OPTIONS,
                    useFactory: options.useFactory,
                    inject: options.inject || []
                }
            ] 
        }
        const inject = options.useExisting || options.useClass;
        return [
            {
                provide: KEYCLOAK_MODULE_OPTIONS,
                useFactory: async (
                    factory: KeycloakModuleFactory
                ) => await factory.createkeycloakOptions(),
                inject: [ inject! ]
            },
            ...( options.useClass
                ? [
                    {
                        provide: options.useClass,
                        useClass: options.useClass
                    }
                ]: [] )
        ]

    }
}
