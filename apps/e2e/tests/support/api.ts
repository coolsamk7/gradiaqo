import { randomUUID } from 'node:crypto';

import type { APIRequestContext } from '@playwright/test';
import type { EnrollmentDetailJson, EnrollmentJson, StudySessionJson } from '@studylog/schemas';

import { PASSWORD } from '../../settings.ts';

export interface TestUser {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    /** An access token for setting things up through the API (valid for 15 minutes). */
    token: string;
}

interface Named { id: string; title: string }

/** A published path as `GET /catalog/paths/:pathId` returns it: only what the tests use. */
interface CatalogPath {
    id: string;
    title: string;
    modules: { id: string; title: string; topics: { id: string; title: string; items: Named[] }[] }[];
}

interface Rule { scope: 'module' | 'topic' | 'item'; title: string; mode: 'include' | 'exclude' }

/** What to log: topic and item by title; it ended `minutesAgo` (default 5) ago and took 30 minutes by default. */
interface SessionSpec { topic: string; item?: string; minutesAgo?: number; durationMinutes?: number; notes?: string }

/**
 * Sets up data straight through the API, so a test can start from the state it needs (a new user, enrolled, with
 * sessions) and only drive the screens it's about. Tests that change data use their own new user, because tests run
 * in parallel against one database.
 */
export class Api {
    private readonly request: APIRequestContext;

    constructor( request: APIRequestContext ) {
        this.request = request;
    }

    /** A brand-new account, with a unique email. */
    async signUp( firstName = 'Tess' ): Promise<TestUser> {
        const user = { email: `e2e-${randomUUID()}@example.com`, password: PASSWORD, firstName, lastName: 'Tester' };
        const { accessToken } = await this.call<{ accessToken: string }>( 'POST', '/auth/signup', undefined, user );

        return { ...user, token: accessToken };
    }

    /** An access token for an existing user, e.g. a dummy one from the seed. */
    async logIn( email: string, password = PASSWORD ): Promise<string> {
        const { accessToken } = await this.call<{ accessToken: string }>( 'POST', '/auth/login', undefined, { email, password } );

        return accessToken;
    }

    /** Enrolls `user` in the published path called `title`. `rules` name modules, topics or items by title. */
    async enroll( user: TestUser, title: string, rules: Rule[] = [] ): Promise<EnrollmentDetailJson> {
        const paths = await this.call<{ id: string; title: string }[]>( 'GET', '/catalog/paths', user.token );
        const found = paths.find( ( path ) => path.title === title );

        if ( !found ) {
            throw new Error( `No published path called "${title}"` );
        }

        const path = await this.call<CatalogPath>( 'GET', `/catalog/paths/${found.id}`, user.token );

        return this.call<EnrollmentDetailJson>( 'POST', '/me/enrollments', user.token, {
            learningPathId: path.id,
            rules: rules.map( ( rule ) => ( { scope: rule.scope, scopeId: idOf( path, rule ), mode: rule.mode } ) ),
        } );
    }

    async enrollments( token: string ): Promise<EnrollmentJson[]> {
        return this.call<EnrollmentJson[]>( 'GET', '/me/enrollments', token );
    }

    /** Logs a session against a topic (and optionally an item) of an enrollment, found by title. */
    async logSession(
        user: TestUser,
        enrollment: EnrollmentDetailJson,
        session: SessionSpec,
    ): Promise<StudySessionJson> {
        const topics = enrollment.modules.flatMap( ( module ) => module.topics );
        const topic = topics.find( ( t ) => t.title === session.topic );
        const item = topic?.items.find( ( i ) => i.title === session.item );

        if ( !topic || ( session.item && !item ) ) {
            const what = session.item ? `item "${session.item}" in topic "${session.topic}"` : `topic "${session.topic}"`;

            throw new Error( `No ${what} in the enrollment` );
        }

        return this.call<StudySessionJson>( 'POST', '/me/study-sessions', user.token, {
            topicId: topic.id,
            ...( item && { itemId: item.id } ),
            startedAt: new Date( Date.now() - ( session.minutesAgo ?? 5 ) * 60_000 ).toISOString(),
            durationMinutes: session.durationMinutes ?? 30,
            notes: session.notes ?? null,
        } );
    }

    private async call<T>( method: string, url: string, token?: string, data?: unknown ): Promise<T> {
        const response = await this.request.fetch( url, {
            method,
            data,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        } );

        if ( !response.ok() ) {
            throw new Error( `${method} ${url} failed with ${response.status()}: ${await response.text()}` );
        }

        return ( await response.json() ) as T;
    }
}

function idOf( path: CatalogPath, rule: Rule ): string {
    const modules = path.modules;
    const topics = modules.flatMap( ( module ) => module.topics );
    const items = topics.flatMap( ( topic ) => topic.items );
    const candidates = { module: modules, topic: topics, item: items }[rule.scope];
    const found = candidates.find( ( candidate ) => candidate.title === rule.title );

    if ( !found ) {
        throw new Error( `No ${rule.scope} "${rule.title}" in "${path.title}"` );
    }

    return found.id;
}
