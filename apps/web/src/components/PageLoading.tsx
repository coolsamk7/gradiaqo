import styles from './PageLoading.module.css';

export function PageLoading() {
    return (
        <div className={styles.page} role="status">
            <span className={styles.spinner} aria-hidden="true" />
            <span className="visually-hidden">Loading…</span>
        </div>
    );
}
