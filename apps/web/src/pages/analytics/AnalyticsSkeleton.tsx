import tiles from '../../components/StatTiles.module.css';
import app from '../../styles/app.module.css';
import styles from './Analytics.module.css';

/** Grey blocks in the shape of the page while it loads (decorative; the status text says what's happening). */
export function AnalyticsSkeleton() {
    return (
        <div className={styles.skeleton} aria-hidden="true">
            <div className={tiles.tiles}>
                {[ 0, 1, 2, 3 ].map( ( n ) => (
                    <div key={n} className={`${app.card} ${tiles.tile}`}>
                        <span className={app.skeleton} style={{ width: 64, height: 10 }} />
                        <span className={app.skeleton} style={{ width: 110, height: 24 }} />
                    </div>
                ) )}
            </div>
            <div className={styles.wideLeft}>
                <div className={app.card}>
                    <span className={app.skeleton} style={{ display: 'block', height: 180 }} />
                </div>
                <div className={app.card}>
                    <span className={app.skeleton} style={{ display: 'block', height: 180 }} />
                </div>
            </div>
        </div>
    );
}
