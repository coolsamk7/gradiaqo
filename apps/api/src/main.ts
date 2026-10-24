import { TypeboxValidationPipe } from '@gradiaqo/nestjs-typebox';
import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from '@studylog/logger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import { REFRESH_COOKIE } from './auth/controllers/auth.controller.js';
import { appConfig } from './config/app.config.js';
import { corsOptions } from './cors.js';

async function bootstrap() {
    // Buffer startup logs until pino is ready, then route all Nest logs through it.
    const app = await NestFactory.create<NestExpressApplication>( AppModule, { bufferLogs: true } );

    app.useLogger( app.get( PinoLogger ) );

    // Settings were validated and converted at startup (config/env.ts).
    const { port, trustProxy, corsOrigins, swaggerEnabled } = app.get<ConfigType<typeof appConfig>>( appConfig.KEY );

    // Behind a load balancer, take the client IP (for rate limits and logs) from X-Forwarded-For.
    if ( trustProxy > 0 ) {
        app.set( 'trust proxy', trustProxy );
    }

    // Security headers (no sniffing, no framing, HSTS, a strict Content-Security-Policy, ...).
    app.use( helmet() );

    if ( corsOrigins.length > 0 ) {
        app.enableCors( corsOptions( corsOrigins ) );
    }

    app.use( cookieParser() );
    // Validates `@Body( { schema } )` / `@Query( { schema } )` / `@Param( name, { schema } )` with TypeBox.
    app.useGlobalPipes( new TypeboxValidationPipe() );

    if ( swaggerEnabled ) {
        setupSwagger( app );
    }

    await app.listen( port );

    const baseUrl = `http://localhost:${port}`;
    const logger = new Logger( 'Bootstrap' );

    logger.log( `API running at ${baseUrl}` );
    logger.log( swaggerEnabled ? `Swagger docs at ${baseUrl}/docs` : 'Swagger docs disabled (SWAGGER_ENABLED=false)' );
    logger.log( corsOrigins.length > 0
        ? `CORS allowed for ${corsOrigins.join( ', ' )}`
        : 'CORS disabled: no browser app on another origin can call the API (set CORS_ORIGINS)' );
}

function setupSwagger( app: INestApplication ) {
    const config = new DocumentBuilder()
        .setTitle( 'StudyLog API' )
        .setDescription(
            'Log in with /auth/login, then click Authorize and paste the accessToken. '
            + 'The refresh cookie is set automatically, so /auth/refresh works from this page too.',
        )
        .setVersion( '0.1.0' )
        .addBearerAuth()
        .addCookieAuth( REFRESH_COOKIE )
        .build();
    const document = SwaggerModule.createDocument( app, config );

    SwaggerModule.setup( 'docs', app, document, {
        jsonDocumentUrl: 'docs/json',
        swaggerOptions: { persistAuthorization: true },
    } );
}

await bootstrap();
