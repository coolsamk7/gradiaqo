import type { PublishedPathSummaryJson } from '@studylog/schemas';
import { Link } from 'react-router';

import { Icon } from '../../components/Icon.tsx';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import styles from './Catalog.module.css';
import type { BadgeTone } from './catalog-paths.ts';
import { authorOf, count, formatEstimate, sourceOf } from './catalog-paths.ts';

const TONES: Record<BadgeTone, string> = {
    accent: app.badgeAccent,
    neutral: '',
    inverse: app.badgeInverse,
    warning: app.badgeWarning,
};

/** A path in the catalog (Figma: Path card): where it's from, what's in it, and the way in. */
export function PathCard( { path, userId }: { path: PublishedPathSummaryJson; userId: string } ) {
    const source = sourceOf( path, userId );
    const { modules, items, estimatedMinutes } = path.contents;
    const estimate = formatEstimate( estimatedMinutes );

    return (
        <li className={`${app.card} ${styles.card}`}>
            <div className={styles.badges}>
                <span className={`${app.badge} ${TONES[source.tone]}`}>{source.label}</span>
                {path.enrollmentId && <span className={`${app.badge} ${app.badgeSuccess}`}>Enrolled</span>}
            </div>
            <h2 className={styles.title}>{path.title}</h2>
            {path.description && <p className={`${app.muted} ${styles.description}`}>{path.description}</p>}
            <ul className={styles.meta} aria-label="Contents">
                <li>
                    <Icon name="layers" />
                    {count( modules, 'module' )}
                </li>
                <li>
                    <Icon name="file-text" />
                    {count( items, 'item' )}
                </li>
                {estimate && (
                    <li>
                        <Icon name="clock" />
                        {estimate}
                    </li>
                )}
            </ul>
            <div className={styles.footer}>
                <span className={`${app.muted} ${app.small}`}>{authorOf( path, userId )}</span>
                <Link
                    to={path.enrollmentId ? `/app/paths/${path.enrollmentId}` : `/app/catalog/${path.id}`}
                    className={`${shared.button} ${shared.secondary} ${shared.small}`}
                    aria-label={`${path.enrollmentId ? 'Continue' : 'View'} ${path.title}`}
                >
                    {path.enrollmentId ? 'Continue' : 'View path'}
                </Link>
            </div>
        </li>
    );
}
