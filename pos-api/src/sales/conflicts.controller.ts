// pos-api/src/sales/conflicts.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ConflictsService } from './conflicts.service';
import { ResolveConflictDto } from './dto/resolve-conflict.dto';
import { PrismaService } from '../prisma.service';

@Controller('sales/conflicts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConflictsController {
  constructor(
    private readonly conflictsService: ConflictsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Roles('ADMIN')
  async getConflicts(@Request() req) {
    console.log(`🔍 [CONFLICTS] Admin ${req.user.id} requesting conflicts`);
    console.log(`🔍 [CONFLICTS] Request headers:`, req.headers);
    console.log(`🔍 [CONFLICTS] Request query:`, req.query);
    console.log(`🔍 [CONFLICTS] Request params:`, req.params);

    try {
      // Usar el servicio completo para obtener conflictos con todas las relaciones
      const conflicts = await this.conflictsService.getConflicts();
      console.log(
        `📊 [CONFLICTS] Found ${conflicts.length} conflicts with full data`,
      );
      return conflicts;
    } catch (error) {
      console.error('❌ [CONFLICTS] Error fetching conflicts:', error);
      throw error;
    }
  }

  @Get('test')
  @Roles('ADMIN')
  async testConflicts(@Request() req) {
    console.log(`🧪 [CONFLICTS] Test endpoint called by admin ${req.user.id}`);
    return {
      message: 'Test endpoint working',
      adminId: req.user.id,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('simple')
  @Roles('ADMIN')
  async getSimpleConflicts(@Request() req) {
    console.log(
      `🔍 [CONFLICTS] Simple endpoint called by admin ${req.user.id}`,
    );
    return {
      message: 'Simple conflicts endpoint working',
      adminId: req.user.id,
      conflicts: [],
      timestamp: new Date().toISOString(),
    };
  }

  @Post('resolve')
  @Roles('ADMIN')
  async resolveConflict(
    @Request() req,
    @Body() resolveConflictDto: ResolveConflictDto,
  ) {
    console.log(
      `🔧 [CONFLICTS] Admin ${req.user.id} resolving conflict:`,
      resolveConflictDto,
    );
    try {
      const result = await this.conflictsService.resolveConflict(
        req.user.id,
        resolveConflictDto,
      );
      console.log(`✅ [CONFLICTS] Conflict resolved successfully`);
      return result;
    } catch (error) {
      console.error('❌ [CONFLICTS] Error resolving conflict:', error);
      throw error;
    }
  }
}
