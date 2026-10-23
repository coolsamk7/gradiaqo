import type { ReactNode } from 'react';
import { Link } from 'react-router';

import app from '../styles/app.module.css';
import shared from '../styles/shared.module.css';
import { Icon } from './Icon.tsx';
import styles from './LoadStates.module.css';

/**
 * While a page loads (Figma: States › Path · loading): a spinner with what's loading, then `children`, grey blocks
 * in the shape of the page (built from `Bar`s).
 */
export function Loading( { text, children }: { text: string; children?: ReactNode } ) {
    return (
        <>
            <div className={app.status} role="status">
                <span className={app.spinner} aria-hidden="true" />
                {text}
            </div>
            {children && <div className={styles.skeleton} aria-hidden="true">{children}</div>}
        </>
    );
}

/**
 * A load that failed (Figma: States › Dashboard · error): the message, then "Try again" (unless trying again can't
 * help), or `children` for another way on (e.g. a link back).
 */
interface LoadErrorProps {
    message: string;
    retry?: () => void;
    children?: ReactNode;
}

export function LoadError( { message, retry, children }: LoadErrorProps ) {
    return (
        <div className={styles.failed}>
            <p className={app.error} role="alert">
                <Icon name="alert-circle" />
                {message}
            </p>
            {retry && (
                <button type="button" className={`${shared.button} ${shared.secondary}`} onClick={retry}>
                    Try again
                </button>
            )}
            {children}
        </div>
    );
}

/** A grey block standing in for text or a control; `width` defaults to the full width. */
export function Bar( { width, height = 12 }: { width?: number; height?: number } ) {
    return <span className={`${app.skeleton} ${styles.bar}`} style={{ width, height }} />;
}

/** A card with a title and a few lines. */
export function CardSkeleton( { lines = 3 }: { lines?: number } ) {
    return (
        <div className={`${app.card} ${styles.card}`}>
            <Bar width={180} height={16} />
            {Array.from( { length: lines }, ( _, n ) => <Bar key={n} width={n === 0 ? undefined : 240} /> )}
        </div>
    );
}

/** A path's title, subtitle and progress, then its modules (Figma: States › Path · loading). */
export function PathSkeleton( { modules = 2 }: { modules?: number } ) {
    return (
        <>
            <div className={styles.header}>
                <Bar width={360} height={24} />
                <Bar width={280} />
                <Bar height={6} />
            </div>
            {Array.from( { length: modules }, ( _, n ) => (
                <div key={n} className={`${app.card} ${styles.card}`}>
                    <Bar width={180} height={16} />
                    <Bar height={6} />
                    <Bar width={240} />
                    <Bar width={240} />
                    <Bar width={240} />
                </div>
            ) )}
        </>
    );
}

/** The way on when what was asked for isn't there (Figma: States › Path · not on your list). */
export function BrowsePathsLink() {
    return (
        <Link to="/app/catalog" className={`${shared.button} ${shared.secondary}`}>
            <Icon name="compass" />
            Browse paths
        </Link>
    );
}
