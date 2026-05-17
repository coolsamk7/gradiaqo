import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { pascalCase, snakeCase } from 'change-case';

export const setupSwagger = async ( app: INestApplication ): Promise<void> => {
    const env = process.env;
    const builder = new DocumentBuilder();

    builder.setTitle( 'Gradiaqo API' ).setDescription( 'Gradiaqo apis.' ).setVersion( '1.0' ).addBearerAuth();

    if ( [ 'local', 'development' ].includes( env['NODE_ENV']! ) ) {
        builder.addServer( `http://localhost:${env['PORT']}` );
    } 
   
    const options = builder.build();

    const document = SwaggerModule.createDocument( app, options, {
        operationIdFactory: ( controllerKey, methodKey ) => {
            return `${snakeCase( controllerKey.replace( 'Controller', '' ) )}${pascalCase( methodKey )}`;
        },
    } );
    SwaggerModule.setup( 'openapi', app, document, {
        jsonDocumentUrl: 'openapi.json',
        yamlDocumentUrl: 'openapi.yaml',
        explorer: process.env.NODE_ENV !== 'production',
        swaggerOptions: {
            persistAuthorization: true,
        },
    } );
};
