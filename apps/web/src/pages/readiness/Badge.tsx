import app from '../../styles/app.module.css';
import type { Tone } from './readiness.ts';

const TONES: Record<Tone, string> = {
    success: app.badgeSuccess,
    warning: app.badgeWarning,
    danger: app.badgeDanger,
    neutral: '',
};

/** A short label in a colored pill (Figma: Badge). */
export function Badge( { tone, children }: { tone: Tone; children: string } ) {
    return <span className={`${app.badge} ${TONES[tone]}`}>{children}</span>;
}
