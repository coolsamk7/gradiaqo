import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';

export function Loading( { text }: { text: string } ) {
    return (
        <div className={app.status} role="status">
            <span className={app.spinner} aria-hidden="true" />
            {text}
        </div>
    );
}

/** A load that failed, with a way to try again (unless trying again can't help). */
export function LoadError( { message, retry }: { message: string; retry?: () => void } ) {
    return (
        <div className={app.error} role="alert">
            <p>{message}</p>
            {retry && (
                <button type="button" className={`${shared.button} ${shared.secondary} ${shared.small}`} onClick={retry}>
                    Try again
                </button>
            )}
        </div>
    );
}
