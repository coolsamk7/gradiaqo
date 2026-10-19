import { Icon } from './Icon.tsx';
import styles from './Logo.module.css';

/** The StudyLog mark (a bolt in an accent square) and name. The name takes the surrounding text color. */
export function Logo() {
    return (
        <span className={styles.logo}>
            <span className={styles.mark} aria-hidden="true">
                <Icon name="zap" />
            </span>
            <span className={styles.name}>StudyLog</span>
        </span>
    );
}
