import shared from '../../styles/shared.module.css';
import { STEPS } from './content.tsx';
import styles from './HowItWorks.module.css';

export function HowItWorks() {
    return (
        <section id="how-it-works" className={shared.section} aria-labelledby="how-title">
            <div className={shared.container}>
                <div className={shared.sectionHeader}>
                    <span className={shared.eyebrow}>How it works</span>
                    <h2 id="how-title" className={shared.sectionTitle}>Three steps to a study habit</h2>
                </div>
                <ol className={styles.steps}>
                    {STEPS.map( ( step, index ) => (
                        <li key={step.title} className={styles.step}>
                            <span className={styles.number} aria-hidden="true">{index + 1}</span>
                            <h3 className={styles.title}>{step.title}</h3>
                            <p className={styles.text}>{step.text}</p>
                        </li>
                    ) )}
                </ol>
            </div>
        </section>
    );
}
