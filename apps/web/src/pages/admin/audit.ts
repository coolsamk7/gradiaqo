import type { AuditEventJson } from '@studylog/schemas';
import { AuditArea } from '@studylog/schemas';
import { AuditAction } from '@studylog/schemas/enums';

import { formatTime, relativeDay } from '../../format/format.ts';
import { PAGE_SIZE } from './users.ts';

/* Sentences and filters for Admin › Audit log. */

export const AREA_LABELS: Record<AuditArea, string> = {
    [AuditArea.Users]: 'Users',
    [AuditArea.Catalog]: 'Catalog',
    [AuditArea.Moderation]: 'Moderation',
};

/** What happened, after the admin's name: "published the path “Graphs”". */
export function auditSentence( event: AuditEventJson ): string {
    const target = `“${event.targetLabel}”`;
    const what: Record<AuditAction, string> = {
        [AuditAction.UserPromoted]: `made ${event.targetLabel} a superadmin`,
        [AuditAction.UserDemoted]: `made ${event.targetLabel} a normal user`,
        [AuditAction.UserRemoved]: `removed the account ${event.targetLabel}`,
        [AuditAction.PathPublished]: `published the path ${target}`,
        [AuditAction.PathMovedToDraft]: `moved the path ${target} to draft`,
        [AuditAction.PathArchived]: `archived the path ${target}`,
        [AuditAction.PathDeleted]: `deleted the path ${target}`,
        [AuditAction.PathImported]: `imported the path ${target} from a file`,
        [AuditAction.ItemPublished]: `published the item ${target}`,
        [AuditAction.ItemMovedToDraft]: `moved the item ${target} to draft`,
        [AuditAction.ItemArchived]: `archived the item ${target}`,
        [AuditAction.ItemDeleted]: `deleted the item ${target}`,
        [AuditAction.ReportDismissed]: `dismissed a report on ${target}`,
        [AuditAction.PathHidden]: `hid ${target} from the public catalog`,
        [AuditAction.PathUnhidden]: `un-hid ${target}`,
    };

    return what[event.action];
}

/** "Today, 9:22 AM". */
export function when( event: AuditEventJson, now: Date ): string {
    const date = new Date( event.createdAt );

    return `${relativeDay( date, now )}, ${formatTime( date )}`;
}

/** The API query: "/admin/audit?area=users&limit=50&offset=50". */
export function auditUrl( area: AuditArea | '', offset: number ): string {
    const query = new URLSearchParams( {
        ...( area ? { area } : {} ),
        limit: String( PAGE_SIZE ),
        ...( offset ? { offset: String( offset ) } : {} ),
    } );

    return `/admin/audit?${query.toString()}`;
}
