import type { Response } from 'express';
import type { DataSource } from 'typeorm';

import { HealthController } from '../../../src/health/health.controller.js';

describe( 'HealthController', () => {
    const status = vi.fn();
    const response = () => ( { status } ) as unknown as Response;

    beforeEach( () => {
        status.mockClear();
    } );

    it( 'is ok when the database answers', async () => {
        const dataSource = { query: vi.fn().mockResolvedValue( [ 1 ] ) } as unknown as DataSource;

        expect( await new HealthController( dataSource ).check( response() ) ).toEqual( { status: 'ok', database: 'up' } );
        expect( status ).not.toHaveBeenCalled();
    } );

    it( 'answers 503 when the database is unreachable', async () => {
        const dataSource = { query: vi.fn().mockRejectedValue( new Error( 'ECONNREFUSED' ) ) } as unknown as DataSource;

        expect( await new HealthController( dataSource ).check( response() ) ).toEqual( { status: 'error', database: 'down' } );
        expect( status ).toHaveBeenCalledWith( 503 );
    } );
} );
