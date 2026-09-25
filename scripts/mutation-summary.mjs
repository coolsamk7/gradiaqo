// Combines each app's and package's reports/mutation/mutation.json (written by `stryker run`) into one table.
// Run through `yarn test:mutation`.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join( import.meta.dirname, '..' );
const DETECTED = new Set( [ 'Killed', 'Timeout' ] );
const UNDETECTED = new Set( [ 'Survived', 'NoCoverage' ] );

const rows = [ 'apps', 'packages' ]
    .flatMap( ( group ) => readdirSync( join( ROOT, group ) ).map( ( name ) => join( ROOT, group, name ) ) )
    .filter( ( dir ) => existsSync( join( dir, 'reports', 'mutation', 'mutation.json' ) ) )
    .map( ( dir ) => {
        const report = JSON.parse( readFileSync( join( dir, 'reports', 'mutation', 'mutation.json' ), 'utf8' ) );
        const mutants = Object.values( report.files ).flatMap( ( file ) => file.mutants );

        return {
            name: JSON.parse( readFileSync( join( dir, 'package.json' ), 'utf8' ) ).name,
            report: relative( process.cwd(), join( dir, 'reports', 'mutation', 'mutation.html' ) ),
            killed: mutants.filter( ( mutant ) => DETECTED.has( mutant.status ) ).length,
            survived: mutants.filter( ( mutant ) => UNDETECTED.has( mutant.status ) ).length,
        };
    } );

if ( rows.length === 0 ) {
    console.error( 'No mutation reports found. Run `yarn test:mutation`.' );
    process.exit( 1 );
}

const score = ( { killed, survived } ) => ( killed + survived === 0 ? 100 : ( killed / ( killed + survived ) ) * 100 );
const total = rows.reduce( ( sum, row ) => ( { killed: sum.killed + row.killed, survived: sum.survived + row.survived } ), { killed: 0, survived: 0 } );
const width = Math.max( 'Total'.length, ...rows.map( ( row ) => row.name.length ) );
const line = ( name, cells ) => `${name.padEnd( width )}${cells.map( ( cell ) => String( cell ).padStart( 10 ) ).join( '' )}`;

console.log( `\n${line( 'Mutation', [ 'Score', 'Killed', 'Survived' ] )}` );
console.log( '-'.repeat( width + 30 ) );
for ( const row of rows ) {
    console.log( line( row.name, [ `${score( row ).toFixed( 1 )}%`, row.killed, row.survived ] ) );
}
console.log( '-'.repeat( width + 30 ) );
console.log( line( 'Total', [ `${score( total ).toFixed( 1 )}%`, total.killed, total.survived ] ) );
console.log( `\nReports: ${rows.map( ( row ) => row.report ).join( ', ' )}\n` );
