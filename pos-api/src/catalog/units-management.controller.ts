import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UnitsManagementService } from './units-management.service';
import {
  CreateUnitDto,
  UpdateUnitDto,
  AssignUnitToProductDto,
  UpdateProductUnitFactorDto,
} from './dto/unit.dto';

@Controller('catalog/units-management')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class UnitsManagementController {
  constructor(private readonly unitsService: UnitsManagementService) {}

  @Get()
  async getAllUnits() {
    return this.unitsService.getAllUnits();
  }

  @Get(':id')
  async getUnitById(@Param('id') id: string) {
    return this.unitsService.getUnitById(parseInt(id));
  }

  @Get('code/:code')
  async getUnitByCode(@Param('code') code: string) {
    return this.unitsService.getUnitByCode(code);
  }

  @Post()
  async createUnit(@Body() unitData: CreateUnitDto) {
    return this.unitsService.createUnit(unitData);
  }

  @Put(':id')
  async updateUnit(@Param('id') id: string, @Body() unitData: UpdateUnitDto) {
    return this.unitsService.updateUnit(parseInt(id), unitData);
  }

  @Delete(':id')
  async deleteUnit(@Param('id') id: string) {
    return this.unitsService.deleteUnit(parseInt(id));
  }

  @Get('product/:productId/available')
  async getAvailableUnitsForProduct(@Param('productId') productId: string) {
    return this.unitsService.getAvailableUnitsForProduct(parseInt(productId));
  }

  @Post('product/:productId/assign')
  async assignUnitToProduct(
    @Param('productId') productId: string,
    @Body() data: AssignUnitToProductDto,
  ) {
    return this.unitsService.assignUnitToProduct(
      parseInt(productId),
      data.unitId,
      data.factor,
    );
  }

  @Delete('product/:productId/unit/:unitId')
  async removeUnitFromProduct(
    @Param('productId') productId: string,
    @Param('unitId') unitId: string,
  ) {
    return this.unitsService.removeUnitFromProduct(
      parseInt(productId),
      parseInt(unitId),
    );
  }

  @Put('product/:productId/unit/:unitId/factor')
  async updateProductUnitFactor(
    @Param('productId') productId: string,
    @Param('unitId') unitId: string,
    @Body() data: UpdateProductUnitFactorDto,
  ) {
    return this.unitsService.updateProductUnitFactor(
      parseInt(productId),
      parseInt(unitId),
      data.factor,
    );
  }
}
