import type { ConfigService } from '@nestjs/config';

import { DatabaseService } from './database.service.js';

const connection = vi.hoisted( () => ( {
    initialize: vi.fn(),
    destroy: vi.fn(),
    /** Options of each DataSource created. */
    created: [] as unknown[],
} ) );

vi.mock( 'typeorm', async ( importOriginal ) => ( {
    ...await importOriginal<typeof import( 'typeorm' )>(),
    DataSource: vi.fn( function DataSource( options: unknown ) {
        connection.created.push( options );

        return connection;
    } ),
} ) );

describe( 'DatabaseService', () => {
    const config = { getOrThrow: vi.fn().mockReturnValue( 'postgresql://u:p@localhost:5432/db' ) };
    const service = new DatabaseService( config as unknown as ConfigService );

    beforeEach( () => {
        vi.clearAllMocks();
    } );

    it( 'connects with the shared options (never synchronize), runs the work, then disconnects', async () => {
        await expect( service.withDataSource( () => Promise.resolve( 42 ) ) ).resolves.toBe( 42 );

        expect( config.getOrThrow ).toHaveBeenCalledWith( 'DATABASE_URL' );
        expect( connection.created.at( -1 ) ).toMatchObject( { url: 'postgresql://u:p@localhost:5432/db', synchronize: false } );
        expect( connection.initialize ).toHaveBeenCalledOnce();
        expect( connection.destroy ).toHaveBeenCalledOnce();
    } );

    it( 'disconnects even when the work fails, so the process can exit', async () => {
        await expect( service.withDataSource( () => Promise.reject( new Error( 'boom' ) ) ) ).rejects.toThrow( 'boom' );

        expect( connection.destroy ).toHaveBeenCalledOnce();
    } );
} );
