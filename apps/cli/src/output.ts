import { styleText } from 'node:util';

/** Terminal output for commands (stdout/stderr, not the Nest logger, so it stays readable and pipeable). */
export const output = {
    info: ( message: string ) => process.stdout.write( `${message}\n` ),
    success: ( message: string ) => process.stdout.write( `${styleText( 'green', '✔' )} ${message}\n` ),
    warn: ( message: string ) => process.stderr.write( `${styleText( 'yellow', '!' )} ${message}\n` ),
    error: ( message: string ) => process.stderr.write( `${styleText( 'red', '✖' )} ${message}\n` ),
    dim: ( message: string ) => styleText( 'dim', message ),
};

/** Runs a command body, printing failures and setting a non-zero exit code instead of throwing a stack trace. */
export async function runSafely( action: () => Promise<void> ): Promise<void> {
    try {
        await action();
    } catch ( error ) {
        output.error( error instanceof Error ? error.message : String( error ) );
        process.exitCode = 1;
    }
}
