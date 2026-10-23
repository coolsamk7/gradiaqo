import { EnrollmentStatus } from '@studylog/schemas/enums';

import { NetworkError } from '../../api/client.ts';
import type { IconName } from '../../components/Icon.tsx';

interface StatusView {
    label: string;
    tone: 'success' | 'neutral';
    text: string;
    /** The button that changes it, if any: its label, icon and the status it sets. */
    action?: { label: string; icon: IconName; to: EnrollmentStatus };
}

/** How each enrollment status is shown on Path settings, and what the user can do from it. */
export const STATUSES: Record<EnrollmentStatus, StatusView> = {
    [EnrollmentStatus.Active]: {
        label: 'Active',
        tone: 'success',
        text: 'Pause a path to take a break. It stays on your dashboard, marked Paused, and your progress is kept.',
        action: { label: 'Pause', icon: 'pause', to: EnrollmentStatus.Paused },
    },
    [EnrollmentStatus.Paused]: {
        label: 'Paused',
        tone: 'neutral',
        text: 'You\'re taking a break from this path. Resume it to pick up where you left off.',
        action: { label: 'Resume', icon: 'play', to: EnrollmentStatus.Active },
    },
    [EnrollmentStatus.Completed]: {
        label: 'Completed',
        tone: 'success',
        text: 'You finished every required item. It stays on your dashboard for revision.',
    },
    [EnrollmentStatus.Dropped]: {
        label: 'Dropped',
        tone: 'neutral',
        text: 'You stopped following this path, so it isn\'t on your dashboard. Follow it again to bring it back.',
        action: { label: 'Follow again', icon: 'play', to: EnrollmentStatus.Active },
    },
};

const dayMonth = new Intl.DateTimeFormat( 'en-US', { month: 'short', day: 'numeric' } );
const dayMonthYear = new Intl.DateTimeFormat( 'en-US', { month: 'short', day: 'numeric', year: 'numeric' } );

/** "Aug 21" this year, "Aug 21, 2025" before. */
export function formatSince( iso: string, now: Date ): string {
    const date = new Date( iso );

    return date.getFullYear() === now.getFullYear() ? dayMonth.format( date ) : dayMonthYear.format( date );
}

/** Why a change on this page wasn't saved. */
export function saveError( error: unknown, what: string ): string {
    return error instanceof NetworkError
        ? 'Can\'t reach StudyLog right now. Check your connection and try again.'
        : `Something went wrong, so ${what}. Please try again.`;
}
