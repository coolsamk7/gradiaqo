import type { EnrollmentDetailJson } from '@studylog/schemas';
import { ItemType, ProgressStatus } from '@studylog/schemas/enums';
import { useState } from 'react';
import { Link } from 'react-router';

import form from '../../forms/form.module.css';
import { DIFFICULTY_LABELS, itemContent, itemFacts, itemLink, STATUS_LABELS, TYPE_LABELS } from './item-details.ts';
import styles from './Path.module.css';

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
            <span className={`${styles.dot} ${styles[item.progress]}`} aria-hidden="true" />
            <div className={styles.itemMain}>
                <p className={styles.itemTitle}>{item.title}</p>
                <p className={styles.meta}>{facts.join( ' · ' )}</p>
                {content && (
                    <details className={styles.content}>
                        <summary>{item.type === ItemType.Note ? 'Show note' : 'Show instructions'}</summary>
                        <p className={styles.body}>{content.body}</p>
                        {content.answer && (
                            <details className={styles.content}>
                                <summary>Show answer</summary>
                                <p className={styles.body}>{content.answer}</p>
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
                    <a href={link.url} target="_blank" rel="noreferrer" className={styles.action}>
                        {`${link.label} `}
                        <span className="visually-hidden">(opens in a new tab)</span>
                    </a>
                )}
                <Link to={logTime} className={styles.action}>Log time</Link>
            </div>
        </li>
    );
}
