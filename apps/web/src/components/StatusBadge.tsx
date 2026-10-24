import { CatalogStatus } from '@studylog/schemas/enums';

import { STATUS_BADGES, STATUS_LABELS } from '../format/catalog-status.ts';

/** A catalog part's status as a badge. `unlessPublished` shows nothing for published parts (the usual case). */
interface StatusBadgeProps {
    status: CatalogStatus;
    unlessPublished?: boolean;
}

export function StatusBadge( { status, unlessPublished = false }: StatusBadgeProps ) {
    if ( unlessPublished && status === CatalogStatus.Published ) {
        return null;
    }

    return <span className={STATUS_BADGES[status]}>{STATUS_LABELS[status]}</span>;
}
