import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { LearningPath, Membership, PathReport, PathVisibility, ReportStatus } from '@studylog/database';
import type { CreateReportRequest, ListReportsQuery, Report, ReportPage, ResolveReportRequest } from '@studylog/schemas';
import { ReportAction } from '@studylog/schemas';
import { DataSource } from 'typeorm';

import { saveUnique } from '../catalog/catalog.helpers.js';
import { CatalogAccessService } from '../catalog/catalog-access.service.js';

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
    async list( { status = ReportStatus.Open, limit = 50, offset = 0 }: ListReportsQuery ): Promise<ReportPage> {
        const [ reports, total ] = await this.dataSource.getRepository( PathReport ).findAndCount( {
            where: { status },
            relations: { learningPath: true, reporter: true },
            order: { createdAt: 'ASC', id: 'ASC' },
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

    private async findView( id: string ): Promise<Report> {
        return toView( await this.dataSource.getRepository( PathReport ).findOneOrFail( {
            where: { id },
            relations: { learningPath: true, reporter: true },
        } ) );
    }
}

function toView( report: PathReport ): Report {
    const { id, reason, details, status, resolutionNote, resolvedAt, createdAt, learningPath, reporter } = report;

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
        },
        reporter: reporter && {
            id: reporter.id,
            email: reporter.email,
            firstName: reporter.firstName,
            lastName: reporter.lastName,
        },
    };
}
