// pos-api/src/sales/conflicts.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ResolveConflictDto, ConflictAction } from './dto/resolve-conflict.dto';

@Injectable()
export class ConflictsService {
  constructor(private prisma: PrismaService) {}

  async getConflicts() {
    console.log('🔍 [CONFLICTS] Fetching sales with REVIEW_REQUIRED status');

    try {
      const conflicts = await this.prisma.sale.findMany({
        where: {
          status: 'REVIEW_REQUIRED',
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          seller: {
            select: {
              id: true,
              fullName: true,
              username: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              name: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      console.log(
        `📊 [CONFLICTS] Found ${conflicts.length} sales requiring review`,
      );

      // Enriquecer con información de stock
      const enrichedConflicts = await Promise.all(
        conflicts.map(async (sale) => {
          const enrichedItems = await Promise.all(
            sale.items.map(async (item) => {
              try {
                // Obtener stock disponible del producto en el warehouse
                const stock = await this.prisma.stock.findFirst({
                  where: {
                    productId: item.productId,
                    warehouseId: sale.warehouseId,
                  },
                });

                const availableStock = stock?.qty || 0;
                const requiredStock = item.qtyBase;
                const stockShortage = Math.max(
                  0,
                  requiredStock - availableStock,
                );

                return {
                  ...item,
                  availableStock,
                  requiredStock,
                  stockShortage: stockShortage > 0 ? stockShortage : undefined,
                };
              } catch (error) {
                console.error(
                  `❌ [CONFLICTS] Error getting stock for item ${item.id}:`,
                  error,
                );
                return {
                  ...item,
                  availableStock: 0,
                  requiredStock: item.qtyBase,
                  stockShortage: item.qtyBase,
                };
              }
            }),
          );

          return {
            ...sale,
            items: enrichedItems,
          };
        }),
      );

      return enrichedConflicts;
    } catch (error) {
      console.error('❌ [CONFLICTS] Error in getConflicts:', error);
      throw error;
    }
  }

  async resolveConflict(adminId: number, dto: ResolveConflictDto) {
    console.log(
      `🔧 [CONFLICTS] Resolving conflict ${dto.saleId} with action ${dto.action}`,
    );

    // Verificar que la venta existe y está en estado REVIEW_REQUIRED
    const sale = await this.prisma.sale.findFirst({
      where: {
        id: dto.saleId,
        status: 'REVIEW_REQUIRED',
      },
      include: {
        items: true,
      },
    });

    if (!sale) {
      throw new NotFoundException('Venta no encontrada o no requiere revisión');
    }

    // Ejecutar la acción correspondiente
    switch (dto.action) {
      case ConflictAction.EDIT_QUANTITIES:
        return this.editQuantities(adminId, sale, dto.items || [], dto.notes);

      case ConflictAction.CANCEL:
        return this.cancelSale(adminId, sale, dto.notes);

      default:
        throw new BadRequestException('Acción no válida');
    }
  }

  private async editQuantities(
    adminId: number,
    sale: any,
    items: any[],
    notes?: string,
  ) {
    console.log(`✏️ [CONFLICTS] Editing quantities for sale ${sale.id}`);

    if (!items || items.length === 0) {
      throw new BadRequestException(
        'Se requieren items para editar cantidades',
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      // Actualizar cantidades de items
      for (const itemEdit of items) {
        const originalItem = sale.items.find((i: any) => i.id === itemEdit.id);
        if (!originalItem) {
          throw new BadRequestException(
            `Item con ID ${itemEdit.id} no encontrado en la venta`,
          );
        }

        // Usar la nueva cantidad o mantener la original
        const newQty =
          itemEdit.newQty !== undefined ? itemEdit.newQty : originalItem.qty;
        const newQtyBase =
          itemEdit.newQtyBase !== undefined
            ? itemEdit.newQtyBase
            : originalItem.qtyBase;

        // Calcular el nuevo lineTotal basado en la nueva cantidad
        const newLineTotal = newQty * originalItem.priceUnit;

        console.log(`📊 [CONFLICTS] Editando item ${itemEdit.id}:`);
        console.log(
          `   - Cantidad original: ${originalItem.qty} → Nueva: ${newQty}`,
        );
        console.log(
          `   - Cantidad base original: ${originalItem.qtyBase} → Nueva: ${newQtyBase}`,
        );
        console.log(`   - Precio unitario: ${originalItem.priceUnit}`);
        console.log(
          `   - LineTotal original: ${originalItem.lineTotal} → Nuevo: ${newLineTotal}`,
        );

        await tx.saleItem.update({
          where: { id: itemEdit.id },
          data: {
            qty: newQty,
            qtyBase: newQtyBase,
            lineTotal: newLineTotal,
          },
        });
      }

      // Recalcular totales de la venta
      const updatedItems = await tx.saleItem.findMany({
        where: { saleId: sale.id },
      });

      const subtotal = updatedItems.reduce(
        (sum, item) => sum + Number(item.lineTotal),
        0,
      );

      // Calcular impuestos por producto según su taxRate
      let taxTotal = 0;
      for (const item of updatedItems) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { taxRate: true },
        });
        if (product && Number(product.taxRate) > 0) {
          taxTotal += (Number(item.lineTotal) * Number(product.taxRate)) / 100;
        }
      }

      const grandTotal = subtotal + taxTotal;

      const updatedSale = await tx.sale.update({
        where: { id: sale.id },
        data: {
          subtotal,
          taxTotal,
          grandTotal,
          status: 'CONFIRMED',
          confirmedAt: new Date(),
        },
      });

      // Descontar stock con las cantidades modificadas
      console.log(
        `📦 [CONFLICTS] Processing stock deductions for modified quantities`,
      );
      for (const itemEdit of items) {
        const originalItem = sale.items.find((i: any) => i.id === itemEdit.id);
        if (!originalItem) {
          console.error(
            `❌ [CONFLICTS] Original item with ID ${itemEdit.id} not found`,
          );
          continue;
        }

        const finalQtyBase = itemEdit.newQtyBase || originalItem.qtyBase;
        console.log(
          `📦 [CONFLICTS] Processing stock deduction for product ${originalItem.productId}: ${finalQtyBase} units`,
        );

        // Asegurar que existe un registro de stock
        const existingStock = await tx.stock.findUnique({
          where: {
            warehouseId_productId: {
              warehouseId: sale.warehouseId,
              productId: originalItem.productId,
            },
          },
        });

        if (!existingStock) {
          console.log(
            `Creating stock record for product ${originalItem.productId}`,
          );
          await tx.stock.create({
            data: {
              warehouseId: sale.warehouseId,
              productId: originalItem.productId,
              qty: 0,
            },
          });
        }

        // Descontar stock con la cantidad modificada
        const updatedStock = await tx.stock.update({
          where: {
            warehouseId_productId: {
              warehouseId: sale.warehouseId,
              productId: originalItem.productId,
            },
          },
          data: {
            qty: {
              decrement: finalQtyBase,
            },
          },
        });

        // Crear movimiento de stock
        await tx.stockMovement.create({
          data: {
            warehouseId: sale.warehouseId,
            productId: originalItem.productId,
            type: 'SALE',
            qty: -finalQtyBase, // Negativo porque es una salida
            note: `Venta confirmada con cantidades modificadas - Item ID: ${itemEdit.id}, Original: ${originalItem.qtyBase}, Modified: ${finalQtyBase}`,
            userId: adminId,
            saleId: sale.id,
          },
        });

        console.log(
          `📦 [CONFLICTS] Stock updated for product ${originalItem.productId}: ${updatedStock.qty} remaining (deducted ${finalQtyBase})`,
        );
      }

      // Registrar en audit log
      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'CONFLICT_RESOLVED',
          entity: 'Sale',
          entityId: sale.id,
          meta: {
            action: 'EDIT_QUANTITIES',
            notes,
            previousStatus: 'REVIEW_REQUIRED',
            newStatus: 'CONFIRMED',
            editedItems: items,
            newTotals: {
              subtotal,
              taxTotal,
              grandTotal,
            },
            stockDeductions: updatedItems.map((item) => ({
              productId: item.productId,
              qtyBase: item.qtyBase,
            })),
          },
        },
      });

      console.log(
        `✅ [CONFLICTS] Quantities edited, stock deducted, and sale ${sale.id} confirmed`,
      );
      return updatedSale;
    });
  }

  private async cancelSale(adminId: number, sale: any, notes?: string) {
    console.log(`❌ [CONFLICTS] Cancelling sale ${sale.id}`);

    return await this.prisma.$transaction(async (tx) => {
      // Cambiar estado a CANCELLED
      const updatedSale = await tx.sale.update({
        where: { id: sale.id },
        data: {
          status: 'CANCELLED',
        },
      });

      // Registrar en audit log
      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'CONFLICT_CANCELLED',
          entity: 'Sale',
          entityId: sale.id,
          meta: {
            action: 'CANCEL',
            notes,
            previousStatus: 'REVIEW_REQUIRED',
            newStatus: 'CANCELLED',
          },
        },
      });

      console.log(`✅ [CONFLICTS] Sale ${sale.id} cancelled`);
      return updatedSale;
    });
  }
}
