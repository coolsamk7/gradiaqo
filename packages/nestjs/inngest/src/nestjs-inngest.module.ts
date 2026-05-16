import { DiscoveryModule, DiscoveryService } from '@golevelup/nestjs-discovery'
import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { Inngest } from 'inngest'
import { serve } from 'inngest/express'
import {
    NESTJS_INNGEST_OPTIONS_TOKEN,
    NESTJS_INNGEST_OPTIONS_TYPE,
    NestJsInngestConfigurableModuleClass,
} from './configurable.module'
import { INNGEST_FUNCTION, INNGEST_KEY } from './constants'
import { CreateFunctionArg, CreateFunctionOptions } from './types'

@Module( {
    imports: [ DiscoveryModule ],
    providers: [
        {
            provide: INNGEST_KEY,
            inject: [ NESTJS_INNGEST_OPTIONS_TOKEN ],
            useFactory( options: typeof NESTJS_INNGEST_OPTIONS_TYPE ) {
                return new Inngest( options.clientOptions )
            },
        },
    ],
    exports: [ INNGEST_KEY ],
} )
export class NestjsInngestModule extends NestJsInngestConfigurableModuleClass implements NestModule {
    constructor(
        @Inject( INNGEST_KEY ) private readonly inngest: Inngest,
        @Inject( NESTJS_INNGEST_OPTIONS_TOKEN ) private readonly options: typeof NESTJS_INNGEST_OPTIONS_TYPE,
        @Inject( DiscoveryService ) private readonly discover: DiscoveryService,
    ) {
        super()
    }

    async configure( consumer: MiddlewareConsumer ) {
        if ( this.options.serveOptions ) {
            const functions =
                await this.discover.providerMethodsWithMetaAtKey<[CreateFunctionArg, CreateFunctionOptions]>(
                    INNGEST_FUNCTION,
                )
            const handlers = functions
                .map( ( { meta, discoveredMethod } ) => {
                    const [ arg, options ] = meta
                    let filter: boolean = true
                    if ( Array.isArray( this.options.functions ) && this.options.functions.length ) {
                        if ( !this.options.functions.includes( arg.id ) ) {
                            filter = false
                        }
                    }
                    if ( filter ) {
                        return this.inngest.createFunction(
                            arg,
                            options,
                            discoveredMethod.handler.bind( discoveredMethod.parentClass.instance ),
                        )
                    }
                    return undefined
                } )
                .filter( Boolean )
            consumer
                .apply(
                    serve( {
                        ...this.options.serveOptions,
                        client: this.inngest,
                        functions: handlers as any,
                    } ),
                )
                .forRoutes( this.options.serveOptions.servePath ?? '/api/inngest' )
        }
    }
}
