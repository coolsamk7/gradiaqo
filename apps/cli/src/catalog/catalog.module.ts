import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { CatalogImportCommand } from './catalog-import.command.js';

@Module( {
    imports: [ DatabaseModule ],
    providers: [ CatalogImportCommand ],
} )
export class CatalogModule {}
