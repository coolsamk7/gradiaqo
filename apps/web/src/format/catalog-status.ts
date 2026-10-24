import { CatalogStatus } from '@studylog/schemas/enums';

import app from '../styles/app.module.css';

/* How a catalog part's status shows: drafts in amber, published in green, archived in grey (Figma: Admin · Catalog). */

export const STATUS_LABELS: Record<CatalogStatus, string> = {
    [CatalogStatus.Draft]: 'Draft',
    [CatalogStatus.Published]: 'Published',
    [CatalogStatus.Archived]: 'Archived',
};

export const STATUS_BADGES: Record<CatalogStatus, string> = {
    [CatalogStatus.Draft]: `${app.badge} ${app.badgeWarning}`,
    [CatalogStatus.Published]: `${app.badge} ${app.badgeSuccess}`,
    [CatalogStatus.Archived]: app.badge,
};
