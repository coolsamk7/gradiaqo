import type { TSchema } from 'typebox';
import Type from 'typebox';

export interface SchemaAnalysis {
    /** Contains a `Type.Codec` anywhere, so values must be decoded / encoded. */
    hasCodec: boolean;
    /** Contains a `default` anywhere, so defaults must be applied before checking. */
    hasDefault: boolean;
}

/**
 * Walks a schema once to find out which (relatively expensive) value passes validation needs.
 * TypeBox 1.x schemas are plain JSON Schema objects, so a generic walk covers every kind.
 */
export function analyzeSchema( schema: TSchema ): SchemaAnalysis {
    const analysis: SchemaAnalysis = { hasCodec: false, hasDefault: false };
    const seen = new Set<object>();

    const visit = ( node: unknown ): void => {
        if ( node === null || typeof node !== 'object' || seen.has( node ) ) {
            return;
        }
        seen.add( node );

        if ( Type.IsCodec( node ) ) {
            analysis.hasCodec = true;
        }
        if ( 'default' in node ) {
            analysis.hasDefault = true;
        }
        for ( const child of Object.values( node ) ) {
            visit( child );
        }
    };

    visit( schema );

    return analysis;
}
