import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';
import { UnitsManagementController } from './units-management.controller';
import { UnitsManagementService } from './units-management.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [CatalogController, UnitsController, UnitsManagementController],
  providers: [
    CatalogService,
    UnitsService,
    UnitsManagementService,
    PrismaService,
  ],
})
export class CatalogModule {}
