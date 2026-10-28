// Combines each app's and package's coverage/coverage-summary.json (written by `vitest run --coverage`) into one
// table in the terminal, a root coverage/index.html that links to every package's full report, and
// coverage/summary.md, which CI posts on pull requests. Run through `yarn test:cov`.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join( import.meta.dirname, '..' );
const METRICS = /** @type {const} */ ( [ 'lines', 'branches', 'functions', 'statements' ] );

/** @typedef {{ total: number; covered: number }} Count */
/** @typedef {Record<typeof METRICS[number], Count>} Summary */

const rows = [ 'apps', 'packages' ]
    .flatMap( ( group ) => readdirSync( join( ROOT, group ) ).map( ( name ) => join( ROOT, group, name ) ) )
    .filter( ( dir ) => existsSync( join( dir, 'coverage', 'coverage-summary.json' ) ) )
    .map( ( dir ) => ( {
        name: JSON.parse( readFileSync( join( dir, 'package.json' ), 'utf8' ) ).name,
        report: relative( join( ROOT, 'coverage' ), join( dir, 'coverage', 'index.html' ) ),
        /** @type {Summary} */
        summary: JSON.parse( readFileSync( join( dir, 'coverage', 'coverage-summary.json' ), 'utf8' ) ).total,
    } ) );

if ( rows.length === 0 ) {
    console.error( 'No coverage reports found. Run `yarn test:cov`.' );
    process.exit( 1 );
}

/** @type {Summary} */
const total = Object.fromEntries( METRICS.map( ( metric ) => [ metric, {
    total: rows.reduce( ( sum, row ) => sum + row.summary[metric].total, 0 ),
    covered: rows.reduce( ( sum, row ) => sum + row.summary[metric].covered, 0 ),
} ] ) );

/** @param {Count} count */
const percent = ( { total: all, covered } ) => ( all === 0 ? 100 : ( covered / all ) * 100 );
const format = ( /** @type {Count} */ count ) => `${percent( count ).toFixed( 1 )}%`;

// ---------- Terminal ----------

const nameWidth = Math.max( 'Total'.length, ...rows.map( ( row ) => row.name.length ) );
const COLUMN = 12;
const line = ( name, cells ) => `${name.padEnd( nameWidth )}${cells.map( ( cell ) => cell.padStart( COLUMN ) ).join( '' )}`;

console.log( `\n${line( 'Coverage', METRICS.map( ( metric ) => metric[0].toUpperCase() + metric.slice( 1 ) ) )}` );
console.log( '-'.repeat( nameWidth + COLUMN * METRICS.length ) );
for ( const row of rows ) {
    console.log( line( row.name, METRICS.map( ( metric ) => format( row.summary[metric] ) ) ) );
}
console.log( '-'.repeat( nameWidth + COLUMN * METRICS.length ) );
console.log( line( 'Total', METRICS.map( ( metric ) => format( total[metric] ) ) ) );

// ---------- HTML ----------

const cell = ( /** @type {Count} */ count ) => {
    const value = percent( count );
    const level = value >= 80 ? 'high' : value >= 60 ? 'medium' : 'low';

    return `<td class="${level}">${value.toFixed( 1 )}%<small>${count.covered}/${count.total}</small></td>`;
};
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Gradiaqo coverage</title>
<style>
  :root { color-scheme: light dark; --high: #1a7f37; --medium: #9a6700; --low: #cf222e; }
  body { font: 15px/1.5 system-ui, sans-serif; margin: 2rem auto; max-width: 60rem; padding: 0 1rem; }
  table { border-collapse: collapse; width: 100%; }
  th, td { padding: .5rem .75rem; border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent); text-align: right; }
  th:first-child, td:first-child { text-align: left; }
  small { display: block; opacity: .6; font-size: .75rem; }
  .high { color: var(--high); } .medium { color: var(--medium); } .low { color: var(--low); }
  tfoot td { font-weight: 600; }
</style>
</head>
<body>
<h1>Test coverage</h1>
<p>Generated ${new Date().toISOString()} by <code>yarn test:cov</code>. Click a package for its line-by-line report.</p>
<table>
<thead><tr><th>Package</th>${METRICS.map( ( metric ) => `<th>${metric}</th>` ).join( '' )}</tr></thead>
<tbody>
${rows.map( ( row ) => `<tr><td><a href="${row.report}">${row.name}</a></td>${METRICS.map( ( metric ) => cell( row.summary[metric] ) ).join( '' )}</tr>` ).join( '\n' )}
</tbody>
<tfoot><tr><td>Total</td>${METRICS.map( ( metric ) => cell( total[metric] ) ).join( '' )}</tr></tfoot>
</table>
</body>
</html>
`;

// ---------- Markdown (the pull request comment) ----------

// Every package must stay at 100% (see packages/common/vitest/coverage.js), so anything less is flagged.
const mdCell = ( /** @type {Count} */ count ) => `${percent( count ) < 100 ? '⚠️ ' : ''}${format( count )}`;
const markdown = [
    '## Test coverage',
    '',
    `| Package | ${METRICS.map( ( metric ) => metric[0].toUpperCase() + metric.slice( 1 ) ).join( ' | ' )} |`,
    `| --- | ${METRICS.map( () => '---:' ).join( ' | ' )} |`,
    ...rows.map( ( row ) => `| \`${row.name}\` | ${METRICS.map( ( metric ) => mdCell( row.summary[metric] ) ).join( ' | ' )} |` ),
    `| **Total** | ${METRICS.map( ( metric ) => `**${mdCell( total[metric] )}**` ).join( ' | ' )} |`,
    '',
].join( '\n' );

mkdirSync( join( ROOT, 'coverage' ), { recursive: true } );
writeFileSync( join( ROOT, 'coverage', 'index.html' ), html );
writeFileSync( join( ROOT, 'coverage', 'summary.md' ), markdown );
console.log( `\nFull reports: ${relative( process.cwd(), join( ROOT, 'coverage', 'index.html' ) )}\n` );
