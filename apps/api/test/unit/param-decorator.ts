import type { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants.js';

/**
 * The function behind a `createParamDecorator()` decorator (e.g. `@CurrentUser()`), to test what it reads from
 * the request. Nest only stores it as route metadata, so it's applied to a throwaway handler and read back.
 */
export function paramDecoratorFactory( decorator: () => ParameterDecorator ) {
    class Target {
        handler() {
            return this;
        }
    }

    decorator()( Target.prototype, 'handler', 0 );

    const args = Reflect.getMetadata( ROUTE_ARGS_METADATA, Target, 'handler' ) as Record<string, { factory: unknown }>;

    return Object.values( args )[0]?.factory as ( data: unknown, context: ExecutionContext ) => unknown;
}

/** An ExecutionContext for an HTTP request. */
export function httpContext( request: object ): ExecutionContext {
    return { switchToHttp: () => ( { getRequest: () => request } ) } as unknown as ExecutionContext;
}
