import app from '../styles/app.module.css';
import type { IconName } from './Icon.tsx';
import { Icon } from './Icon.tsx';
import styles from './StatTiles.module.css';

export interface StatTile {
    label: string;
    value: string;
    detail: string;
    icon: IconName;
}

/** Headline numbers in cards (Figma: Stat tile): a label with an icon, the value, and a line of detail. */
export function StatTiles( { tiles }: { tiles: StatTile[] } ) {
    return (
        <dl className={styles.tiles}>
            {tiles.map( ( tile ) => (
                <div key={tile.label} className={`${app.card} ${styles.tile}`}>
                    <dt className={styles.label}>
                        {tile.label}
                        <span className={styles.chip}><Icon name={tile.icon} /></span>
                    </dt>
                    <dd className={styles.value}>{tile.value}</dd>
                    <dd className={`${app.muted} ${app.small}`}>{tile.detail}</dd>
                </div>
            ) )}
        </dl>
    );
}
