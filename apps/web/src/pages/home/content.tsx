import type { ReactNode } from 'react';

/*
 * The homepage's content, apart from its components (so Fast Refresh keeps working and tests can check the page
 * against the same data).
 */

// ---------- Navigation ----------

export const SECTION_LINKS = [
    { href: '#features', label: 'Features' },
    { href: '#how-it-works', label: 'How it works' },
] as const;

// ---------- Features ----------

export interface Feature {
    title: string;
    text: string;
    icon: ReactNode;
}

const icon = ( path: ReactNode ) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        {path}
    </svg>
);

export const FEATURES: Feature[] = [
    {
        title: 'Learning paths',
        text: 'Follow a path like Data Structures & Algorithms from modules down to each topic, or pick just the parts you need.',
        icon: icon( <path d="M4 6h10M4 12h16M4 18h7" /> ),
    },
    {
        title: 'Any kind of material',
        text: 'Problems, articles, videos, books, courses, notes and exercises, all in one place and in the right order.',
        icon: icon(
            <>
                <rect x="4" y="4" width="16" height="16" rx="3" />
                <path d="M9 9h6M9 13h6M9 17h3" />
            </>,
        ),
    },
    {
        title: 'Build your own paths',
        text: 'Create paths in your personal workspace, reuse material from the catalog, and keep them private or share them.',
        icon: icon( <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /> ),
    },
    {
        title: 'Progress that adds up',
        text: 'Mark items done or for revision. Progress rolls up per topic, module and path, and counts in every path it appears in.',
        icon: icon( <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /> ),
    },
    {
        title: 'Sessions and streaks',
        text: 'Log minutes and notes for each study session. See today, this week, your streak and the last 30 days at a glance.',
        icon: icon(
            <>
                <circle cx="12" cy="13" r="8" />
                <path d="M12 9v4l2.5 2M9 2h6" />
            </>,
        ),
    },
    {
        title: 'Study together',
        text: 'Create a study group, invite people by email and share paths with its members, with owners, admins and members.',
        icon: icon(
            <>
                <circle cx="9" cy="8" r="3.5" />
                <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" />
            </>,
        ),
    },
];

// ---------- How it works ----------

export const STEPS = [
    {
        title: 'Pick a path, or build your own',
        text: 'Start from the catalog, choose only the modules and topics you want, and put them in your order.',
    },
    {
        title: 'Study and log your time',
        text: 'Work through problems, videos and notes. Log each session with its minutes and what you learned.',
    },
    {
        title: 'Watch your progress grow',
        text: 'Mark what you finished, see every path fill up, and keep your streak alive day after day.',
    },
] as const;

// ---------- Dashboard preview (example data, as in the Figma home screen) ----------

export const PREVIEW_STATS = [
    { label: 'Today', value: '1h 35m', icon: 'clock' },
    { label: 'Streak', value: '12 days', icon: 'flame' },
    { label: 'Done', value: '42', icon: 'check-circle' },
] as const;

export const PREVIEW_PATHS = [
    { title: 'Data Structures & Algorithms', done: 15, total: 25 },
    { title: 'System Design Fundamentals', done: 3, total: 15 },
] as const;
