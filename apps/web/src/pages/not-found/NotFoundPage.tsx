import { Link } from 'react-router';

import { usePageTitle } from '../../seo/use-page-title.ts';
import shared from '../../styles/shared.module.css';
import styles from './NotFoundPage.module.css';

export function NotFoundPage() {
    usePageTitle( 'Page not found' );

    return (
        <main className={styles.page}>
            <p className={styles.code}>404</p>
            <h1 className={styles.title}>Page not found</h1>
            <p className={styles.text}>This page doesn&apos;t exist, or not yet.</p>
            <Link to="/" className={`${shared.button} ${shared.primary}`}>Back to home</Link>
        </main>
    );
}
