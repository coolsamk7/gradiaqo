import styles from './ProgressBar.module.css';

/** A bar filled to `percent` (0-100), announced to screen readers as `label`. Turns green when complete. */
export function ProgressBar( { label, percent }: { label: string; percent: number } ) {
    return (
        <div className={styles.track} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
            <div className={`${styles.fill} ${percent >= 100 ? styles.done : ''}`} style={{ width: `${percent}%` }} />
        </div>
    );
}
