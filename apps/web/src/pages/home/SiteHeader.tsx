import { Link } from 'react-router';

import { Logo } from '../../components/Logo.tsx';
import shared from '../../styles/shared.module.css';
import { SECTION_LINKS } from './content.tsx';
import styles from './SiteHeader.module.css';

export function SiteHeader() {
    return (
        <header className={styles.header}>
            <div className={`${shared.container} ${styles.inner}`}>
                <Link to="/" className={styles.home} aria-label="StudyLog home">
                    <Logo />
                </Link>
                <nav aria-label="Main" className={styles.nav}>
                    <ul className={styles.links}>
                        {SECTION_LINKS.map( ( link ) => (
                            <li key={link.href}>
                                <a href={link.href} className={styles.link}>{link.label}</a>
                            </li>
                        ) )}
                    </ul>
                    <Link to="/login" className={styles.link}>Log in</Link>
                    <Link to="/signup" className={`${shared.button} ${shared.primary}`}>Get started</Link>
                </nav>
            </div>
        </header>
    );
}
