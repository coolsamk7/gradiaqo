import type { ReactNode } from 'react';
import { Link } from 'react-router';

import styles from './AuthLayout.module.css';
import type { IconName } from './Icon.tsx';
import { Icon } from './Icon.tsx';
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
    /** An icon in a chip above the title, e.g. a letter on "Check your inbox". */
    chip?: IconName;
    /** Above the title, e.g. "Back to log in". */
    before?: ReactNode;
    children: ReactNode;
}

/**
 * The pages around logging in (Figma: Log in, Sign up, M3 · Email & passwords): a dark brand panel on wide
 * screens, and the form.
 */
export function AuthLayout( props: AuthLayoutProps ) {
    const { brandTitle, highlights, title, subtitle, alternative, chip, before, children } = props;

    return (
        <div className={styles.page}>
            <aside className={styles.brand} aria-hidden="true">
                <Logo />
                <div className={styles.pitch}>
                    <p className={styles.brandTitle}>{brandTitle}</p>
                    <ul className={styles.highlights}>
                        {highlights.map( ( highlight ) => (
                            <li key={highlight}>
                                <Icon name="check-circle" className={styles.check} />
                                {highlight}
                            </li>
                        ) )}
                    </ul>
                </div>
                <p className={styles.copyright}>© 2026 StudyLog</p>
            </aside>

            <main className={styles.main}>
                <div className={styles.card}>
                    <Link to="/" className={styles.logoLink} aria-label="StudyLog home">
                        <Logo />
                    </Link>
                    {before}
                    {chip && <span className={styles.chip}><Icon name={chip} /></span>}
                    <h1 className={styles.title}>{title}</h1>
                    <p className={styles.subtitle}>{subtitle}</p>

                    {children}

                    <p className={styles.alternative}>{alternative}</p>
                </div>
            </main>
        </div>
    );
}
