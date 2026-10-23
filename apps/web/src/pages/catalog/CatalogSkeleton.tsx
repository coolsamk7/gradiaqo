import { Bar } from '../../components/LoadStates.tsx';
import app from '../../styles/app.module.css';
import styles from './Catalog.module.css';

/** Path cards in grey while the catalog loads. */
export function CatalogSkeleton() {
    return (
        <div className={styles.grid}>
            {[ 0, 1, 2, 3, 4, 5 ].map( ( n ) => (
                <div key={n} className={`${app.card} ${styles.card}`}>
                    <Bar width={120} height={18} />
                    <Bar width={200} height={16} />
                    <Bar />
                    <Bar width={160} />
                </div>
            ) )}
        </div>
    );
}
