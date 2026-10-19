import { Link } from 'react-router';

import { AppLayout } from '../../components/AppLayout.tsx';
import { Icon } from '../../components/Icon.tsx';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import styles from './ComingSoon.module.css';
import type { UpcomingPage } from './upcoming.ts';
import { UPCOMING } from './upcoming.ts';

/** A sidebar section whose page isn't built yet: what it will do, and the way back. */
export function ComingSoonPage( { page }: { page: UpcomingPage } ) {
    const { title, icon, text } = UPCOMING[page];

    return (
        <AppLayout>
            <div className={app.header}>
                <div className={app.titleBlock}>
                    <h1 className={app.title}>{title}</h1>
                    <p className={app.muted}>{text}</p>
                </div>
            </div>
            <section className={`${app.card} ${styles.empty}`} aria-labelledby="soon-title">
                <span className={styles.chip}><Icon name={icon} size={20} /></span>
                <h2 id="soon-title" className={app.cardTitle}>Coming soon</h2>
                <p className={app.muted}>This page is being built. Everything else in StudyLog already works.</p>
                <Link to="/app" className={`${shared.button} ${shared.secondary}`}>Back to dashboard</Link>
            </section>
        </AppLayout>
    );
}
