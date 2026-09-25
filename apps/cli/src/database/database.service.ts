import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDataSourceOptions } from '@studylog/database';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseService {
    constructor( private readonly config: ConfigService ) {}

    /** Opens a connection for the duration of `action`, then closes it so the process can exit. */
    async withDataSource<T>( action: ( dataSource: DataSource ) => Promise<T> ): Promise<T> {
        const dataSource = new DataSource( createDataSourceOptions( { url: this.config.getOrThrow<string>( 'DATABASE_URL' ) } ) );

        await dataSource.initialize();

        try {
            return await action( dataSource );
        } finally {
            await dataSource.destroy();
        }
    }
}
