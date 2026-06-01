import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { json, urlencoded } from 'express';
import { VersioningType } from '@nestjs/common';
import { setupSwagger } from './utils';
import { apiReference } from '@scalar/nestjs-api-reference';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>( AppModule, { bufferLogs: true } );
    const configService = app.get<ConfigService>( ConfigService );
    const logger = app.get<Logger>( Logger );
    app.useLogger( logger );

    app.enableShutdownHooks();

    app.enableCors( {
        origin: configService.get<string>( 'CORS_ORIGINS', '*' ),
        credentials: true,
        methods: 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS',
        allowedHeaders: 'Content-Type,Authorization,Accept'
    } );

    app.use( json( { limit: '50mb' } ) );
    app.use( urlencoded( { extended: true, limit: '50mb' } ) );
    
    app.enableVersioning( {
        type: VersioningType.URI
    } )

    await setupSwagger( app );
    app.use(
        '/reference',
        apiReference( {
            theme: 'mars',
            url: '/openapi.json',
            _integration: 'nestjs',
        } ),
    );


    const HOST = configService.get<string>( 'HOST', 'localhost' );
    
    const PORT = +configService.get<string>( 'PORT', '3000' );
    await app.listen( PORT, HOST, () => {
        logger.log( `Application started listening at http://${HOST}:${PORT}` );
    } );
}

void bootstrap();
