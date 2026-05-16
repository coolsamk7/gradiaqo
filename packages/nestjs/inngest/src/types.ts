import { Inngest } from 'inngest'

export type CreateFunctionParams<T extends Inngest.Any = Inngest.Any> = Parameters<T['createFunction']>

export type CreateFunctionArg<T extends Inngest.Any = Inngest.Any> = CreateFunctionParams<T>[0]
export type CreateFunctionOptions<T extends Inngest.Any = Inngest.Any> = CreateFunctionParams<T>[1]
