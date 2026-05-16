import { Inject } from '@nestjs/common'
import { INNGEST_FUNCTION, INNGEST_KEY } from './constants'
import { CreateFunctionArg, CreateFunctionOptions } from './types'
import { Inngest } from 'inngest'

export const InjectInngestService = () => {
    return Inject( INNGEST_KEY )
}

export const NestjsInngestFunction = <T extends Inngest.Any = Inngest.Any>(
    arg: CreateFunctionArg<T>,
    options?: CreateFunctionOptions<T>
) => {
    return ( target: object, key: string | symbol, descriptor: PropertyDescriptor ) => {
        Reflect.defineMetadata( INNGEST_FUNCTION, [ arg, options ?? {} ], descriptor.value )
    }
}
