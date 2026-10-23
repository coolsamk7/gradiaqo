import { Icon } from './Icon.tsx';
import styles from './MoveButtons.module.css';

interface MoveButtonsProps {
    /** What moves, for the buttons' names: "Move Trees up". */
    name: string;
    first: boolean;
    last: boolean;
    disabled: boolean;
    onMove: ( by: -1 | 1 ) => void;
}

/** Up and down buttons that move one row in a list; the first can't go up and the last can't go down. */
export function MoveButtons( { name, first, last, disabled, onMove }: MoveButtonsProps ) {
    return (
        <span className={styles.move}>
            <button
                type="button"
                className={styles.iconButton}
                aria-label={`Move ${name} up`}
                disabled={disabled || first}
                onClick={() => onMove( -1 )}
            >
                <Icon name="chevron-up" />
            </button>
            <button
                type="button"
                className={styles.iconButton}
                aria-label={`Move ${name} down`}
                disabled={disabled || last}
                onClick={() => onMove( 1 )}
            >
                <Icon name="chevron-down" />
            </button>
        </span>
    );
}
