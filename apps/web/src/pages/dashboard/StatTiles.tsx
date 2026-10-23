import type { StudyStats } from '@studylog/schemas';

import type { StatTile } from '../../components/StatTiles.tsx';
import { StatTiles as StatTileList } from '../../components/StatTiles.tsx';
import { formatDays, formatMinutes } from '../../format/format.ts';

/** The headline numbers: time today, this week and in total, the streak, and items completed. */
export function StatTiles( { stats, paths }: { stats: StudyStats; paths: number } ) {
    const tiles: StatTile[] = [
        { label: 'Today', value: formatMinutes( stats.todayMinutes ), detail: versusYesterday( stats ), icon: 'clock' },
        { label: 'This week', value: formatMinutes( stats.weekMinutes ), detail: 'Mon–Sun', icon: 'calendar' },
        {
            label: 'Streak',
            value: formatDays( stats.currentStreakDays ),
            detail: `Best: ${formatDays( stats.longestStreakDays )}`,
            icon: 'flame',
        },
        { label: 'Total', value: formatMinutes( stats.totalMinutes ), detail: 'All time', icon: 'trending-up' },
        {
            label: 'Items completed',
            value: String( stats.itemsCompleted ),
            detail: `Across ${paths} ${paths === 1 ? 'path' : 'paths'}`,
            icon: 'check-circle',
        },
    ];

    return <StatTileList tiles={tiles} />;
}

/** Today against yesterday: "+30m vs yesterday", "−15m vs yesterday" or "Same as yesterday". */
function versusYesterday( stats: StudyStats ): string {
    const difference = stats.todayMinutes - ( stats.last30Days.at( -2 )?.minutes ?? 0 );

    if ( difference === 0 ) {
        return 'Same as yesterday';
    }

    return `${difference > 0 ? '+' : '−'}${formatMinutes( Math.abs( difference ) )} vs yesterday`;
}
