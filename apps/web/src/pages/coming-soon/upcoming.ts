import type { IconName } from '../../components/Icon.tsx';

/** Sections in the sidebar whose pages aren't built yet (Figma has their designs). Remove one when its page exists. */
export const UPCOMING = {
    catalog: {
        path: '/app/catalog',
        title: 'Browse paths',
        icon: 'compass',
        text: 'Find learning paths to follow: the official catalog, your organizations\' paths and paths shared by the community.',
    },
    analytics: {
        path: '/app/analytics',
        title: 'Analytics',
        icon: 'bar-chart',
        text: 'How you study and where to focus next: time per week and per path, progress by difficulty, and topics that need attention.',
    },
    readiness: {
        path: '/app/interview-ready',
        title: 'Interview ready',
        icon: 'target',
        text: 'Set an interview goal and see how ready you are: a score, a checklist for each area and your next steps.',
    },
    myPaths: {
        path: '/app/my-paths',
        title: 'My paths',
        icon: 'layers',
        text: 'Build your own learning paths from your notes and problems, or reuse items from the catalog.',
    },
    organizations: {
        path: '/app/organizations',
        title: 'Organizations',
        icon: 'users',
        text: 'Study together: create a group, invite people and share paths with everyone in it.',
    },
    admin: {
        path: '/app/admin',
        title: 'Admin',
        icon: 'shield',
        text: 'Manage the global catalog and review paths people reported.',
    },
    settings: {
        path: '/app/settings',
        title: 'Settings',
        icon: 'sliders',
        text: 'Your profile, password, reminders and data.',
    },
} satisfies Record<string, { path: string; title: string; icon: IconName; text: string }>;

export type UpcomingPage = keyof typeof UPCOMING;
