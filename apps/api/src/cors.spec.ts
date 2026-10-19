import { corsOptions, parseCorsOrigins } from './cors.js';

describe( 'parseCorsOrigins', () => {
    it( 'is empty when unset or blank', () => {
        expect( parseCorsOrigins( undefined ) ).toEqual( [] );
        expect( parseCorsOrigins( '  ' ) ).toEqual( [] );
    } );

    it( 'splits, trims and de-duplicates origins', () => {
        expect( parseCorsOrigins( ' http://localhost:5173 , https://app.example.com,,http://localhost:5173' ) )
            .toEqual( [ 'http://localhost:5173', 'https://app.example.com' ] );
    } );

    it.each( [
        '*',
        'https://app.example.com/',
        'https://app.example.com/login',
        'app.example.com',
        'ftp://files.example.com',
        'https://*.example.com',
        'https://APP.example.com',
    ] )( 'rejects %s', ( origin ) => {
        expect( () => parseCorsOrigins( origin ) ).toThrow( 'Invalid CORS_ORIGINS entry' );
    } );
} );

describe( 'corsOptions', () => {
    it( 'allows credentials and exposes the request id', () => {
        expect( corsOptions( [ 'http://localhost:5173' ] ) ).toMatchObject( {
            origin: [ 'http://localhost:5173' ],
            credentials: true,
            exposedHeaders: [ 'X-Request-Id', 'WWW-Authenticate' ],
        } );
    } );
} );
