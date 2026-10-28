import styles from './Logo.module.css';

/** The Gradiaqo mark on its own: a "G" in teal with an orange dot (also public/favicon.svg). */
export function LogoMark( { className }: { className?: string } ) {
    return (
        <svg className={className} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
            <path
                d="M93.7 31.7A44 44 0 1 0 104 60H66"
                fill="none"
                stroke="#0fa3b1"
                strokeWidth="13"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle cx="93.7" cy="31.7" r="9" fill="#f4a259" />
        </svg>
    );
}

/** The Gradiaqo mark and name. The name takes the surrounding text color. */
export function Logo() {
    return (
        <span className={styles.logo}>
            <LogoMark className={styles.mark} />
            <span className={styles.name}>Gradiaqo</span>
        </span>
    );
}
