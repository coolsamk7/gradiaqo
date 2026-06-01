type Schema = {
    type?: string;
    properties?: Record<string, Schema>;
    enum?: unknown[];
    const?: unknown;
    format?: string;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
};

export function Clone<T>( value: T ): T {
    return value === undefined ? value : JSON.parse( JSON.stringify( value ) );
}

export function Convert( schema: Schema, value: unknown ): unknown {
    if ( schema.type === 'object' && schema.properties && typeof value === 'object' && value !== null ) {
        return Object.fromEntries(
            Object.entries( schema.properties )
                .map( ( [ key, childSchema ] ) => [ key, Convert( childSchema, ( value as Record<string, unknown> )[key] ) ] )
                .filter( ( [ , childValue ] ) => childValue !== undefined )
        );
    }

    if ( schema.type === 'string' && value !== undefined && value !== null ) {
        return String( value );
    }

    if ( schema.type === 'number' && value !== undefined && value !== null ) {
        return Number( value );
    }

    return value;
}

export function Assert( schema: Schema, value: unknown ): void {
    if ( schema.type === 'object' ) {
        if ( typeof value !== 'object' || value === null ) {
            throw new Error( 'Expected object.' );
        }

        for ( const [ key, childSchema ] of Object.entries( schema.properties ?? {} ) ) {
            Assert( childSchema, ( value as Record<string, unknown> )[key] );
        }
        return;
    }

    if ( schema.type === 'string' ) {
        if ( typeof value !== 'string' ) {
            throw new Error( 'Expected string.' );
        }

        if ( schema.minLength && value.length < schema.minLength ) {
            throw new Error( 'String is too short.' );
        }

        if ( schema.maxLength && value.length > schema.maxLength ) {
            throw new Error( 'String is too long.' );
        }

        if ( schema.pattern && !new RegExp( schema.pattern ).test( value ) ) {
            throw new Error( 'String pattern mismatch.' );
        }

        if ( schema.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( value ) ) {
            throw new Error( 'Invalid email.' );
        }
        return;
    }

    if ( schema.type === 'number' && ( typeof value !== 'number' || Number.isNaN( value ) ) ) {
        throw new Error( 'Expected number.' );
    }

    if ( schema.enum && !schema.enum.includes( value ) ) {
        throw new Error( 'Invalid enum value.' );
    }

    if ( 'const' in schema && schema.const !== value ) {
        throw new Error( 'Invalid literal value.' );
    }
}
