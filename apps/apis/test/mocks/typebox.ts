type Schema = {
    type?: string;
    properties?: Record<string, Schema>;
    items?: Schema;
    enum?: unknown[];
    const?: unknown;
    format?: string;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    additionalProperties?: boolean;
};

const Type = {
    Object: ( properties: Record<string, Schema>, options: Partial<Schema> = {} ): Schema => ( {
        type: 'object',
        properties,
        ...options,
    } ),
    String: ( options: Partial<Schema> = {} ): Schema => ( {
        type: 'string',
        ...options,
    } ),
    Number: ( options: Partial<Schema> = {} ): Schema => ( {
        type: 'number',
        ...options,
    } ),
    Boolean: ( options: Partial<Schema> = {} ): Schema => ( {
        type: 'boolean',
        ...options,
    } ),
    Literal: ( value: unknown ): Schema => ( {
        const: value,
    } ),
    Enum: ( value: Record<string, unknown> ): Schema => ( {
        enum: Object.values( value ),
    } ),
};

export default Type;
