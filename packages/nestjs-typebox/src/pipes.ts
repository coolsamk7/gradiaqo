import type { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { Injectable } from '@nestjs/common';

import { TypeboxValidationException } from './exceptions.js';
import { isTypeboxSchema, validatedByRoutePipe } from './schema.js';

/**
 * Global pipe for `@Body( { schema } )`, `@Query( { schema } )` and `@Param( name, { schema } )` with
 * `typebox()` schemas. Arguments without a TypeBox schema pass through untouched, so it can sit next
 * to other validation. Schemas added by `@Validate()` / `@HttpEndpoint()` are skipped: they have their own pipe.
 *
 * @example
 * app.useGlobalPipes( new TypeboxValidationPipe() );
 */
@Injectable()
export class TypeboxValidationPipe implements PipeTransform {
    transform( value: unknown, metadata: ArgumentMetadata ): unknown {
        const { schema, type } = metadata;

        if ( !isTypeboxSchema( schema ) || validatedByRoutePipe.has( schema ) || type === 'custom' ) {
            return value;
        }

        const result = schema.safeParse( value );

        if ( result.issues ) {
            throw new TypeboxValidationException( type, result.issues );
        }

        return result.value;
    }
}
