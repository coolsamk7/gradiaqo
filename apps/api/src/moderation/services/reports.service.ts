import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { User } from '@studylog/database';
import { LearningPath, Membership, PathReport, PathVisibility, ReportStatus } from '@studylog/database';
import type { CreateReportRequest, ListReportsQuery, Report, ReportPage, ResolveReportRequest } from '@studylog/schemas';
import { ReportAction } from '@studylog/schemas';
import type { FindOptionsOrder } from 'typeorm';
import { DataSource, In } from 'typeorm';

import { saveUnique } from '../../catalog/catalog.helpers.js';
import { CatalogAccessService } from '../../catalog/services/catalog-access.service.js';

/** Users flag other people's public paths; superadmins review the reports. */
@Injectable()
export class ReportsService {
    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly catalogAccess: CatalogAccessService,
    ) {}

    /** Only public paths from other users can be reported: official ones are the admins' own. */
    async create( userId: string, pathId: string, dto: CreateReportRequest ): Promise<Report> {
        const path = await this.dataSource.getRepository( LearningPath ).findOneBy( { id: pathId } );

        if ( !path || !( await this.catalogAccess.canSeePath( userId, path ) ) ) {
            throw new NotFoundException( 'Learning path not found' );
        }
        if ( path.organizationId === null || path.visibility !== PathVisibility.Public ) {
            throw new BadRequestException( 'Only public paths shared by users can be reported' );
        }
        const isOwnPath = await this.dataSource.getRepository( Membership ).existsBy( {
            userId,
            organizationId: path.organizationId,
        } );

        if ( isOwnPath ) {
            throw new BadRequestException( 'You can\'t report your own path' );
        }

        const reports = this.dataSource.getRepository( PathReport );
        const report = await saveUnique(
            () => reports.save( reports.create( {
                learningPathId: pathId,
                reporterId: userId,
                reason: dto.reason,
                details: dto.details ?? null,
            } ) ),
            'You already reported this path; a moderator will look at it',
        );

        return this.findView( report.id );
    }

    /** Reports with the given status (default: open), oldest first, so the queue is worked in order. */
    /** Open reports oldest first (the queue); resolved ones most recently resolved first. */
    async list( { status = ReportStatus.Open, limit = 50, offset = 0 }: ListReportsQuery ): Promise<ReportPage> {
        const resolved = status === 'resolved';
        const order: FindOptionsOrder<PathReport> = resolved || status !== ReportStatus.Open
            ? { resolvedAt: 'DESC', id: 'ASC' }
            : { createdAt: 'ASC', id: 'ASC' };
        const [ reports, total ] = await this.dataSource.getRepository( PathReport ).findAndCount( {
            where: { status: resolved ? In( [ ReportStatus.Dismissed, ReportStatus.Actioned ] ) : status },
            relations: VIEW_RELATIONS,
            order,
            take: limit,
            skip: offset,
        } );

        return { items: reports.map( toView ), total };
    }

    /**
     * `dismiss` closes the report. `hide_path` makes the path private for good (its owner keeps it) and closes
     * every open report on it.
     */
    async resolve( moderatorId: string, id: string, { action, note }: ResolveReportRequest ): Promise<Report> {
        await this.dataSource.transaction( async ( manager ) => {
            const report = await manager.findOneBy( PathReport, { id } );

            if ( !report ) {
                throw new NotFoundException( 'Report not found' );
            }
            if ( report.status !== ReportStatus.Open ) {
                throw new ConflictException( 'This report is already resolved' );
            }

            const resolution = { resolvedById: moderatorId, resolvedAt: new Date(), resolutionNote: note ?? null };

            if ( action === ReportAction.Dismiss ) {
                await manager.update( PathReport, { id }, { ...resolution, status: ReportStatus.Dismissed } );

                return;
            }

            await manager.update(
                LearningPath,
                { id: report.learningPathId },
                { visibility: PathVisibility.Private, publicBlockedAt: new Date() },
            );
            await manager.update(
                PathReport,
                { learningPathId: report.learningPathId, status: ReportStatus.Open },
                { ...resolution, status: ReportStatus.Actioned },
            );
        } );

        return this.findView( id );
    }

    /**
     * Lets a path hidden by mistake be public again: clears `publicBlockedAt`. It stays private until its owner makes
     * it public; its reports keep their history.
     */
    async unhide( pathId: string ): Promise<void> {
        const paths = this.dataSource.getRepository( LearningPath );
        const path = await paths.findOneBy( { id: pathId } );

        if ( !path ) {
            throw new NotFoundException( 'Learning path not found' );
        }
        if ( !path.publicBlockedAt ) {
            throw new ConflictException( 'This path isn\'t hidden' );
        }

        await paths.update( { id: pathId }, { publicBlockedAt: null } );
    }

    private async findView( id: string ): Promise<Report> {
        return toView( await this.dataSource.getRepository( PathReport ).findOneOrFail( {
            where: { id },
            relations: VIEW_RELATIONS,
        } ) );
    }
}

const VIEW_RELATIONS = { learningPath: { createdBy: true }, reporter: true, resolvedBy: true };

const personOf = ( user: User | null ) => user && { id: user.id, firstName: user.firstName, lastName: user.lastName };

function toView( report: PathReport ): Report {
    const { id, reason, details, status, resolutionNote, resolvedAt, createdAt } = report;
    const { learningPath, reporter, resolvedBy } = report;

    return {
        id,
        reason,
        details,
        status,
        resolutionNote,
        resolvedAt,
        createdAt,
        learningPath: {
            id: learningPath.id,
            title: learningPath.title,
            organizationId: learningPath.organizationId,
            visibility: learningPath.visibility,
            publicBlockedAt: learningPath.publicBlockedAt,
            createdBy: personOf( learningPath.createdBy ),
        },
        resolvedBy: personOf( resolvedBy ),
        reporter: reporter && {
            id: reporter.id,
            email: reporter.email,
            firstName: reporter.firstName,
            lastName: reporter.lastName,
        },
    };
}
