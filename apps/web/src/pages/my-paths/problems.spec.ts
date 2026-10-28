import { ApiError, NetworkError } from '../../api/client.ts';
import { loadErrorMessage, saveErrorMessage } from './problems.ts';

describe( 'loadErrorMessage', () => {
    it( 'explains why something couldn\'t be loaded', () => {
        expect( loadErrorMessage( new NetworkError() ) ).toMatch( /^Can't reach Gradiaqo/ );
        expect( loadErrorMessage( new ApiError( 404, 'Not Found' ) ) ).toBe( 'This isn\'t here, or you can\'t edit it.' );
        expect( loadErrorMessage( new ApiError( 403, 'Forbidden' ) ) ).toBe( 'This isn\'t here, or you can\'t edit it.' );
        expect( loadErrorMessage( new ApiError( 500, 'boom' ) ) ).toBe( 'Something went wrong while loading. Please try again.' );
        expect( loadErrorMessage( new Error( 'bug' ) ) ).toBe( 'Something went wrong while loading. Please try again.' );
    } );
} );

describe( 'saveErrorMessage', () => {
    it( 'explains why a change wasn\'t saved', () => {
        expect( saveErrorMessage( new NetworkError() ) ).toMatch( /^Can't reach Gradiaqo/ );
        expect( saveErrorMessage( new ApiError( 409, 'taken' ) ) ).toBe( 'That name is already used here. Try another.' );
        expect( saveErrorMessage( new ApiError( 409, 'taken' ), 'Pick another title.' ) ).toBe( 'Pick another title.' );
        expect( saveErrorMessage( new ApiError( 404, 'gone' ) ) ).toBe( 'This was removed, maybe in another tab. Reload the page.' );
        expect( saveErrorMessage( new ApiError( 500, 'boom' ) ) ).toBe( 'Something went wrong, so it wasn\'t saved. Please try again.' );
    } );
} );
