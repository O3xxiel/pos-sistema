import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('debug')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class DebugController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('products')
  @Roles('ADMIN')
  async getProducts() {
    return await this.prisma.product.findMany({
      take: 5,
      include: {
        stock: {
          include: {
            warehouse: true,
          },
        },
      },
    });
  }

  @Get('stock')
  @Roles('ADMIN')
  async getStock() {
    return await this.prisma.stock.findMany({
      take: 10,
      include: {
        product: true,
        warehouse: true,
      },
    });
  }

  @Get('sales')
  @Roles('ADMIN')
  async getSales() {
    return await this.prisma.sale.findMany({
      take: 5,
      include: {
        customer: true,
        items: true,
      },
    });
  }

  @Get('offline-sales')
  @Roles('ADMIN')
  async getOfflineSales() {
    // Simular la consulta que hace el frontend
    const offlineSales = await this.prisma.sale.findMany({
      where: {
        status: {
          in: ['PENDING_SYNC', 'REVIEW_REQUIRED'],
        },
      },
      take: 10,
      include: {
        customer: true,
        items: true,
      },
    });

    return {
      count: offlineSales.length,
      sales: offlineSales.map((sale) => ({
        id: sale.uuid || 'no-uuid',
        status: sale.status,
        customerName: sale.customer?.name || 'Cliente no encontrado',
        grandTotal: sale.grandTotal,
        createdAt: sale.createdAt,
        lastError: sale.lastError || null,
      })),
    };
  }
}
