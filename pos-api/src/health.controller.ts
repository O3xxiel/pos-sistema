import { Controller, Get, Post } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  getHealth() {
    const now = new Date();
    return {
      status: 'ok',
      timestamp: now.toISOString(),
      localTime: now.toString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      utcOffset: now.getTimezoneOffset(),
      serverDate: {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        hours: now.getHours(),
        minutes: now.getMinutes(),
        seconds: now.getSeconds()
      }
    };
  }

  @Post('fix-future-dates')
  async fixFutureDates() {
    try {
      console.log('🔍 Buscando ventas con fechas futuras...');
      
      const today = new Date();
      today.setHours(23, 59, 59, 999); // Fin del día actual
      
      console.log('📅 Fecha actual del servidor:', today.toISOString());
      
      // Buscar ventas con fechas futuras
      const futureSales = await this.prisma.sale.findMany({
        where: {
          createdAt: {
            gt: today
          }
        },
        select: {
          id: true,
          folio: true,
          createdAt: true,
          confirmedAt: true,
          seller: {
            select: {
              fullName: true
            }
          }
        }
      });
      
      console.log(`📊 Encontradas ${futureSales.length} ventas con fechas futuras`);
      
      if (futureSales.length > 0) {
        console.log('🔧 Corrigiendo fechas...');
        
        // Corregir las fechas a la fecha actual
        const result = await this.prisma.sale.updateMany({
          where: {
            createdAt: {
              gt: today
            }
          },
          data: {
            createdAt: new Date(),
            confirmedAt: new Date()
          }
        });
        
        console.log(`✅ Se corrigieron ${result.count} ventas`);
        
        return {
          success: true,
          message: `Se corrigieron ${result.count} ventas con fechas futuras`,
          correctedCount: result.count,
          futureSales: futureSales.map(sale => ({
            id: sale.id,
            folio: sale.folio,
            oldDate: sale.createdAt.toISOString(),
            seller: sale.seller.fullName
          }))
        };
      } else {
        return {
          success: true,
          message: 'No se encontraron ventas con fechas futuras',
          correctedCount: 0,
          futureSales: []
        };
      }
      
    } catch (error) {
      console.error('❌ Error:', error);
      return {
        success: false,
        message: 'Error al corregir fechas futuras',
        error: error.message
      };
    }
  }
}