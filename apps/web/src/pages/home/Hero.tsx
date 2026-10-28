import { Link } from 'react-router';

import { Icon } from '../../components/Icon.tsx';
import shared from '../../styles/shared.module.css';
import { DashboardPreview } from './DashboardPreview.tsx';
import styles from './Hero.module.css';

export function Hero() {
    return (
        <section className={styles.hero} aria-labelledby="hero-title">
            <div className={`${shared.container} ${styles.inner}`}>
                <div className={styles.copy}>
                    <span className={styles.badge}>Your study companion</span>
                    <h1 id="hero-title" className={styles.title}>
                        Study with a plan.
                        {' '}
                        <span className={styles.highlight}>See your progress every day.</span>
                    </h1>
                    <p className={styles.lead}>
                        Gradiaqo turns any subject into a learning path: modules, topics and the problems, videos,
                        articles and notes that go with them. Log your study time, track what you&apos;ve finished,
                        and keep your streak going.
                    </p>
                    <div className={styles.actions}>
                        <Link to="/signup" className={`${shared.button} ${shared.primary}`}>
                            <Icon name="arrow-right" />
                            Get started
                        </Link>
                        <a href="#how-it-works" className={`${shared.button} ${shared.secondary}`}>
                            See how it works
                        </a>
                    </div>
                </div>
                <DashboardPreview />
            </div>
        </section>
    );
}
