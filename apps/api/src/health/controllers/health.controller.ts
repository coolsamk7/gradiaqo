import { TypeboxResponse } from '@gradiaqo/nestjs-typebox';
import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectDataSource } from '@nestjs/typeorm';
import { Responses } from '@studylog/nestjs';
import type { HealthResponse } from '@studylog/schemas';
import type { Response } from 'express';
import { DataSource } from 'typeorm';

/** For load balancers and uptime checks. Not logged and not rate limited. */
@ApiTags( 'health' )
@Controller( 'health' )
@SkipThrottle()
export class HealthController {
    constructor( @InjectDataSource() private readonly dataSource: DataSource ) {}

    @Get()
    @ApiOperation( { summary: 'Is the API up and can it reach the database?' } )
    @TypeboxResponse( Responses.HealthResponse, { description: 'Healthy' } )
    @ApiServiceUnavailableResponse( { description: 'The database is unreachable' } )
    async check( @Res( { passthrough: true } ) res: Response ): Promise<HealthResponse> {
        try {
            await this.dataSource.query( 'SELECT 1' );

            return { status: 'ok', database: 'up' };
        } catch {
            res.status( HttpStatus.SERVICE_UNAVAILABLE );

            return { status: 'error', database: 'down' };
        }
    }
}
