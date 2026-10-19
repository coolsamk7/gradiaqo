import type { ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';

import styles from './Dialog.module.css';
import { Icon } from './Icon.tsx';

interface DialogProps {
    title: string;
    /** A line under the title. */
    description: string;
    onClose: () => void;
    /** 640px instead of 480px, for lists. */
    wide?: boolean;
    children: ReactNode;
}

/**
 * A modal dialog (Figma: Screens – Web › Dialogs): a card over a dimmed page, closed with its × button or Escape.
 * Give its first field `autoFocus`; focus goes back where it was when it closes.
 */
export function Dialog( { title, description, onClose, wide = false, children }: DialogProps ) {
    const id = useId();
    const close = useRef( onClose );
    // Where focus was (the button that opened it), read before a field inside takes it.
    const [ opener ] = useState( () => document.activeElement as HTMLElement );

    useEffect( () => {
        close.current = onClose;
    } );

    useEffect( () => {
        const onKey = ( event: KeyboardEvent ) => {
            if ( event.key === 'Escape' ) {
                close.current();
            }
        };

        document.addEventListener( 'keydown', onKey );

        return () => {
            document.removeEventListener( 'keydown', onKey );
            opener.focus();
        };
    }, [ opener ] );

    return (
        <div className={styles.overlay}>
            <div
                className={`${styles.card} ${wide ? styles.wide : ''}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${id}-title`}
                aria-describedby={`${id}-description`}
            >
                <div className={styles.head}>
                    <div className={styles.titles}>
                        <h2 id={`${id}-title`} className={styles.title}>{title}</h2>
                        <p id={`${id}-description`} className={styles.description}>{description}</p>
                    </div>
                    <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
                        <Icon name="x" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}
