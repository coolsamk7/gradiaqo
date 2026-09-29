import type { EnrollmentDetailJson, EnrollmentJson } from '@studylog/schemas';
import { EnrollmentStatus } from '@studylog/schemas/enums';
import { useEffect, useState } from 'react';

import { useAuth } from '../../auth/auth-context.ts';

export type Loadable<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; value: T };

interface TreeAnswer {
    pathId: string;
    tree: Loadable<EnrollmentDetailJson>;
}

/**
 * What a new session can be about: the learning paths the user follows (not dropped ones), and the modules,
 * topics and items of the chosen one. `pathId` is the chosen path's enrollment id ('' for none yet). Loads nothing
 * unless `enabled` (editing a session doesn't change what it's about).
 */
export function useStudyOptions( pathId: string, enabled: boolean ) {
    const { request } = useAuth();
    const [ paths, setPaths ] = useState<Loadable<EnrollmentJson[]>>( { status: 'loading' } );
    // The last answer, and which path it was for: anything else is still loading.
    const [ answer, setAnswer ] = useState<TreeAnswer>();

    useEffect( () => {
        if ( !enabled ) {
            return;
        }
        request<EnrollmentJson[]>( '/me/enrollments' ).then(
            ( value ) => setPaths( {
                status: 'ready',
                value: value.filter( ( enrollment ) => enrollment.status !== EnrollmentStatus.Dropped ),
            } ),
            () => setPaths( { status: 'error' } ),
        );
    }, [ request, enabled ] );

    useEffect( () => {
        if ( !pathId ) {
            return undefined;
        }

        // Switching paths quickly: only the last choice's answer counts.
        let current = true;

        request<EnrollmentDetailJson>( `/me/enrollments/${pathId}` ).then(
            ( value ) => current && setAnswer( { pathId, tree: { status: 'ready', value } } ),
            () => current && setAnswer( { pathId, tree: { status: 'error' } } ),
        );

        return () => {
            current = false;
        };
    }, [ request, pathId ] );

    return { paths, tree: pathId ? treeFor( pathId, answer ) : undefined };
}

/** The chosen path's tree: the last answer if it is for this path, otherwise still loading. */
function treeFor( pathId: string, answer: TreeAnswer | undefined ): Loadable<EnrollmentDetailJson> {
    return answer?.pathId === pathId ? answer.tree : { status: 'loading' };
}

export type StudyOptions = ReturnType<typeof useStudyOptions>;
