import { Context, EventSchemas, Inngest } from 'inngest';
import { TriggersFromClient } from 'inngest/types';

export const MinionEvents = new EventSchemas().fromRecord<{
    'users/user.created': {
        data: {
            id: string;
            email: string;
            mobilenumber?: string;
            roles?: string[];
        };
    };
}>();
export type MinionInngestClientOpts = {
    id: 'minion/app';
    schemas: typeof MinionEvents;
};

export type MinionEventSchema = typeof MinionEvents;
export type MinionInngestClient = Inngest<MinionInngestClientOpts>;

export type MinionContext<
    TTriggers extends TriggersFromClient<MinionInngestClient> = TriggersFromClient<MinionInngestClient>,
    TOverrides extends Record<string, unknown> = Record<never, never>,
> = Context<MinionInngestClient, TTriggers, TOverrides>;
