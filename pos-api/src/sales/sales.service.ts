import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ConfirmSaleDto, SaleItemDto } from './dto/confirm-sale.dto';
import { SyncSalesDto, SyncSaleDto } from './dto/sync-sales.dto';

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  async createAndConfirmSale(dto: ConfirmSaleDto) {
    try {
      console.log('🔍 Service: createAndConfirmSale - Iniciando transacción');
      console.log('🔍 Service: createAndConfirmSale - DTO recibido:', dto);
      
      // Usar transacción para mantener integridad
      return await this.prisma.$transaction(async (tx) => {
        console.log('🔍 Service: createAndConfirmSale - Transacción iniciada');
        
        // 1. Validar stock disponible para cada ítem
        console.log('🔍 Service: createAndConfirmSale - Validando stock...');
        await this.validateStockAvailability(tx, dto.items, dto.warehouseId || 1);
        console.log('✅ Service: createAndConfirmSale - Stock validado exitosamente');

      // 2. Generar folio único
      const folio = await this.generateFolio(tx);

      // 3. Crear la venta directamente como CONFIRMED
      const sale = await tx.sale.create({
        data: {
          folio,
          status: 'CONFIRMED',
          customerId: dto.customerId,
          warehouseId: dto.warehouseId || 1,
          sellerId: dto.sellerId,
          subtotal: dto.subtotal,
          taxTotal: dto.taxTotal || 0,
          grandTotal: dto.grandTotal,
          confirmedAt: new Date(),
          uuid: dto.uuid,
        },
        include: {
          customer: true,
          warehouse: true,
          seller: true,
        },
      });

      // 4. Crear los ítems de la venta
      const saleItems = await Promise.all(
        dto.items.map((item) =>
          tx.saleItem.create({
            data: {
              saleId: sale.id,
              productId: item.productId,
              unitCode: item.unitCode as any,
              qty: item.qty,
              qtyBase: item.qtyBase,
              priceUnit: item.priceUnit,
              discount: item.discount || 0,
              lineTotal: item.lineTotal,
            },
            include: {
              product: true,
            },
          }),
        ),
      );

      // 5. Descontar stock y crear movimientos
      await this.processStockDeductions(
        tx,
        sale.id,
        dto.items,
        dto.warehouseId || 1,
        dto.sellerId,
      );

      console.log(
        `Sale created and confirmed successfully with folio ${folio}`,
      );

      return {
        ...sale,
        items: saleItems,
      };
    });
    } catch (error) {
      console.error('❌ Service: createAndConfirmSale - Error:', error);
      throw error;
    }
  }

  async confirmSale(saleId: number, dto: ConfirmSaleDto) {
    console.log(`[SalesService] confirmSale: Received saleId: ${saleId}`);
    console.log(`[SalesService] confirmSale: Confirmation data:`, dto);

    // Usar transacción para mantener integridad
    return await this.prisma.$transaction(async (tx) => {
      // 1. Verificar que la venta existe y está en DRAFT
      console.log(
        `[SalesService] confirmSale: Looking for sale with ID: ${saleId}`,
      );
      const existingSale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { items: true },
      });

      if (!existingSale) {
        console.log(
          `[SalesService] confirmSale: Sale with ID ${saleId} not found`,
        );
        throw new NotFoundException(`Sale with id ${saleId} not found`);
      }

      console.log(
        `[SalesService] confirmSale: Found sale with ID: ${existingSale.id}, status: ${existingSale.status}`,
      );
      if (existingSale.status !== 'DRAFT') {
        console.log(
          `[SalesService] confirmSale: Sale ${saleId} is not in DRAFT status. Current status: ${existingSale.status}`,
        );
        throw new BadRequestException(
          `Sale ${saleId} is not in DRAFT status. Current status: ${existingSale.status}`,
        );
      }

      // 2. Validar stock disponible para cada ítem
      console.log('Validating stock for items...');
      await this.validateStockAvailability(tx, dto.items, dto.warehouseId || 1);

      // 3. Generar folio único
      const folio = await this.generateFolio(tx);
      console.log(`Generated folio: ${folio}`);

      // 4. Actualizar la venta principal
      const updatedSale = await tx.sale.update({
        where: { id: saleId },
        data: {
          folio,
          status: 'CONFIRMED',
          customerId: dto.customerId,
          warehouseId: dto.warehouseId || 1,
          sellerId: dto.sellerId,
          subtotal: dto.subtotal,
          taxTotal: dto.taxTotal || 0,
          grandTotal: dto.grandTotal,
          confirmedAt: new Date(),
          uuid: dto.uuid,
        },
        include: {
          customer: true,
          warehouse: true,
          seller: true,
        },
      });

      // 5. Limpiar ítems existentes y crear nuevos
      await tx.saleItem.deleteMany({
        where: { saleId },
      });

      const saleItems = await Promise.all(
        dto.items.map((item) =>
          tx.saleItem.create({
            data: {
              saleId,
              productId: item.productId,
              unitCode: item.unitCode as any,
              qty: item.qty,
              qtyBase: item.qtyBase,
              priceUnit: item.priceUnit,
              discount: item.discount || 0,
              lineTotal: item.lineTotal,
            },
            include: {
              product: true,
            },
          }),
        ),
      );

      // 6. Descontar stock y crear movimientos
      console.log('Processing stock deductions and movements...');
      await this.processStockDeductions(
        tx,
        saleId,
        dto.items,
        dto.warehouseId || 1,
        dto.sellerId,
      );

      console.log(
        `[SalesService] confirmSale: Sale ${saleId} confirmed successfully with folio ${folio}`,
      );
      console.log(
        `[SalesService] confirmSale: Updated sale ID: ${updatedSale.id}, status: ${updatedSale.status}`,
      );

      const result = {
        ...updatedSale,
        items: saleItems,
      };

      console.log(
        `[SalesService] confirmSale: Returning sale with ID: ${result.id}`,
      );
      return result;
    });
  }

  private async validateStockAvailability(
    tx: any,
    items: SaleItemDto[],
    warehouseId: number,
  ) {
    const stockValidations: Array<{
      productId: number;
      available: number;
      required: number;
      remaining: number;
    }> = [];
    
    // Procesar items secuencialmente para evitar problemas de transacción
    for (const item of items) {
        try {
          const stock = await tx.stock.findUnique({
            where: {
              warehouseId_productId: {
                warehouseId,
                productId: item.productId,
              },
            },
            include: {
              product: {
                select: { name: true, sku: true },
              },
            },
          });

          const availableStock = stock?.qty || 0;
          const requiredStock = item.qtyBase;

          console.log(
            `Product ${item.productId}: Available=${availableStock}, Required=${requiredStock}`,
          );

          // Si no hay stock configurado, crear un registro de stock con cantidad 0
          if (!stock) {
            console.log(
              `No stock record found for product ${item.productId}, creating one...`,
            );
            await tx.stock.create({
              data: {
                warehouseId,
                productId: item.productId,
                qty: 0,
              },
            });
          }

          // Validar stock disponible
          if (availableStock < requiredStock) {
            const productName =
              stock?.product?.name || `Producto ID ${item.productId}`;
            const productSku = stock?.product?.sku || 'N/A';

            throw new BadRequestException(
              `Stock insuficiente para "${productName}" (SKU: ${productSku}). ` +
                `Disponible: ${availableStock} unidades, Requerido: ${requiredStock} unidades`,
            );
          }

          stockValidations.push({
            productId: item.productId,
            available: availableStock,
            required: requiredStock,
            remaining: availableStock - requiredStock,
          });
        } catch (error) {
          console.error(
            `Error validating stock for product ${item.productId}:`,
            error,
          );
          // Re-lanzar el error para que sea manejado por el método padre
          throw error;
        }
    }

    console.log('Stock validation completed for all items:', stockValidations);
    return stockValidations;
  }

  private async processStockDeductions(
    tx: any,
    saleId: number,
    items: SaleItemDto[],
    warehouseId: number,
    sellerId: number,
  ) {
    const stockUpdates: Array<{
      productId: number;
      previousQty: number;
      newQty: number;
      deducted: number;
      movementId: number | null;
      error?: string;
    }> = [];
    
    // Procesar items secuencialmente para evitar problemas de transacción
    for (const item of items) {
      try {
        // Asegurar que existe un registro de stock
        const existingStock = await tx.stock.findUnique({
          where: {
            warehouseId_productId: {
              warehouseId,
              productId: item.productId,
            },
          },
        });

        if (!existingStock) {
          console.log(`Creating stock record for product ${item.productId}`);
          await tx.stock.create({
            data: {
              warehouseId,
              productId: item.productId,
              qty: 0,
            },
          });
        }

        // Descontar stock
        const updatedStock = await tx.stock.update({
          where: {
            warehouseId_productId: {
              warehouseId,
              productId: item.productId,
            },
          },
          data: {
            qty: {
              decrement: item.qtyBase,
            },
          },
        });

        // Crear movimiento de stock
        const stockMovement = await tx.stockMovement.create({
          data: {
            warehouseId,
            productId: item.productId,
            type: 'SALE',
            qty: -item.qtyBase, // Negativo para salidas
            note: `Sale confirmation - Folio: ${saleId}`,
            userId: sellerId,
            saleId,
          },
        });

        console.log(
          `Stock updated for product ${item.productId}: New qty=${updatedStock.qty}`,
        );
        console.log(`Stock movement created: ${stockMovement.id}`);

        stockUpdates.push({
          productId: item.productId,
          previousQty: updatedStock.qty + item.qtyBase,
          newQty: updatedStock.qty,
          deducted: item.qtyBase,
          movementId: stockMovement.id,
        });
      } catch (error) {
        console.error(
          `Error processing stock deduction for product ${item.productId}:`,
          error,
        );
        // En caso de error, continuar sin actualizar stock
        stockUpdates.push({
          productId: item.productId,
          previousQty: 0,
          newQty: 0,
          deducted: item.qtyBase,
          movementId: null,
          error: error.message,
        });
      }
    }

    return stockUpdates;
  }

  private async generateFolio(tx: any): Promise<string> {
    // Obtener el último folio del día
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1,
    );

    // Formato: YYYYMMDD-0001
    const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');

    // Intentar generar un folio único con reintentos
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      // Obtener el último folio del día
      const lastSale = await tx.sale.findFirst({
        where: {
          folio: { not: null },
          confirmedAt: {
            gte: startOfDay,
            lt: endOfDay,
          },
        },
        orderBy: { folio: 'desc' },
      });

      let nextNumber = 1;
      if (lastSale?.folio) {
        // Extraer el número del folio (formato: YYYYMMDD-0001)
        const folioMatch = lastSale.folio.match(/-(\d+)$/);
        if (folioMatch) {
          nextNumber = parseInt(folioMatch[1]) + 1;
        }
      }

      const folio = `${datePrefix}-${nextNumber.toString().padStart(4, '0')}`;

      // Verificar si el folio ya existe
      const existingSale = await tx.sale.findUnique({
        where: { folio },
      });

      if (!existingSale) {
        return folio;
      }

      attempts++;
      console.log(
        `⚠️ Folio ${folio} ya existe, intentando con siguiente número...`,
      );
    }

    // Si llegamos aquí, usar timestamp para garantizar unicidad
    const timestamp = Date.now().toString().slice(-6);
    return `${datePrefix}-${timestamp}`;
  }

  async syncOfflineSales(dto: SyncSalesDto) {
    console.log(`🔄 [SERVER] Syncing ${dto.sales.length} offline sales`);
    console.log(
      '📦 [SERVER] Sales data received:',
      dto.sales.map((s) => ({
        id: s.id,
        customerId: s.customerId,
        total: s.grandTotal,
        itemsCount: s.items?.length || 0,
      })),
    );

    const results: Array<{
      id: string;
      status: 'CONFIRMED' | 'REVIEW_REQUIRED';
      folio?: string | null;
      error?: string;
      message: string;
    }> = [];

    for (const saleData of dto.sales) {
      console.log(`🔄 [SERVER] Processing sale ${saleData.id}...`);
      try {
        const result = await this.processOfflineSale(saleData);

        // Usar el estado real retornado por processOfflineSale
        const message =
          result.status === 'REVIEW_REQUIRED'
            ? 'Venta enviada a revisión por conflicto de stock'
            : 'Venta sincronizada exitosamente';

        results.push({
          id: saleData.id,
          status: result.status as 'CONFIRMED' | 'REVIEW_REQUIRED',
          folio: result.folio,
          message: message,
        });
      } catch (error: any) {
        console.error(`Failed to sync sale ${saleData.id}:`, error);
        console.error('Error details:', {
          message: error.message,
          name: error.name,
          code: error.code,
          stack: error.stack,
        });

        // Determinar el tipo de error y mensaje específico
        let errorMessage = 'Error desconocido';
        let userMessage = 'La venta requiere revisión';

        // Verificar diferentes tipos de errores
        const errorMsg = error.message || '';
        const errorName = error.name || '';
        const errorCode = error.code || '';

        if (
          errorMsg.includes('Insufficient stock') ||
          errorMsg.includes('stock') ||
          errorMsg.includes('Stock insuficiente')
        ) {
          errorMessage = 'Stock insuficiente';
          userMessage =
            'No hay suficiente stock disponible para completar la venta';
        } else if (
          errorMsg.includes('Unique constraint failed') &&
          errorMsg.includes('uuid')
        ) {
          errorMessage = 'Venta duplicada';
          userMessage = 'Esta venta ya fue procesada anteriormente';
        } else if (
          errorMsg.includes('BadRequestException') ||
          errorName.includes('BadRequestException')
        ) {
          errorMessage = 'Datos inválidos';
          userMessage = 'Los datos de la venta no son válidos';
        } else if (
          errorMsg.includes('NotFoundException') ||
          errorName.includes('NotFoundException')
        ) {
          errorMessage = 'Recurso no encontrado';
          userMessage =
            'No se encontró el cliente, producto o almacén especificado';
        } else if (
          errorMsg.includes('PrismaClientKnownRequestError') ||
          errorName.includes('PrismaClientKnownRequestError')
        ) {
          errorMessage = 'Error de base de datos';
          userMessage = 'Error al guardar en la base de datos';
        } else if (errorCode === 'P2002') {
          errorMessage = 'Venta duplicada';
          userMessage = 'Esta venta ya fue procesada anteriormente';
        } else if (errorCode === 'P2003') {
          errorMessage = 'Referencia inválida';
          userMessage =
            'No se encontró el cliente, producto o almacén especificado';
        } else if (errorCode === 'P2025') {
          errorMessage = 'Registro no encontrado';
          userMessage = 'No se encontró el registro requerido';
        } else if (
          errorMsg.includes('timeout') ||
          errorMsg.includes('TIMEOUT')
        ) {
          errorMessage = 'Tiempo de espera agotado';
          userMessage =
            'La operación tardó demasiado tiempo. Intenta nuevamente.';
        } else if (
          errorMsg.includes('network') ||
          errorMsg.includes('ECONNREFUSED')
        ) {
          errorMessage = 'Error de conexión';
          userMessage =
            'No se pudo conectar con el servidor. Verifica tu conexión.';
        } else if (
          errorMsg.includes('unauthorized') ||
          errorMsg.includes('Unauthorized')
        ) {
          errorMessage = 'No autorizado';
          userMessage = 'No tienes permisos para realizar esta acción.';
        } else {
          // Para errores desconocidos, incluir más información
          errorMessage = `Error del sistema: ${errorName || 'Desconocido'}`;
          userMessage = `Error técnico: ${errorMsg.substring(0, 100)}${errorMsg.length > 100 ? '...' : ''}`;
        }

        results.push({
          id: saleData.id,
          status: 'REVIEW_REQUIRED',
          error: errorMessage,
          message: userMessage,
        });
      }
    }

    console.log(`✅ [SERVER] Sync completed: ${results.length} results`);
    console.log('📊 [SERVER] Results summary:', {
      synced: results.filter((r) => r.status === 'CONFIRMED').length,
      reviewRequired: results.filter((r) => r.status === 'REVIEW_REQUIRED')
        .length,
      total: results.length,
    });
    console.log('📋 [SERVER] Individual results:', results);

    return {
      synced: results.filter((r) => r.status === 'CONFIRMED').length,
      reviewRequired: results.filter((r) => r.status === 'REVIEW_REQUIRED')
        .length,
      results,
    };
  }

  private async processOfflineSale(saleData: SyncSaleDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        console.log(
          `🔄 [PROCESS] Starting transaction for sale ${saleData.id}`,
        );
        console.log(`🔍 [PROCESS] Sale data received:`, {
          id: saleData.id,
          customerId: saleData.customerId,
          warehouseId: saleData.warehouseId,
          sellerId: saleData.sellerId,
          total: saleData.grandTotal,
        });

        // 1. Verificar si el sellerId existe
        console.log(
          `🔍 [PROCESS] Verifying sellerId ${saleData.sellerId} exists...`,
        );
        const seller = await tx.user.findUnique({
          where: { id: saleData.sellerId },
        });

        if (!seller) {
          console.error(
            `❌ [PROCESS] Seller with ID ${saleData.sellerId} not found`,
          );
          throw new Error(`Seller with ID ${saleData.sellerId} not found`);
        }

        console.log(`✅ [PROCESS] Seller found:`, {
          id: seller.id,
          username: seller.username,
          fullName: seller.fullName,
        });

        // 2. Verificar si ya existe una venta con este UUID (idempotencia)
        console.log(
          `🔍 [PROCESS] Checking for existing sale with UUID: ${saleData.id}`,
        );
        const existingSale = await tx.sale.findUnique({
          where: { uuid: saleData.id },
        });

        if (existingSale) {
          console.log(
            `✅ [PROCESS] Sale ${saleData.id} already exists, skipping`,
          );
          return {
            id: existingSale.id,
            folio: existingSale.folio,
            status: existingSale.status,
          };
        }

        // 3. Validar stock disponible y determinar estado
        console.log(
          `📦 [PROCESS] Validating stock for ${saleData.items.length} items`,
        );
        let hasStockConflict = false;
        let stockError = null;

        try {
          await this.validateStockAvailability(
            tx,
            saleData.items,
            saleData.warehouseId,
          );
          console.log(`✅ [PROCESS] Stock validation passed`);
        } catch (error) {
          console.log(`⚠️ [PROCESS] Stock validation failed: ${error.message}`);
          hasStockConflict = true;
          stockError = error.message;
        }

        // 4. Generar folio único
        console.log(`📄 [PROCESS] Generating folio`);
        const folio = await this.generateFolio(tx);
        console.log(`📄 [PROCESS] Generated folio: ${folio}`);

        // 5. Crear la venta con estado apropiado
        const saleStatus = hasStockConflict ? 'REVIEW_REQUIRED' : 'CONFIRMED';
        console.log(`💾 [PROCESS] Creating sale with status: ${saleStatus}`, {
          uuid: saleData.id,
          folio,
          customerId: saleData.customerId,
          warehouseId: saleData.warehouseId,
          sellerId: saleData.sellerId,
          total: saleData.grandTotal,
        });

        const sale = await tx.sale.create({
          data: {
            uuid: saleData.id,
            folio,
            status: saleStatus,
            customerId: saleData.customerId,
            warehouseId: saleData.warehouseId,
            sellerId: saleData.sellerId,
            subtotal: saleData.subtotal,
            taxTotal: saleData.taxTotal,
            grandTotal: saleData.grandTotal,
            confirmedAt: hasStockConflict ? null : new Date(saleData.createdAt),
            createdAt: new Date(saleData.createdAt),
            lastError: hasStockConflict ? stockError : null,
            retryCount: hasStockConflict ? 1 : 0,
          },
          include: {
            customer: true,
            warehouse: true,
            seller: true,
          },
        });
        console.log(`✅ [PROCESS] Sale created with ID: ${sale.id}`);

        // 6. Crear los ítems de la venta (siempre se crean para mostrar en conflictos)
        console.log(
          `🛒 [PROCESS] Creating ${saleData.items.length} sale items`,
        );
        await Promise.all(
          saleData.items.map(async (item, index) => {
            console.log(`🛒 [PROCESS] Creating item ${index + 1}:`, {
              productId: item.productId,
              qty: item.qty,
              qtyBase: item.qtyBase,
              priceUnit: item.priceUnit,
              lineTotal: item.lineTotal,
            });

            return tx.saleItem.create({
              data: {
                saleId: sale.id,
                productId: item.productId,
                unitCode: item.unitCode as any,
                qty: item.qty,
                qtyBase: item.qtyBase,
                priceUnit: item.priceUnit,
                discount: item.discount || 0,
                lineTotal: item.lineTotal,
              },
            });
          }),
        );
        console.log(`✅ [PROCESS] All sale items created successfully`);

        // 7. Descontar stock y crear movimientos (solo si no hay conflicto)
        if (!hasStockConflict) {
          console.log(`📦 [PROCESS] Processing stock deductions`);
          await this.processStockDeductions(
            tx,
            sale.id,
            saleData.items,
            saleData.warehouseId,
            saleData.sellerId,
          );
          console.log(`✅ [PROCESS] Stock deductions processed successfully`);
        } else {
          console.log(
            `⚠️ [PROCESS] Skipping stock deductions due to conflict - will be processed after resolution`,
          );
        }

        console.log(
          `🎉 [PROCESS] Offline sale ${saleData.id} synced successfully with folio ${folio}`,
        );

        return {
          id: sale.id,
          folio: sale.folio,
          status: sale.status,
        };
      });
    } catch (error: any) {
      console.error(
        `❌ [PROCESS] Error processing offline sale ${saleData.id}:`,
        {
          message: error.message,
          name: error.name,
          code: error.code,
          meta: error.meta,
          stack: error.stack,
        },
      );

      // Log específico para errores de Prisma
      if (error.code) {
        console.error(`🔍 [PROCESS] Prisma error details:`, {
          code: error.code,
          meta: error.meta,
          clientVersion: error.clientVersion,
        });
      }

      throw error;
    }
  }

  async getSales(options: {
    page: number;
    limit: number;
    status?: string;
    sellerId?: number;
    folio?: string;
    uuid?: string;
  }) {
    const { page, limit, status, sellerId, folio, uuid } = options;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (sellerId) {
      where.sellerId = sellerId;
    }
    if (folio) {
      where.folio = folio;
    }
    if (uuid) {
      where.uuid = uuid;
    }

    const [sales, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        skip,
        take: limit,
        include: {
          customer: true,
          seller: true,
          items: {
            include: {
              product: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.sale.count({ where }),
    ]);

    return {
      sales,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getSaleById(id: number) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        seller: true,
        warehouse: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException(`Sale with id ${id} not found`);
    }

    return sale;
  }

  async getAllOfflineSales(status?: string) {
    const where: any = {
      // Solo ventas que fueron creadas offline (tienen UUID)
      uuid: { not: null },
    };

    if (status) {
      where.status = status;
    }

    const sales = await this.prisma.sale.findMany({
      where,
      include: {
        customer: true,
        seller: true,
        warehouse: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      sales,
      total: sales.length,
      statusCounts: {
        PENDING_SYNC: sales.filter((s) => s.status === 'PENDING_SYNC').length,
        CONFIRMED: sales.filter((s) => s.status === 'CONFIRMED').length,
        REVIEW_REQUIRED: sales.filter((s) => s.status === 'REVIEW_REQUIRED')
          .length,
      },
    };
  }

  async createDraft(draftData: any) {
    // Validar que sellerId esté presente
    if (!draftData.sellerId) {
      throw new BadRequestException('sellerId is required');
    }

    // Crear borrador con estado DRAFT
    const draft = await this.prisma.sale.create({
      data: {
        status: 'DRAFT',
        customerId: draftData.customerId || 1, // Usar cliente por defecto si no se especifica
        warehouseId: draftData.warehouseId || 1,
        sellerId: draftData.sellerId,
        subtotal: draftData.subtotal || 0,
        taxTotal: draftData.taxTotal || 0,
        grandTotal: draftData.total || 0,
        items: {
          create: (draftData.items || []).map((item: any) => ({
            productId: item.productId,
            unitCode: 'UND', // Por defecto UND
            qty: item.quantity,
            qtyBase: item.quantity, // Mismo valor para UND
            priceUnit: item.unitPrice,
            discount: 0,
            lineTotal: item.total,
          })),
        },
      },
      include: {
        customer: true,
        seller: true,
        warehouse: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return draft;
  }

  async deleteSale(id: number) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        seller: true,
        warehouse: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    // Solo permitir eliminar borradores
    if (sale.status !== 'DRAFT') {
      throw new BadRequestException('Only draft sales can be deleted');
    }

    await this.prisma.sale.delete({
      where: { id },
    });

    return { message: 'Sale deleted successfully' };
  }

  async getSaleByUuid(uuid: string, userId: number) {
    console.log(`🔍 [SALES] Getting sale by UUID: ${uuid} for user: ${userId}`);

    const sale = await this.prisma.sale.findUnique({
      where: { uuid },
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
            id: true,
            fullName: true,
            username: true,
          },
        },
        customer: {
          select: {
            name: true,
            code: true,
          },
        },
      },
    });

    if (!sale) {
      return null;
    }

    // Verificar que el usuario tenga acceso a esta venta
    if (sale.sellerId !== userId) {
      throw new Error('No tienes permisos para ver esta venta');
    }

    return sale;
  }

  async getOfflineSalesStatus(sellerId: number) {
    console.log(
      `🔍 [SALES] Getting offline sales status for seller ${sellerId}`,
    );

    // Obtener ventas offline del vendedor que están en estado REVIEW_REQUIRED
    // o que fueron resueltas recientemente (últimas 24 horas)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const offlineSales = await this.prisma.sale.findMany({
      where: {
        sellerId,
        uuid: { not: null }, // Solo ventas que vinieron de offline (tienen UUID)
        OR: [
          {
            status: 'REVIEW_REQUIRED',
          },
          {
            status: 'CONFIRMED',
            confirmedAt: {
              gte: oneDayAgo, // Ventas confirmadas en las últimas 24 horas
            },
          },
        ],
      },
      select: {
        id: true,
        uuid: true,
        folio: true,
        status: true,
        subtotal: true,
        taxTotal: true,
        grandTotal: true,
        customer: {
          select: {
            name: true,
          },
        },
        items: {
          select: {
            id: true,
            productId: true,
            unitCode: true,
            qty: true,
            qtyBase: true,
            priceUnit: true,
            discount: true,
            lineTotal: true,
            product: {
              select: {
                sku: true,
                name: true,
                taxRate: true,
              },
            },
          },
        },
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(
      `📊 [SALES] Found ${offlineSales.length} offline sales (REVIEW_REQUIRED or recently CONFIRMED) for seller ${sellerId}`,
    );

    return {
      sellerId,
      totalPending: offlineSales.length,
      sales: offlineSales,
    };
  }
}
