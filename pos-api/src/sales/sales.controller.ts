import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
  UseInterceptors,
  Req,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SellerFilterInterceptor } from '../auth/seller-filter.interceptor';
import { SalesService } from './sales.service';
import { ConfirmSaleDto } from './dto/confirm-sale.dto';
import { SyncSalesDto } from './dto/sync-sales.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post('confirm')
  @Roles('SELLER')
  async confirmSale(@Body() confirmSaleDto: ConfirmSaleDto, @Req() req: any) {
    // Si es vendedor, asignar su ID automáticamente
    if (req.user.roles.includes('SELLER')) {
      confirmSaleDto.sellerId = req.user.id;
    }
    return this.salesService.createAndConfirmSale(confirmSaleDto);
  }

  @Post(':id/confirm')
  @Roles('SELLER')
  async confirmExistingSale(
    @Param('id', ParseIntPipe) saleId: number,
    @Body() confirmSaleDto: ConfirmSaleDto,
    @Req() req: any,
  ) {
    console.log(
      `🔍 Controller: confirmExistingSale - Received saleId from URL: ${saleId}`,
    );
    console.log(
      '🔍 Controller: confirmExistingSale - Datos recibidos:',
      confirmSaleDto,
    );
    console.log('🔍 Controller: confirmExistingSale - Usuario:', req.user);

    // Si es vendedor, asignar su ID automáticamente
    if (req.user.roles.includes('SELLER')) {
      confirmSaleDto.sellerId = req.user.id;
    }

    try {
      const result = await this.salesService.confirmSale(
        saleId,
        confirmSaleDto,
      );
      console.log(
        `🔍 Controller: confirmExistingSale - Returning confirmed sale ID: ${result.id}`,
      );
      return result;
    } catch (error) {
      console.error('❌ Controller: Error confirmando venta:', error);
      throw error;
    }
  }

  @Post('sync')
  @Roles('SELLER')
  async syncOfflineSales(@Body() syncSalesDto: SyncSalesDto, @Req() req: any) {
    console.log('🎯 [CONTROLLER] Received sync request:', {
      salesCount: syncSalesDto.sales?.length || 0,
      userRoles: req.user.roles,
      userId: req.user.id,
    });
    console.log('📦 [CONTROLLER] Raw sales data:', syncSalesDto.sales);

    // Filtrar solo las ventas del vendedor actual para evitar mezcla de ventas
    const currentSellerId = req.user.id;
    const filteredSales = syncSalesDto.sales.filter(
      (sale) => sale.sellerId === currentSellerId,
    );

    if (filteredSales.length !== syncSalesDto.sales.length) {
      console.log(
        `⚠️ [CONTROLLER] Filtradas ${syncSalesDto.sales.length - filteredSales.length} ventas que no pertenecen al vendedor ${currentSellerId}`,
      );
    }

    console.log(
      `✅ [CONTROLLER] Processing ${filteredSales.length} offline sales for seller ${currentSellerId}`,
    );

    return this.salesService.syncOfflineSales({
      ...syncSalesDto,
      sales: filteredSales,
    });
  }

  @Get('offline/all')
  @Roles('ADMIN')
  async getAllOfflineSales(@Query('status') status?: string) {
    return this.salesService.getAllOfflineSales(status);
  }

  @Get('offline/status')
  @Roles('SELLER', 'ADMIN')
  async getOfflineSalesStatus(@Req() req: any) {
    // Si es admin, obtener el sellerId del query parameter, sino usar el ID del usuario
    const sellerId = req.query.sellerId
      ? parseInt(req.query.sellerId)
      : req.user.id;
    return this.salesService.getOfflineSalesStatus(sellerId);
  }

  @Get('by-uuid/:uuid')
  @Roles('SELLER', 'ADMIN')
  async getSaleByUuid(@Param('uuid') uuid: string, @Req() req: any) {
    return this.salesService.getSaleByUuid(uuid, req.user.id);
  }

  @Get()
  @Roles('ADMIN', 'SELLER')
  @UseInterceptors(SellerFilterInterceptor)
  async getSales(
    @Req() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('sellerId') sellerId?: number,
    @Query('folio') folio?: string,
    @Query('uuid') uuid?: string,
  ) {
    // Si es vendedor, solo puede ver sus propias ventas
    // Si es admin, puede ver todas las ventas
    if (
      req.user.roles.includes('SELLER') &&
      !req.user.roles.includes('ADMIN')
    ) {
      sellerId = req.user.id;
    }

    return this.salesService.getSales({
      page: page || 1,
      limit: limit || 10,
      status,
      sellerId,
      folio,
      uuid,
    });
  }

  @Get(':id')
  @Roles('ADMIN', 'SELLER')
  @UseInterceptors(SellerFilterInterceptor)
  async getSale(@Param('id', ParseIntPipe) id: number) {
    return this.salesService.getSaleById(id);
  }

  @Post('draft')
  @Roles('SELLER')
  async createDraft(@Body() draftData: any, @Req() req: any) {
    // Si es vendedor, asignar su ID automáticamente
    if (req.user.roles.includes('SELLER')) {
      draftData.sellerId = req.user.id;
    }

    return this.salesService.createDraft(draftData);
  }

  @Delete(':id')
  @Roles('SELLER')
  @UseInterceptors(SellerFilterInterceptor)
  async deleteSale(@Param('id', ParseIntPipe) id: number) {
    return this.salesService.deleteSale(id);
  }
}
