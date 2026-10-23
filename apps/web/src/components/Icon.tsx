import { createElement } from 'react';

type Shape =
    | [ 'path', { d: string } ]
    | [ 'line', { x1: number; y1: number; x2: number; y2: number } ]
    | [ 'polyline' | 'polygon', { points: string } ]
    | [ 'circle', { cx: number; cy: number; r: number } ]
    | [ 'rect', { x: number; y: number; width: number; height: number; rx?: number } ];

const line = ( x1: number, y1: number, x2: number, y2: number ): Shape => [ 'line', { x1, y1, x2, y2 } ];
const path = ( d: string ): Shape => [ 'path', { d } ];
const polyline = ( points: string ): Shape => [ 'polyline', { points } ];
const circle = ( cx: number, cy: number, r: number ): Shape => [ 'circle', { cx, cy, r } ];
const rect = ( x: number, y: number, width: number, height: number, rx = 0 ): Shape => [ 'rect', { x, y, width, height, rx } ];

/* The outline icons from the Figma file (Feather/Lucide shapes on a 24px grid), drawn in the current text color. */
const ICONS = {
    'arrow-right': [ line( 5, 12, 19, 12 ), polyline( '12 5 19 12 12 19' ) ],
    'bar-chart': [ line( 18, 20, 18, 10 ), line( 12, 20, 12, 4 ), line( 6, 20, 6, 14 ) ],
    'book-open': [ path( 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z' ), path( 'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z' ) ],
    calendar: [ rect( 3, 4, 18, 18, 2 ), line( 16, 2, 16, 6 ), line( 8, 2, 8, 6 ), line( 3, 10, 21, 10 ) ],
    code: [ polyline( '16 18 22 12 16 6' ), polyline( '8 6 2 12 8 18' ) ],
    compass: [ circle( 12, 12, 10 ), [ 'polygon', { points: '16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76' } ] ],
    'check-circle': [ path( 'M22 11.08V12a10 10 0 1 1-5.93-9.14' ), polyline( '22 4 12 14.01 9 11.01' ) ],
    'chevron-down': [ polyline( '6 9 12 15 18 9' ) ],
    'chevron-left': [ polyline( '15 18 9 12 15 6' ) ],
    'chevron-right': [ polyline( '9 18 15 12 9 6' ) ],
    'chevron-up': [ polyline( '18 15 12 9 6 15' ) ],
    circle: [ circle( 12, 12, 10 ) ],
    clock: [ circle( 12, 12, 10 ), polyline( '12 6 12 12 16 14' ) ],
    dashboard: [ rect( 3, 3, 7, 9, 1 ), rect( 14, 3, 7, 5, 1 ), rect( 14, 12, 7, 9, 1 ), rect( 3, 16, 7, 5, 1 ) ],
    'external-link': [
        path( 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' ),
        polyline( '15 3 21 3 21 9' ),
        line( 10, 14, 21, 3 ),
    ],
    edit: [ path( 'M12 20h9' ), path( 'M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z' ) ],
    eye: [ path( 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' ), circle( 12, 12, 3 ) ],
    'file-text': [
        path( 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' ),
        polyline( '14 2 14 8 20 8' ),
        line( 16, 13, 8, 13 ),
        line( 16, 17, 8, 17 ),
    ],
    flag: [ path( 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z' ), line( 4, 22, 4, 15 ) ],
    flame: [
        path( 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5'
            + 'a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z' ),
    ],
    info: [ circle( 12, 12, 10 ), line( 12, 16, 12, 12 ), line( 12, 8, 12.01, 8 ) ],
    layers: [
        [ 'polygon', { points: '12 2 2 7 12 12 22 7 12 2' } ],
        polyline( '2 17 12 22 22 17' ),
        polyline( '2 12 12 17 22 12' ),
    ],
    'log-out': [ path( 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' ), polyline( '16 17 21 12 16 7' ), line( 21, 12, 9, 12 ) ],
    mail: [ path( 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z' ), polyline( '22 6 12 13 2 6' ) ],
    menu: [ line( 3, 12, 21, 12 ), line( 3, 6, 21, 6 ), line( 3, 18, 21, 18 ) ],
    'more-horizontal': [ circle( 12, 12, 1 ), circle( 19, 12, 1 ), circle( 5, 12, 1 ) ],
    pause: [ rect( 6, 4, 4, 16 ), rect( 14, 4, 4, 16 ) ],
    play: [ [ 'polygon', { points: '5 3 19 12 5 21 5 3' } ] ],
    plus: [ line( 12, 5, 12, 19 ), line( 5, 12, 19, 12 ) ],
    search: [ circle( 11, 11, 8 ), line( 21, 21, 16.65, 16.65 ) ],
    shield: [ path( 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' ) ],
    sliders: [
        line( 4, 21, 4, 14 ), line( 4, 10, 4, 3 ), line( 12, 21, 12, 12 ), line( 12, 8, 12, 3 ), line( 20, 21, 20, 16 ),
        line( 20, 12, 20, 3 ), line( 1, 14, 7, 14 ), line( 9, 8, 15, 8 ), line( 17, 16, 23, 16 ),
    ],
    target: [ circle( 12, 12, 10 ), circle( 12, 12, 6 ), circle( 12, 12, 2 ) ],
    'trending-up': [ polyline( '23 6 13.5 15.5 8.5 10.5 1 18' ), polyline( '17 6 23 6 23 12' ) ],
    trash: [
        polyline( '3 6 5 6 21 6' ),
        path( 'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6' ),
        path( 'M10 11v6' ),
        path( 'M14 11v6' ),
        path( 'M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2' ),
    ],
    user: [ path( 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' ), circle( 12, 7, 4 ) ],
    users: [
        path( 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' ),
        circle( 9, 7, 4 ),
        path( 'M23 21v-2a4 4 0 0 0-3-3.87' ),
        path( 'M16 3.13a4 4 0 0 1 0 7.75' ),
    ],
    video: [ [ 'polygon', { points: '23 7 16 12 23 17 23 7' } ], rect( 1, 5, 15, 14, 2 ) ],
    x: [ line( 18, 6, 6, 18 ), line( 6, 6, 18, 18 ) ],
    zap: [ [ 'polygon', { points: '13 2 3 14 12 14 11 22 21 10 12 10 13 2' } ] ],
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof ICONS;

/** A decorative icon (hidden from screen readers): pair it with visible text or an aria-label on its control. */
export function Icon( { name, size = 16, className }: { name: IconName; size?: number; className?: string } ) {
    return (
        <svg
            className={className}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            {( ICONS[name] as Shape[] ).map( ( [ tag, attributes ], index ) =>
                createElement( tag, { key: index, ...attributes } ) )}
        </svg>
    );
}
