import type { IconName } from '../../components/Icon.tsx';

/** Sections in the sidebar whose pages aren't built yet (Figma has their designs). Remove one when its page exists. */
export const UPCOMING = {
    admin: {
        path: '/app/admin',
        title: 'Admin',
        icon: 'shield',
        text: 'Manage the global catalog and review paths people reported.',
    },
} satisfies Record<string, { path: string; title: string; icon: IconName; text: string }>;

export type UpcomingPage = keyof typeof UPCOMING;
