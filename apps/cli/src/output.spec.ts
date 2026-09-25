import { output, runSafely } from './output.js';

describe( 'output', () => {
    let stdout: string;
    let stderr: string;

    beforeEach( () => {
        stdout = '';
        stderr = '';
        vi.spyOn( process.stdout, 'write' ).mockImplementation( ( chunk ) => Boolean( stdout += String( chunk ) ) );
        vi.spyOn( process.stderr, 'write' ).mockImplementation( ( chunk ) => Boolean( stderr += String( chunk ) ) );
        process.exitCode = undefined;
    } );

    afterEach( () => {
        vi.restoreAllMocks();
        process.exitCode = undefined;
    } );

    it( 'writes results to stdout and problems to stderr, so output can be piped', () => {
        output.info( 'plain' );
        output.success( 'done' );
        output.warn( 'careful' );
        output.error( 'failed' );

        expect( stdout ).toContain( 'plain\n' );
        expect( stdout ).toContain( 'done\n' );
        expect( stderr ).toContain( 'careful\n' );
        expect( stderr ).toContain( 'failed\n' );
    } );

    it( 'runSafely prints the error message and sets exit code 1 instead of a stack trace', async () => {
        await runSafely( () => Promise.reject( new Error( 'connection refused' ) ) );

        expect( stderr ).toContain( 'connection refused' );
        expect( stderr ).not.toContain( ' at ' );
        expect( process.exitCode ).toBe( 1 );
    } );

    it( 'runSafely leaves the exit code alone on success', async () => {
        await runSafely( () => Promise.resolve() );

        expect( process.exitCode ).toBeUndefined();
    } );

    it( 'runSafely also reports thrown values that aren\'t errors', async () => {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- testing a non-Error rejection on purpose
        await runSafely( () => Promise.reject( 'plain string' ) );

        expect( stderr ).toContain( 'plain string' );
    } );
} );
