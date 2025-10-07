import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { DebugController } from './debug.controller';
import { ConflictsController } from './conflicts.controller';
import { ConflictsService } from './conflicts.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ConflictsController, SalesController, DebugController],
  providers: [SalesService, ConflictsService, PrismaService],
  exports: [SalesService, ConflictsService],
})
export class SalesModule {}
