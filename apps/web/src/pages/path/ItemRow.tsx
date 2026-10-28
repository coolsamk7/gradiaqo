import type { EnrollmentDetailJson } from '@studylog/schemas';
import { ItemType, ProgressStatus } from '@studylog/schemas/enums';
import { useState } from 'react';
import { Link } from 'react-router';

import type { IconName } from '../../components/Icon.tsx';
import { Icon } from '../../components/Icon.tsx';
import { Markdown } from '../../components/Markdown.tsx';
import form from '../../forms/form.module.css';
import shared from '../../styles/shared.module.css';
import { DIFFICULTY_LABELS, itemContent, itemFacts, itemLink, STATUS_LABELS, TYPE_LABELS } from './item-details.ts';
import styles from './Path.module.css';

const STATUS_ICONS: Record<ProgressStatus, IconName> = {
    [ProgressStatus.NotStarted]: 'circle',
    [ProgressStatus.InProgress]: 'clock',
    [ProgressStatus.Done]: 'check-circle',
    [ProgressStatus.Revise]: 'flag',
};

const action = `${shared.button} ${shared.ghost} ${shared.small}`;

export type PathItem = EnrollmentDetailJson['modules'][number]['topics'][number]['items'][number];

interface ItemRowProps {
    item: PathItem;
    enrollmentId: string;
    topicId: string;
    /** Saves a new status; rejects if it wasn't saved. */
    onStatus: ( itemId: string, status: ProgressStatus ) => Promise<void>;
}

/** One item in a topic: what it is, the user's status on it, where to study it, and logging time on it. */
export function ItemRow( { item, enrollmentId, topicId, onStatus }: ItemRowProps ) {
    const [ saving, setSaving ] = useState( false );
    const [ error, setError ] = useState<string>();
    const link = itemLink( item.details );
    const content = itemContent( item.type, item.details );
    const facts = [
        TYPE_LABELS[item.type],
        item.difficulty && DIFFICULTY_LABELS[item.difficulty],
        item.estimatedMinutes && `${item.estimatedMinutes} min`,
        item.isOptional && 'Optional',
        ...itemFacts( item.details ),
    ].filter( Boolean );
    // Unique on the page: the same item can appear in several topics.
    const statusId = `status-${topicId}-${item.id}`;
    const logTime = `/app/sessions?log&path=${enrollmentId}&topic=${topicId}&item=${item.id}`;

    const onChange = async ( status: ProgressStatus ) => {
        setSaving( true );
        setError( undefined );
        try {
            await onStatus( item.id, status );
        } catch {
            setError( 'Couldn\'t save your progress. Please try again.' );
        }
        setSaving( false );
    };

    return (
        <li className={styles.item}>
            <Icon name={STATUS_ICONS[item.progress]} className={`${styles.statusIcon} ${styles[item.progress]}`} />
            <div className={styles.itemMain}>
                <p>{item.title}</p>
                <p className={styles.meta}>{facts.join( ' · ' )}</p>
                {content && (
                    <details className={styles.content}>
                        <Toggle what={item.type === ItemType.Note ? 'note' : 'instructions'} />
                        <Markdown className={styles.body} text={content.body} />
                        {content.answer && (
                            <details className={styles.content}>
                                <Toggle what="answer" />
                                <Markdown className={styles.body} text={content.answer} />
                            </details>
                        )}
                    </details>
                )}
                {error && <p className={form.fieldError} role="alert">{error}</p>}
            </div>
            <div className={styles.itemActions}>
                <label htmlFor={statusId} className="visually-hidden">{`Status of ${item.title}`}</label>
                <select
                    id={statusId}
                    className={styles.status}
                    value={item.progress}
                    disabled={saving}
                    onChange={( event ) => void onChange( event.target.value as ProgressStatus )}
                >
                    {Object.values( ProgressStatus ).map( ( status ) => (
                        <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                    ) )}
                </select>
                {link && (
                    <a href={link.url} target="_blank" rel="noreferrer" className={action}>
                        <Icon name="external-link" />
                        {`${link.label} `}
                        <span className="visually-hidden">(opens in a new tab)</span>
                    </a>
                )}
                <Link to={logTime} className={action}>
                    <Icon name="clock" />
                    Log time
                </Link>
            </div>
        </li>
    );
}

/** "Show note" while closed, "Hide note" while open (the details element's own state, switched in CSS). */
function Toggle( { what }: { what: string } ) {
    return (
        <summary>
            <span className={styles.whenClosed}>{`Show ${what}`}</span>
            <span className={styles.whenOpen}>{`Hide ${what}`}</span>
        </summary>
    );
}
