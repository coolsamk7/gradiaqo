import type { StaticDecode } from 'typebox';
import Type from 'typebox';

export const HealthResponse = Type.Object( {
    status: Type.Union( [ Type.Literal( 'ok' ), Type.Literal( 'error' ) ] ),
    database: Type.Union( [ Type.Literal( 'up' ), Type.Literal( 'down' ) ] ),
} );
export type HealthResponse = StaticDecode<typeof HealthResponse>;
