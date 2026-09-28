import type { ReactNode } from 'react';
import { Link } from 'react-router';

import styles from './AuthLayout.module.css';
import { Logo } from './Logo.tsx';

interface AuthLayoutProps {
    /** Big line on the brand panel (wide screens only). */
    brandTitle: string;
    /** Short points under it. */
    highlights: string[];
    title: string;
    subtitle: string;
    /** Under the card's content, e.g. a link to the other auth page. */
    alternative: ReactNode;
    children: ReactNode;
}

/** The login and signup pages: a brand panel on wide screens, and a card with the form. */
export function AuthLayout( { brandTitle, highlights, title, subtitle, alternative, children }: AuthLayoutProps ) {
    return (
        <div className={styles.page}>
            <aside className={styles.brand} aria-hidden="true">
                <Logo />
                <p className={styles.brandTitle}>{brandTitle}</p>
                <ul className={styles.highlights}>
                    {highlights.map( ( highlight ) => <li key={highlight}>{highlight}</li> )}
                </ul>
            </aside>

            <main className={styles.main}>
                <div className={styles.card}>
                    <Link to="/" className={styles.logoLink} aria-label="StudyLog home">
                        <Logo />
                    </Link>
                    <h1 className={styles.title}>{title}</h1>
                    <p className={styles.subtitle}>{subtitle}</p>

                    {children}

                    <p className={styles.alternative}>{alternative}</p>
                </div>
            </main>
        </div>
    );
}
