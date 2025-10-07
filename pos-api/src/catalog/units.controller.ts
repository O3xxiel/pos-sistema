import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UnitsService } from './units.service';

@Controller('catalog/units')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Get('product/:productId')
  async getProductUnits(@Param('productId') productId: string) {
    return this.unitsService.getProductUnits(parseInt(productId));
  }

  @Post('product/:productId')
  async createProductUnit(
    @Param('productId') productId: string,
    @Body()
    unitData: {
      unitId: number;
      factor: number;
    },
  ) {
    return this.unitsService.createProductUnit(parseInt(productId), unitData);
  }

  @Put(':unitId')
  async updateProductUnit(
    @Param('unitId') unitId: string,
    @Body()
    unitData: {
      factor?: number;
      isActive?: boolean;
    },
  ) {
    return this.unitsService.updateProductUnit(parseInt(unitId), unitData);
  }

  @Delete(':unitId')
  async deleteProductUnit(@Param('unitId') unitId: string) {
    return this.unitsService.deleteProductUnit(parseInt(unitId));
  }

  @Get('standard')
  async getStandardUnits() {
    return this.unitsService.getStandardUnits();
  }

  @Post('product/:productId/initialize')
  async initializeStandardUnits(@Param('productId') productId: string) {
    return this.unitsService.initializeStandardUnits(parseInt(productId));
  }
}
