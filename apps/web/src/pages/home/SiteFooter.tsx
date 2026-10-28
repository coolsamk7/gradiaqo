import { Link } from 'react-router';

import { Logo } from '../../components/Logo.tsx';
import shared from '../../styles/shared.module.css';
import { SECTION_LINKS } from './content.tsx';
import styles from './SiteFooter.module.css';

export function SiteFooter() {
    return (
        <footer className={styles.footer}>
            <div className={`${shared.container} ${styles.inner}`}>
                <Logo />
                <nav aria-label="Footer">
                    <ul className={styles.links}>
                        {SECTION_LINKS.map( ( link ) => (
                            <li key={link.href}>
                                <a href={link.href}>{link.label}</a>
                            </li>
                        ) )}
                        <li>
                            <Link to="/login">Log in</Link>
                        </li>
                    </ul>
                </nav>
                <p className={styles.copyright}>{`© ${new Date().getFullYear()} Gradiaqo`}</p>
            </div>
        </footer>
    );
}
