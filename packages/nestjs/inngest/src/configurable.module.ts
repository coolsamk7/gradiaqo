import { ConfigurableModuleBuilder } from '@nestjs/common';
import { ClientOptions, ServeHandlerOptions } from 'inngest';

export interface NestJsInngestOptions {
    clientOptions: ClientOptions;
    serveOptions?: Omit<ServeHandlerOptions, 'functions' | 'client'>;
    functions?: string[];
}

export const {
    OPTIONS_TYPE: NESTJS_INNGEST_OPTIONS_TYPE,
    ASYNC_OPTIONS_TYPE: NESTJS_INNGEST_ASYNC_OPTIONS_TYPE,
    MODULE_OPTIONS_TOKEN: NESTJS_INNGEST_OPTIONS_TOKEN,
    ConfigurableModuleClass: NestJsInngestConfigurableModuleClass,
} = new ConfigurableModuleBuilder<NestJsInngestOptions>()
    .setClassMethodName( 'forRoot' )
    .setExtras( { global: true }, ( def, { global } ) => {
        return {
            ...def,
            global,
        };
    } )
    .build();
