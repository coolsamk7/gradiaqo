import type { EnrollmentDetailJson } from '@studylog/schemas';
import { OrderParentType } from '@studylog/schemas/enums';
import { useState } from 'react';

import { useAuth } from '../../auth/auth-context.ts';
import { Icon } from '../../components/Icon.tsx';
import move from '../../components/MoveButtons.module.css';
import { MoveButtons } from '../../components/MoveButtons.tsx';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import { moved } from '../my-paths/builder-tree.ts';
import styles from './PathSettings.module.css';
import { saveError } from './settings.ts';

interface OrderCardProps {
    enrollment: EnrollmentDetailJson;
    /** After the order changed: load the enrollment again. */
    onChanged: () => Promise<void>;
}

/**
 * The user's own order for the modules they follow, and the topics in each (Figma: M1 › Path settings › Your
 * order). Each move is saved right away; content the author adds later goes at the end.
 */
export function OrderCard( { enrollment, onChanged }: OrderCardProps ) {
    const { request } = useAuth();
    const [ open, setOpen ] = useState<string>();
    const [ busy, setBusy ] = useState( false );
    const [ error, setError ] = useState<string>();
    const url = `/me/enrollments/${enrollment.id}/orders`;
    const moduleIds = enrollment.modules.map( ( module ) => module.id );

    /** Runs a change, then loads the new order; says so if it wasn't saved. */
    const save = async ( change: () => Promise<unknown> ) => {
        setBusy( true );
        setError( undefined );
        try {
            await change();
            await onChanged();
        } catch ( failure ) {
            setError( saveError( failure, 'the order wasn\'t changed' ) );
        }
        setBusy( false );
    };

    const setOrder = ( parentType: OrderParentType, parentId: string, ids: string[] ) =>
        save( () => request( `${url}/${parentType}/${parentId}`, { method: 'PUT', body: { ids } } ) );

    // Every order the user set, also on items (the path page has no way to set those yet, but they may exist).
    const reset = () => save( async () => {
        for ( const order of enrollment.orders ) {
            await request( `${url}/${order.parentType}/${order.parentId}`, { method: 'DELETE' } );
        }
    } );

    return (
        <section className={`${app.card} ${styles.order}`} aria-labelledby="order-title">
            <div className={styles.orderHead}>
                <div className={styles.titleRow}>
                    <h2 id="order-title" className={`${app.cardTitle} ${styles.grow}`}>Your order</h2>
                    {enrollment.orders.length > 0 && (
                        <button type="button" className={`${shared.button} ${shared.ghost} ${shared.small}`} disabled={busy} onClick={() => void reset()}>
                            Reset to the author&apos;s order
                        </button>
                    )}
                </div>
                <p className={`${app.muted} ${app.small}`}>
                    Move modules (and topics inside them) into the order you want to study them. New content from the
                    author is added at the end.
                </p>
            </div>
            {error && <p className={app.error} role="alert">{error}</p>}
            {enrollment.modules.length === 0 && <p className={`${app.muted} ${app.small}`}>Nothing to order yet.</p>}
            {enrollment.modules.length > 0 && (
                <ul className={styles.orderList} aria-label="Modules">
                    {enrollment.modules.map( ( module, index ) => {
                        const expanded = open === module.id;
                        const topicIds = module.topics.map( ( topic ) => topic.id );

                        return (
                            <li key={module.id} className={styles.orderModule}>
                                <div className={styles.orderRow}>
                                    <MoveButtons
                                        name={module.title}
                                        first={index === 0}
                                        last={index === enrollment.modules.length - 1}
                                        disabled={busy}
                                        onMove={( by ) => void setOrder(
                                            OrderParentType.Path,
                                            enrollment.learningPath.id,
                                            moved( moduleIds, module.id, by ),
                                        )}
                                    />
                                    <div className={styles.orderCopy}>
                                        <span className={styles.orderTitle}>{module.title}</span>
                                        <span className={`${app.muted} ${app.small} ${styles.orderDetail}`}>
                                            {module.topics.map( ( topic ) => topic.title ).join( ', ' ) || 'No topics'}
                                        </span>
                                    </div>
                                    {module.topics.length > 1 && (
                                        <button
                                            type="button"
                                            className={move.iconButton}
                                            aria-expanded={expanded}
                                            aria-label={`${expanded ? 'Hide' : 'Order'} the topics in ${module.title}`}
                                            onClick={() => setOpen( expanded ? undefined : module.id )}
                                        >
                                            <Icon name={expanded ? 'chevron-down' : 'chevron-right'} />
                                        </button>
                                    )}
                                </div>
                                {expanded && (
                                    <ul className={styles.orderTopics} aria-label={`Topics in ${module.title}`}>
                                        {module.topics.map( ( topic, position ) => (
                                            <li key={topic.id} className={styles.orderRow}>
                                                <MoveButtons
                                                    name={topic.title}
                                                    first={position === 0}
                                                    last={position === module.topics.length - 1}
                                                    disabled={busy}
                                                    onMove={( by ) => void setOrder(
                                                        OrderParentType.Module,
                                                        module.id,
                                                        moved( topicIds, topic.id, by ),
                                                    )}
                                                />
                                                <span className={styles.orderCopy}>{topic.title}</span>
                                            </li>
                                        ) )}
                                    </ul>
                                )}
                            </li>
                        );
                    } )}
                </ul>
            )}
        </section>
    );
}
