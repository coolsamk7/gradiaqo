import type { FocusEvent } from 'react';
import { useState } from 'react';

import { Icon } from './Icon.tsx';
import styles from './Menu.module.css';

export interface MenuAction {
    label: string;
    onSelect: () => void;
    /** Left out of the menu, e.g. "Move up" on the first row. */
    hidden?: boolean;
    danger?: boolean;
}

/** A "⋯" button that opens a short list of actions. Closes when one is chosen, on Escape, or when focus leaves it. */
export function Menu( { label, actions }: { label: string; actions: MenuAction[] } ) {
    const [ open, setOpen ] = useState( false );

    const onBlur = ( event: FocusEvent<HTMLDivElement> ) => {
        if ( !event.currentTarget.contains( event.relatedTarget ) ) {
            setOpen( false );
        }
    };

    return (
        <div
            className={styles.menu}
            onBlur={onBlur}
            onKeyDown={( event ) => event.key === 'Escape' && setOpen( false )}
        >
            <button
                type="button"
                className={styles.trigger}
                aria-label={label}
                aria-haspopup="true"
                aria-expanded={open}
                onClick={() => setOpen( !open )}
            >
                <Icon name="more-horizontal" />
            </button>
            {open && (
                <ul className={styles.list}>
                    {actions.filter( ( action ) => !action.hidden ).map( ( action ) => (
                        <li key={action.label}>
                            <button
                                type="button"
                                className={`${styles.action} ${action.danger ? styles.danger : ''}`}
                                onClick={() => {
                                    setOpen( false );
                                    action.onSelect();
                                }}
                            >
                                {action.label}
                            </button>
                        </li>
                    ) )}
                </ul>
            )}
        </div>
    );
}
