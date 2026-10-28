import { ApiError, NetworkError } from '../../api/client.ts';

const OFFLINE = 'Can\'t reach Gradiaqo right now. Check your connection and try again.';

/** Why something couldn't be loaded. */
export function loadErrorMessage( error: unknown ): string {
    if ( error instanceof NetworkError ) {
        return OFFLINE;
    }

    return error instanceof ApiError && ( error.status === 404 || error.status === 403 )
        ? 'This isn\'t here, or you can\'t edit it.'
        : 'Something went wrong while loading. Please try again.';
}

/** Why a change wasn't saved; `taken` explains a 409 (a title already used next to it). */
export function saveErrorMessage( error: unknown, taken = 'That name is already used here. Try another.' ): string {
    if ( error instanceof NetworkError ) {
        return OFFLINE;
    }
    if ( error instanceof ApiError && error.status === 409 ) {
        return taken;
    }
    if ( error instanceof ApiError && error.status === 404 ) {
        return 'This was removed, maybe in another tab. Reload the page.';
    }

    return 'Something went wrong, so it wasn\'t saved. Please try again.';
}
