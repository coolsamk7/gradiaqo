import shared from '../../styles/shared.module.css';
import { FEATURES } from './content.tsx';
import styles from './Features.module.css';

export function Features() {
    return (
        <section id="features" className={`${shared.section} ${styles.features}`} aria-labelledby="features-title">
            <div className={shared.container}>
                <div className={shared.sectionHeader}>
                    <span className={shared.eyebrow}>Features</span>
                    <h2 id="features-title" className={shared.sectionTitle}>Everything your study plan needs</h2>
                    <p className={shared.sectionLead}>From what to study next to how much you studied this week.</p>
                </div>
                <ul className={styles.grid}>
                    {FEATURES.map( ( feature ) => (
                        <li key={feature.title} className={styles.card}>
                            <span className={styles.icon}>{feature.icon}</span>
                            <h3 className={styles.title}>{feature.title}</h3>
                            <p className={styles.text}>{feature.text}</p>
                        </li>
                    ) )}
                </ul>
            </div>
        </section>
    );
}
