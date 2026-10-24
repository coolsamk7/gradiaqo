import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { StudySession, TopicItem } from '@studylog/database';
import type {
    CreateStudySessionRequest,
    ListStudySessionsQuery,
    StudySessionPage,
    UpdateStudySessionRequest,
} from '@studylog/schemas';
import type { FindOptionsWhere } from 'typeorm';
import { And, DataSource, LessThan, MoreThanOrEqual } from 'typeorm';

import { CatalogAccessService } from '../../catalog/services/catalog-access.service.js';

/** Allowed clock difference between the user's device and the server. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

@Injectable()
export class StudySessionsService {
    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly catalogAccess: CatalogAccessService,
    ) {}

    /** The user's sessions, newest first. */
    async list(
        userId: string,
        { from, to, topicId, itemId, limit = 50, offset = 0 }: ListStudySessionsQuery,
    ): Promise<StudySessionPage> {
        const startedAt = dateRange( from, to );
        const where: FindOptionsWhere<StudySession> = {
            userId,
            ...( startedAt && { startedAt } ),
            ...( topicId && { topicId } ),
            ...( itemId && { itemId } ),
        };
        const [ items, total ] = await this.dataSource.getRepository( StudySession ).findAndCount( {
            where,
            // Only their titles reach the response (see StudySessionListItem).
            relations: { topic: true, item: true },
            order: { startedAt: 'DESC', id: 'ASC' },
            take: limit,
            skip: offset,
        } );

        return { items, total };
    }

    async create( userId: string, dto: CreateStudySessionRequest ): Promise<StudySession> {
        const session = { topicId: null, itemId: null, notes: null, ...dto };

        await this.validate( userId, session, { topic: true, item: true } );

        return this.dataSource.getRepository( StudySession ).save(
            this.dataSource.getRepository( StudySession ).create( { ...session, userId } ),
        );
    }

    async update( userId: string, id: string, dto: UpdateStudySessionRequest ): Promise<StudySession> {
        const session = await this.findOrFail( userId, id );

        Object.assign( session, dto );
        // Only check what changed: a session stays editable if its topic or item is archived later.
        await this.validate( userId, session, { topic: dto.topicId !== undefined, item: dto.itemId !== undefined } );

        return this.dataSource.getRepository( StudySession ).save( session );
    }

    async remove( userId: string, id: string ): Promise<void> {
        const { affected } = await this.dataSource.getRepository( StudySession ).delete( { id, userId } );

        if ( !affected ) {
            throw new NotFoundException( 'Study session not found' );
        }
    }

    private async findOrFail( userId: string, id: string ): Promise<StudySession> {
        const session = await this.dataSource.getRepository( StudySession ).findOneBy( { id, userId } );

        if ( !session ) {
            throw new NotFoundException( 'Study session not found' );
        }

        return session;
    }

    /**
     * A session is about a topic and/or an item (the item in that topic, if both), and not in the future.
     * `check` says which references to verify are visible to the user.
     */
    private async validate(
        userId: string,
        { topicId, itemId, startedAt }: Pick<StudySession, 'topicId' | 'itemId' | 'startedAt'>,
        check: { topic: boolean; item: boolean },
    ): Promise<void> {
        if ( !topicId && !itemId ) {
            throw new BadRequestException( 'A study session needs a topicId, an itemId or both' );
        }
        if ( startedAt.getTime() > Date.now() + FUTURE_TOLERANCE_MS ) {
            throw new BadRequestException( 'startedAt can\'t be in the future' );
        }

        if ( check.topic && topicId && !( await this.catalogAccess.canSeeTopic( userId, topicId ) ) ) {
            throw new NotFoundException( 'Topic not found' );
        }
        if ( check.item && itemId && !( await this.catalogAccess.canSeeItem( userId, itemId ) ) ) {
            throw new NotFoundException( 'Item not found' );
        }

        const linkChanged = check.topic || check.item;

        if ( linkChanged && topicId && itemId
            && !( await this.dataSource.getRepository( TopicItem ).existsBy( { topicId, itemId } ) ) ) {
            throw new BadRequestException( 'This item is not in this topic' );
        }
    }
}

function dateRange( from?: Date, to?: Date ) {
    if ( from && to ) {
        return And( MoreThanOrEqual( from ), LessThan( to ) );
    }
    if ( from ) {
        return MoreThanOrEqual( from );
    }

    return to ? LessThan( to ) : undefined;
}
