import { useId } from 'react';

import styles from './Logo.module.css';

/** The StudyLog mark and name. The mark is a check in a rounded square: every study session, logged. */
export function Logo() {
    // Unique per logo on the page (header and footer both show one), so the gradient reference stays valid.
    const gradientId = useId();

    return (
        <span className={styles.logo}>
            <svg className={styles.mark} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#4f46e5" />
                        <stop offset="1" stopColor="#7c3aed" />
                    </linearGradient>
                </defs>
                <rect width="32" height="32" rx="9" fill={`url(#${gradientId})`} />
                <path d="M9 16.5l4.5 4.5L23 11.5" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className={styles.name}>StudyLog</span>
        </span>
    );
}
