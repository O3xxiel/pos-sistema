import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SELLER')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ========== REPORTES DE VENTAS ==========

  @Get('sales/summary')
  async getSalesSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getSalesSummary(startDate, endDate);
  }

  @Get('sales/top-products')
  async getTopSellingProducts(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit) : 10;
    return this.reportsService.getTopSellingProducts(
      startDate,
      endDate,
      limitNum,
    );
  }

  @Get('sales/by-seller')
  async getSalesBySeller(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getSalesBySeller(startDate, endDate);
  }

  // ========== REPORTES DE INVENTARIO ==========

  @Get('inventory/summary')
  async getInventorySummary() {
    return this.reportsService.getInventorySummary();
  }

  // ========== REPORTES DE CLIENTES ==========

  @Get('customers/summary')
  async getCustomerSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getCustomerSummary(startDate, endDate);
  }

  @Get('customers/top')
  async getTopCustomers(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit) : 10;
    return this.reportsService.getTopCustomers(startDate, endDate, limitNum);
  }

  @Get('customers/activity')
  async getCustomerActivity(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getCustomerActivity(startDate, endDate);
  }

  // ========== REPORTE DIARIO ==========

  @Get('daily')
  async getDailyReport(
    @Request() req: any,
    @Query('date') date: string,
    @Query('seller_id') sellerId?: string,
  ) {
    return this.reportsService.getDailyReport(date, sellerId, req.user);
  }

  @Get('sellers')
  async getReportSellers() {
    return this.reportsService.getReportSellers();
  }

  @Get('summary')
  async getDailySummary(
    @Request() req: any,
    @Query('date') date: string,
    @Query('sellerId') sellerId?: string,
  ) {
    return this.reportsService.getDailySummary(date, sellerId, req.user);
  }
}
