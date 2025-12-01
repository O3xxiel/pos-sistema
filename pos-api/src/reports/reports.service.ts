import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // ========== REPORTES DE VENTAS ==========

  async getSalesSummary(startDate: string, endDate: string) {
    try {
      // Crear fechas con zona horaria de Guatemala
      const startDateGT = new Date(startDate + 'T00:00:00-06:00');
      const endDateGT = new Date(endDate + 'T23:59:59.999-06:00');

      console.log('📅 Sales Summary - Fechas Guatemala:', {
        startDate,
        endDate,
        startDateGT: startDateGT.toISOString(),
        endDateGT: endDateGT.toISOString(),
      });

      const sales = await this.prisma.sale.findMany({
        where: {
          status: 'CONFIRMED',
          createdAt: {
            gte: startDateGT,
            lte: endDateGT,
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  name: true,
                  sku: true,
                },
              },
            },
          },
          seller: {
            select: {
              fullName: true,
              username: true,
            },
          },
          customer: {
            select: {
              name: true,
            },
          },
        },
      });

      const totalSales = sales.length;
      const totalRevenue = sales.reduce(
        (sum, sale) => sum + Number(sale.grandTotal),
        0,
      );
      const totalItems = sales.reduce(
        (sum, sale) =>
          sum + sale.items.reduce((itemSum, item) => itemSum + item.qty, 0),
        0,
      );

      return {
        period: { startDate, endDate },
        summary: {
          totalSales,
          totalRevenue,
          totalItems,
          averageSaleValue: totalSales > 0 ? totalRevenue / totalSales : 0,
        },
        sales,
      };
    } catch (error) {
      console.error(`❌ [REPORTS] Error getting sales summary:`, error);
      throw error;
    }
  }

  async getTopSellingProducts(
    startDate: string,
    endDate: string,
    limit: number = 10,
  ) {
    try {
      // Crear fechas con zona horaria de Guatemala
      const startDateGT = new Date(startDate + 'T00:00:00-06:00');
      const endDateGT = new Date(endDate + 'T23:59:59.999-06:00');

      console.log('📅 Top Products - Fechas Guatemala:', {
        startDate,
        endDate,
        startDateGT: startDateGT.toISOString(),
        endDateGT: endDateGT.toISOString(),
      });

      // Primero obtener las ventas confirmadas en el rango de fechas
      const confirmedSales = await this.prisma.sale.findMany({
        where: {
          status: 'CONFIRMED',
          createdAt: {
            gte: startDateGT,
            lte: endDateGT,
          },
        },
        select: {
          id: true,
        },
      });

      const saleIds = confirmedSales.map((sale) => sale.id);

      if (saleIds.length === 0) {
        return [];
      }

      // Luego obtener los items de esas ventas
      const productSales = await this.prisma.saleItem.groupBy({
        by: ['productId'],
        where: {
          saleId: {
            in: saleIds,
          },
        },
        _sum: {
          qty: true,
          lineTotal: true,
        },
        _count: {
          id: true,
        },
        orderBy: {
          _sum: {
            qty: 'desc',
          },
        },
        take: limit,
      });

      const productsWithDetails = await Promise.all(
        productSales.map(async (product) => {
          const productDetails = await this.prisma.product.findUnique({
            where: { id: product.productId },
            select: {
              name: true,
              sku: true,
              priceBase: true,
            },
          });

          return {
            productId: product.productId,
            productName: productDetails?.name || 'Producto no encontrado',
            sku: productDetails?.sku || 'N/A',
            price: Number(productDetails?.priceBase || 0),
            totalQuantity: product._sum.qty || 0,
            totalRevenue: product._sum.lineTotal || 0,
            salesCount: product._count.id || 0,
          };
        }),
      );

      return productsWithDetails;
    } catch (error) {
      console.error(`❌ [REPORTS] Error getting top selling products:`, error);
      throw error;
    }
  }

  async getSalesBySeller(startDate: string, endDate: string) {
    try {
      // Crear fechas con zona horaria de Guatemala
      const startDateGT = new Date(startDate + 'T00:00:00-06:00');
      const endDateGT = new Date(endDate + 'T23:59:59.999-06:00');

      console.log('📅 Sales by Seller - Fechas Guatemala:', {
        startDate,
        endDate,
        startDateGT: startDateGT.toISOString(),
        endDateGT: endDateGT.toISOString(),
      });

      const sellerSales = await this.prisma.sale.groupBy({
        by: ['sellerId'],
        where: {
          status: 'CONFIRMED',
          createdAt: {
            gte: startDateGT,
            lte: endDateGT,
          },
        },
        _sum: {
          grandTotal: true,
        },
        _count: {
          id: true,
        },
        orderBy: {
          _sum: {
            grandTotal: 'desc',
          },
        },
      });

      const sellersWithDetails = await Promise.all(
        sellerSales.map(async (seller) => {
          const sellerDetails = await this.prisma.user.findUnique({
            where: { id: seller.sellerId },
            select: {
              fullName: true,
              username: true,
            },
          });

          return {
            sellerId: seller.sellerId,
            sellerName: sellerDetails?.fullName || 'Vendedor no encontrado',
            username: sellerDetails?.username || 'N/A',
            totalSales: seller._count.id || 0,
            totalRevenue: seller._sum.grandTotal || 0,
            averageSaleValue:
              seller._count.id > 0
                ? Number(seller._sum.grandTotal || 0) / seller._count.id
                : 0,
          };
        }),
      );

      return sellersWithDetails;
    } catch (error) {
      console.error(`❌ [REPORTS] Error getting sales by seller:`, error);
      throw error;
    }
  }

  // ========== REPORTES DE INVENTARIO ==========

  async getInventorySummary() {
    const stockItems = await this.prisma.stock.findMany({
      include: {
        product: {
          select: {
            name: true,
            sku: true,
            priceBase: true,
          },
        },
        warehouse: {
          select: {
            name: true,
          },
        },
      },
    });

    const totalProducts = stockItems.length;
    const totalValue = stockItems.reduce(
      (sum, item) => sum + item.qty * Number(item.product?.priceBase || 0),
      0,
    );
    const totalQuantity = stockItems.reduce((sum, item) => sum + item.qty, 0);

    const lowStockItems = stockItems.filter((item) => item.qty <= 10);
    const outOfStockItems = stockItems.filter((item) => item.qty === 0);

    return {
      summary: {
        totalProducts,
        totalValue,
        totalQuantity,
        lowStockCount: lowStockItems.length,
        outOfStockCount: outOfStockItems.length,
      },
      lowStockItems: lowStockItems.map((item) => ({
        productId: item.productId,
        productName: item.product?.name || 'Producto no encontrado',
        sku: item.product?.sku || 'N/A',
        currentStock: item.qty,
        price: Number(item.product?.priceBase || 0),
        warehouseName: item.warehouse?.name || 'N/A',
      })),
      outOfStockItems: outOfStockItems.map((item) => ({
        productId: item.productId,
        productName: item.product?.name || 'Producto no encontrado',
        sku: item.product?.sku || 'N/A',
        price: Number(item.product?.priceBase || 0),
        warehouseName: item.warehouse?.name || 'N/A',
      })),
    };
  }

  // ========== REPORTES DE CLIENTES ==========

  async getCustomerSummary(startDate?: string, endDate?: string) {
    try {
      // Crear fechas con zona horaria de Guatemala si se proporcionan
      let dateFilter = {};
      if (startDate && endDate) {
        const startDateGT = new Date(startDate + 'T00:00:00-06:00');
        const endDateGT = new Date(endDate + 'T23:59:59.999-06:00');

        console.log('📅 Customer Summary - Fechas Guatemala:', {
          startDate,
          endDate,
          startDateGT: startDateGT.toISOString(),
          endDateGT: endDateGT.toISOString(),
        });

        dateFilter = {
          createdAt: {
            gte: startDateGT,
            lte: endDateGT,
          },
        };
      }

      const customers = await this.prisma.customer.findMany({
        include: {
          sales: {
            where: {
              status: 'CONFIRMED',
              ...dateFilter,
            },
            select: {
              grandTotal: true,
              createdAt: true,
            },
          },
        },
      });

      const totalCustomers = customers.length;
      const customersWithSales = customers.filter(
        (customer) => customer.sales.length > 0,
      );
      const totalRevenue = customers.reduce(
        (sum, customer) =>
          sum +
          customer.sales.reduce(
            (saleSum, sale) => saleSum + Number(sale.grandTotal),
            0,
          ),
        0,
      );

      return {
        summary: {
          totalCustomers,
          customersWithSales: customersWithSales.length,
          customersWithoutSales: totalCustomers - customersWithSales.length,
          totalRevenue,
          averageRevenuePerCustomer:
            customersWithSales.length > 0
              ? totalRevenue / customersWithSales.length
              : 0,
        },
      };
    } catch (error) {
      console.error(`❌ [REPORTS] Error getting customer summary:`, error);
      throw error;
    }
  }

  async getTopCustomers(
    startDate: string,
    endDate: string,
    limit: number = 10,
  ) {
    try {
      // Crear fechas con zona horaria de Guatemala
      const startDateGT = new Date(startDate + 'T00:00:00-06:00');
      const endDateGT = new Date(endDate + 'T23:59:59.999-06:00');

      console.log('📅 Top Customers - Fechas Guatemala:', {
        startDate,
        endDate,
        startDateGT: startDateGT.toISOString(),
        endDateGT: endDateGT.toISOString(),
      });

      const customerSales = await this.prisma.sale.groupBy({
        by: ['customerId'],
        where: {
          status: 'CONFIRMED',
          createdAt: {
            gte: startDateGT,
            lte: endDateGT,
          },
        },
        _sum: {
          grandTotal: true,
        },
        _count: {
          id: true,
        },
        orderBy: {
          _sum: {
            grandTotal: 'desc',
          },
        },
        take: limit,
      });

      const customersWithDetails = await Promise.all(
        customerSales.map(async (customer) => {
          const customerDetails = await this.prisma.customer.findUnique({
            where: { id: customer.customerId },
            select: {
              name: true,
              code: true,
              phone: true,
              address: true,
            },
          });

          return {
            customerId: customer.customerId,
            customerName: customerDetails?.name || 'Cliente no encontrado',
            code: customerDetails?.code || 'N/A',
            address: customerDetails?.address || 'N/A',
            phone: customerDetails?.phone || 'N/A',
            totalPurchases: customer._count.id || 0,
            totalSpent: customer._sum.grandTotal || 0,
            averagePurchaseValue:
              customer._count.id > 0
                ? Number(customer._sum.grandTotal || 0) / customer._count.id
                : 0,
          };
        }),
      );

      return customersWithDetails;
    } catch (error) {
      console.error(`❌ [REPORTS] Error getting top customers:`, error);
      throw error;
    }
  }

  async getCustomerActivity(startDate: string, endDate: string) {
    try {
      // Crear fechas con zona horaria de Guatemala
      const startDateGT = new Date(startDate + 'T00:00:00-06:00');
      const endDateGT = new Date(endDate + 'T23:59:59.999-06:00');

      console.log('📅 Customer Activity - Fechas Guatemala:', {
        startDate,
        endDate,
        startDateGT: startDateGT.toISOString(),
        endDateGT: endDateGT.toISOString(),
      });

      const customers = await this.prisma.customer.findMany({
        include: {
          sales: {
            where: {
              status: 'CONFIRMED',
              createdAt: {
                gte: startDateGT,
                lte: endDateGT,
              },
            },
            select: {
              grandTotal: true,
              createdAt: true,
            },
          },
        },
      });

      return customers
        .map((customer) => ({
          customerId: customer.id,
          customerName: customer.name,
          code: customer.code,
          address: customer.address,
          phone: customer.phone,
          totalPurchases: customer.sales.length,
          totalSpent: customer.sales.reduce(
            (sum, sale) => sum + Number(sale.grandTotal),
            0,
          ),
          lastPurchase:
            customer.sales.length > 0
              ? customer.sales.sort(
                  (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
                )[0].createdAt
              : null,
        }))
        .sort((a, b) => b.totalSpent - a.totalSpent);
    } catch (error) {
      console.error(`❌ [REPORTS] Error getting customer activity:`, error);
      throw error;
    }
  }

  // ========== REPORTE DIARIO ==========

  async getDailyReport(date: string, sellerId?: string, user?: { id: number }) {
    try {
      // Crear fechas con zona horaria de Guatemala
      const startDate = new Date(date + 'T00:00:00-06:00');
      const endDate = new Date(date + 'T23:59:59.999-06:00');

      console.log('📅 Daily Report - Fechas Guatemala:', {
        date,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      const whereClause: {
        status: 'CONFIRMED';
        createdAt: { gte: Date; lt: Date };
        sellerId?: number;
      } = {
        status: 'CONFIRMED',
        createdAt: { gte: startDate, lt: endDate },
      };

      if (sellerId) {
        whereClause.sellerId =
          sellerId === 'me' && user?.id ? user.id : parseInt(sellerId);
      }

      const sales = await this.prisma.sale.findMany({
        where: whereClause,
        select: {
          id: true,
          folio: true,
          grandTotal: true,
          createdAt: true,
          sellerId: true,
          seller: { select: { fullName: true, username: true } },
          customer: { select: { name: true, code: true } },
          items: {
            select: {
              productId: true,
              qty: true,
              lineTotal: true,
              priceUnit: true,
              product: { select: { name: true, sku: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const totalSales = sales.length;
      const totalRevenue = sales.reduce(
        (sum, sale) => sum + Number(sale.grandTotal),
        0,
      );
      const totalItems = sales.reduce(
        (sum, sale) =>
          sum + sale.items.reduce((itemSum, item) => itemSum + item.qty, 0),
        0,
      );

      // Agrupar por vendedor de forma más eficiente
      const salesBySeller = new Map<
        number,
        {
          sellerId: number;
          sellerName: string;
          username: string;
          totalRevenue: number;
          totalItems: number;
        }
      >();
      sales.forEach((sale) => {
        const key = sale.sellerId;
        if (!salesBySeller.has(key)) {
          salesBySeller.set(key, {
            sellerId: key,
            sellerName: sale.seller?.fullName || 'Vendedor no encontrado',
            username: sale.seller?.username || 'N/A',
            totalRevenue: 0,
            totalItems: 0,
          });
        }
        const seller = salesBySeller.get(key)!;
        seller.totalRevenue += Number(sale.grandTotal);
        seller.totalItems += sale.items.reduce(
          (sum, item) => sum + item.qty,
          0,
        );
      });

      // Obtener información del vendedor si se especifica
      let sellerInfo: {
        id: number;
        fullName: string;
        username: string;
      } | null = null;
      if (sellerId === 'me' && user?.id) {
        // Si es 'me', obtener la información del usuario autenticado
        sellerInfo = await this.prisma.user.findUnique({
          where: { id: user.id },
          select: { id: true, fullName: true, username: true },
        });
      } else if (sellerId && sellerId !== 'me') {
        // Si es un ID específico, obtener ese vendedor
        sellerInfo = await this.prisma.user.findUnique({
          where: { id: parseInt(sellerId) },
          select: { id: true, fullName: true, username: true },
        });
      }

      // Calcular productos más vendidos de forma más eficiente
      const productSales = new Map<
        number,
        {
          productId: number;
          productName: string;
          productSku: string;
          quantity: number;
          amount: number;
        }
      >();
      sales.forEach((sale) => {
        sale.items.forEach((item) => {
          const key = item.productId;
          if (!productSales.has(key)) {
            productSales.set(key, {
              productId: key,
              productName: item.product?.name || 'Producto no encontrado',
              productSku: item.product?.sku || 'N/A',
              quantity: 0,
              amount: 0,
            });
          }
          const product = productSales.get(key)!;
          product.quantity += item.qty;
          product.amount += Number(item.lineTotal);
        });
      });

      const topProducts = Array.from(productSales.values())
        .sort((a, b) => b.quantity - a.quantity); // Ordenar por cantidad y retornar todos

      // Calcular horas pico de forma más eficiente
      const hourlyData = new Map<
        number,
        { hour: number; amount: number; sales: number }
      >();
      sales.forEach((sale) => {
        const hour = new Date(sale.createdAt).getHours();
        if (!hourlyData.has(hour)) {
          hourlyData.set(hour, { hour, amount: 0, sales: 0 });
        }
        const hourData = hourlyData.get(hour)!;
        hourData.amount += Number(sale.grandTotal);
        hourData.sales += 1;
      });

      const peakHours = Array.from(hourlyData.values())
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8);

      const hourlySummary = Array.from(hourlyData.values()).sort(
        (a, b) => a.hour - b.hour,
      );

      // Si no se encontró sellerInfo pero tenemos el usuario autenticado, usarlo
      if (!sellerInfo && user?.id) {
        sellerInfo = await this.prisma.user.findUnique({
          where: { id: user.id },
          select: { id: true, fullName: true, username: true },
        });
      }

      return {
        date,
        seller: sellerInfo || {
          id: user?.id || 0,
          username: user?.username || 'me',
          fullName: user?.fullName || 'Vendedor',
        },
        summary: {
          totalSales,
          totalAmount: totalRevenue,
          totalQuantity: totalItems,
          averageTicket: totalSales > 0 ? totalRevenue / totalSales : 0,
          pendingSync: 0,
        },
        topProducts,
        peakHours,
        hourlySummary,
        pendingSales: { count: 0, totalAmount: 0, sales: [] },
        dailySales: sales.map((sale) => ({
          id: sale.id,
          folio: sale.folio || `V-${sale.id}`,
          customerName: sale.customer?.name || 'Cliente no encontrado',
          customerCode: sale.customer?.code || 'N/A',
          total: Number(sale.grandTotal),
          confirmedAt: sale.createdAt.toISOString(),
          items: sale.items.map((item) => ({
            productName: item.product?.name || 'Producto no encontrado',
            productSku: item.product?.sku || 'N/A',
            quantity: item.qty,
            unitPrice: Number(item.priceUnit),
            total: Number(item.lineTotal),
          })),
        })),
        sellersSummary: Array.from(salesBySeller.values()),
      };
    } catch (error) {
      console.error(`❌ [REPORTS] Error getting daily report:`, error);
      throw error;
    }
  }

  async getReportSellers() {
    try {
      const sellers = await this.prisma.user.findMany({
        where: {
          roles: {
            some: {
              role: {
                code: 'SELLER',
              },
            },
          },
          isActive: true,
        },
        select: {
          id: true,
          fullName: true,
          username: true,
          email: true,
        },
        orderBy: {
          fullName: 'asc',
        },
      });

      return {
        sellers: sellers.map((seller) => ({
          id: seller.id,
          fullName: seller.fullName,
          username: seller.username,
          role: 'Vendedor',
          roleCode: 'SELLER',
          email: seller.email,
        })),
      };
    } catch (error) {
      console.error(`❌ [REPORTS] Error getting sellers:`, error);
      throw error;
    }
  }

  async getDailySummary(
    date: string,
    sellerId?: string,
    user?: { id: number },
  ) {
    try {
      // Crear fechas con zona horaria de Guatemala
      const startDate = new Date(date + 'T00:00:00-06:00');
      const endDate = new Date(date + 'T23:59:59.999-06:00');

      console.log('📅 Daily Summary - Fechas Guatemala:', {
        date,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      const whereClause: {
        status: 'CONFIRMED';
        createdAt: { gte: Date; lt: Date };
        sellerId?: number;
      } = {
        status: 'CONFIRMED',
        createdAt: { gte: startDate, lt: endDate },
      };

      if (sellerId) {
        whereClause.sellerId =
          sellerId === 'me' && user?.id ? user.id : parseInt(sellerId);
      }

      const sales = await this.prisma.sale.findMany({
        where: whereClause,
        select: {
          id: true,
          grandTotal: true,
          sellerId: true,
          seller: { select: { id: true, fullName: true, username: true } },
          items: {
            select: {
              productId: true,
              qty: true,
              lineTotal: true,
              product: { select: { name: true, sku: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const totalSales = sales.length;
      const totalAmount = sales.reduce(
        (sum, sale) => sum + Number(sale.grandTotal),
        0,
      );
      const totalQuantity = sales.reduce(
        (sum, sale) =>
          sum + sale.items.reduce((itemSum, item) => itemSum + item.qty, 0),
        0,
      );

      // Obtener vendedores únicos de forma más eficiente
      const uniqueSellers = new Map<
        number,
        { id: number; fullName: string; username: string }
      >();
      sales.forEach((sale) => {
        if (!uniqueSellers.has(sale.sellerId)) {
          uniqueSellers.set(sale.sellerId, sale.seller);
        }
      });

      const activeSellers = uniqueSellers.size;
      const totalSellers = await this.prisma.user.count({
        where: {
          roles: { some: { role: { code: 'SELLER' } } },
          isActive: true,
        },
      });

      // Calcular TODOS los productos vendidos de forma más eficiente
      const productSales = new Map<
        number,
        { name: string; sku: string; quantity: number; amount: number }
      >();
      sales.forEach((sale) => {
        sale.items.forEach((item) => {
          const key = item.productId;
          if (!productSales.has(key)) {
            productSales.set(key, {
              name: item.product?.name || 'Producto no encontrado',
              sku: item.product?.sku || 'N/A',
              quantity: 0,
              amount: 0,
            });
          }
          const product = productSales.get(key)!;
          product.quantity += item.qty;
          product.amount += Number(item.lineTotal);
        });
      });

      // Devolver TODOS los productos ordenados por cantidad (descendente)
      const allProducts = Array.from(productSales.values())
        .sort((a, b) => b.quantity - a.quantity);

      // Calcular métricas por vendedor de forma más eficiente
      const sellersData = Array.from(uniqueSellers.values()).map((seller) => {
        const sellerSales = sales.filter((sale) => sale.sellerId === seller.id);
        const sellerAmount = sellerSales.reduce(
          (sum, sale) => sum + Number(sale.grandTotal),
          0,
        );
        const sellerQuantity = sellerSales.reduce(
          (sum, sale) =>
            sum + sale.items.reduce((itemSum, item) => itemSum + item.qty, 0),
          0,
        );

        // Productos más vendidos por vendedor
        const sellerProductSales = new Map<
          number,
          { name: string; quantity: number; amount: number }
        >();
        sellerSales.forEach((sale) => {
          sale.items.forEach((item) => {
            const key = item.productId;
            if (!sellerProductSales.has(key)) {
              sellerProductSales.set(key, {
                name: item.product?.name || 'Producto no encontrado',
                quantity: 0,
                amount: 0,
              });
            }
            const product = sellerProductSales.get(key)!;
            product.quantity += item.qty;
            product.amount += Number(item.lineTotal);
          });
        });

        const sellerTopProducts = Array.from(sellerProductSales.values())
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5);

        return {
          seller: {
            id: seller.id,
            username: seller.username,
            fullName: seller.fullName,
          },
          metrics: {
            totalSales: sellerSales.length,
            totalAmount: sellerAmount,
            totalQuantity: sellerQuantity,
            averageTicket:
              sellerSales.length > 0 ? sellerAmount / sellerSales.length : 0,
          },
          topProducts: sellerTopProducts,
        };
      });

      // Obtener ventas pendientes de sincronización
      const pendingSales = await this.prisma.sale.findMany({
        where: {
          status: { in: ['PENDING_SYNC', 'REVIEW_REQUIRED'] },
          createdAt: { gte: startDate, lt: endDate },
        },
        select: {
          id: true,
          uuid: true,
          grandTotal: true,
          createdAt: true,
          seller: { select: { fullName: true } },
          customer: { select: { name: true } },
          items: {
            select: {
              qty: true,
              priceUnit: true,
              lineTotal: true,
              product: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const pendingAmount = pendingSales.reduce(
        (sum, sale) => sum + Number(sale.grandTotal),
        0,
      );

      return {
        date,
        summary: {
          totalSales,
          totalAmount,
          totalQuantity,
          averageTicket: totalSales > 0 ? totalAmount / totalSales : 0,
          activeSellers,
          totalSellers,
          pendingSync: pendingSales.length,
        },
        topProducts: allProducts,
        sellers: sellersData,
        pendingSales: {
          count: pendingSales.length,
          totalAmount: pendingAmount,
          sales: pendingSales.map((sale) => ({
            id: sale.id,
            uuid: sale.uuid || '',
            customerName: sale.customer?.name || 'Cliente no encontrado',
            sellerName: sale.seller?.fullName || 'Vendedor no encontrado',
            total: Number(sale.grandTotal),
            createdAt: sale.createdAt.toISOString(),
            items: sale.items.map((item) => ({
              productName: item.product?.name || 'Producto no encontrado',
              quantity: item.qty,
              unitPrice: Number(item.priceUnit),
              total: Number(item.lineTotal),
            })),
          })),
        },
      };
    } catch (error) {
      console.error(`❌ [REPORTS] Error getting daily summary:`, error);
      throw error;
    }
  }
}
