import { Link } from 'react-router';

import { Icon } from '../../components/Icon.tsx';
import shared from '../../styles/shared.module.css';
import styles from './CallToAction.module.css';

export function CallToAction() {
    return (
        <section className={`${shared.section} ${styles.section}`} aria-labelledby="cta-title">
            <div className={shared.container}>
                <div className={styles.panel}>
                    <h2 id="cta-title" className={styles.title}>Ready to make your study time count?</h2>
                    <p className={styles.text}>Set up your first learning path in a few minutes.</p>
                    <Link to="/signup" className={`${shared.button} ${shared.accent} ${styles.button}`}>
                        <Icon name="arrow-right" />
                        Create your account
                    </Link>
                </div>
            </div>
        </section>
    );
}
