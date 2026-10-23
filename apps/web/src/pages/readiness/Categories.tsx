import { Icon } from '../../components/Icon.tsx';
import app from '../../styles/app.module.css';
import { Badge } from './Badge.tsx';
import styles from './Readiness.module.css';
import type { Category } from './readiness.ts';
import { CATEGORIES, strengthOf } from './readiness.ts';

const BAR_COLORS = { success: 'var(--color-chart-2)', warning: 'var(--color-chart-3)', danger: 'var(--color-chart-4)', neutral: '' };

/** A card per category: its score in words and as a bar, and the checks behind it. */
export function Categories( { categories }: { categories: Category[] } ) {
    return (
        <div className={styles.categories}>
            {categories.map( ( category ) => {
                const { title, description } = CATEGORIES[category.key];
                const strength = strengthOf( category.score );

                return (
                    <section key={category.key} className={`${app.card} ${styles.category}`} aria-labelledby={`category-${category.key}`}>
                        <div className={styles.categoryTop}>
                            <div className={styles.categoryTitles}>
                                <h2 id={`category-${category.key}`} className={app.cardTitle}>{title}</h2>
                                <p className={`${app.muted} ${app.small}`}>{description}</p>
                            </div>
                            <Badge tone={strength.tone}>{strength.label}</Badge>
                            <span className={`${app.mono} ${styles[strength.tone]}`}>{`${category.score}%`}</span>
                        </div>
                        <div
                            className={styles.track}
                            role="progressbar"
                            aria-label={`${title} score`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={category.score}
                        >
                            <span className={styles.fill} style={{ width: `${category.score}%`, background: BAR_COLORS[strength.tone] }} />
                        </div>
                        <ul className={styles.checks}>
                            {category.checks.map( ( check ) => (
                                <li key={check.label} className={check.done ? styles.checkDone : styles.check}>
                                    <Icon name={check.done ? 'check-circle' : 'circle'} className={styles.checkIcon} />
                                    <span className={styles.checkLabel}>
                                        {check.label}
                                        <span className="visually-hidden">{check.done ? ' (done)' : ' (not yet)'}</span>
                                    </span>
                                    {check.detail && <span className={`${app.mono} ${app.muted}`}>{check.detail}</span>}
                                </li>
                            ) )}
                        </ul>
                    </section>
                );
            } )}
        </div>
    );
}
