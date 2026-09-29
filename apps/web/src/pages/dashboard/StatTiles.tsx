import type { StudyStats } from '@studylog/schemas';

import styles from './Dashboard.module.css';
import { formatDays, formatMinutes } from './format.ts';

interface Tile {
    label: string;
    value: string;
    detail?: string;
    icon: 'clock' | 'week' | 'flame' | 'total' | 'check';
}

/** The headline numbers: time today, this week and in total, the streak, and items completed. */
export function StatTiles( { stats }: { stats: StudyStats } ) {
    const tiles: Tile[] = [
        { label: 'Today', value: formatMinutes( stats.todayMinutes ), icon: 'clock' },
        { label: 'This week', value: formatMinutes( stats.weekMinutes ), icon: 'week' },
        {
            label: 'Streak',
            value: formatDays( stats.currentStreakDays ),
            detail: `Best: ${formatDays( stats.longestStreakDays )}`,
            icon: 'flame',
        },
        { label: 'Total', value: formatMinutes( stats.totalMinutes ), icon: 'total' },
        { label: 'Items completed', value: String( stats.itemsCompleted ), icon: 'check' },
    ];

    return (
        <dl className={styles.tiles}>
            {tiles.map( ( tile ) => (
                <div key={tile.label} className={styles.tile}>
                    <span className={`${styles.icon} ${styles[tile.icon]}`} aria-hidden="true" />
                    <div>
                        <dt className={styles.label}>{tile.label}</dt>
                        <dd className={styles.tileValue}>{tile.value}</dd>
                        {tile.detail && <dd className={styles.muted}>{tile.detail}</dd>}
                    </div>
                </div>
            ) )}
        </dl>
    );
}
