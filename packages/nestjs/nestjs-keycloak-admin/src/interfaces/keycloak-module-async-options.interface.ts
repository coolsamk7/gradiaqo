import { Type, ModuleMetadata } from '@nestjs/common';
import { KeycloakModuleOptions } from './keycloak-module-options.interface.js';
import { KeycloakModule } from '../module/keycloak.module.js';

export interface KeycloakModuleFactory {
    createkeycloakOptions(): 
        | Promise<KeycloakModuleOptions>
        | KeycloakModuleOptions
}

export interface KeyclaokModuleAsyncOptions 
    extends Pick<ModuleMetadata, 'imports'> {
    useExisting?: Type<KeycloakModuleFactory>;
    useClass?: Type<KeycloakModule>;
    useFactory?: (
        ...args: any[]
    ) => 
        | Promise<KeycloakModuleOptions>
        | KeycloakModuleOptions;
    inject: []
}
