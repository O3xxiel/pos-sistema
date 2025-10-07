import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  private parseUpdatedSince(updated_since?: string) {
    if (!updated_since) return undefined;
    const d = new Date(updated_since);
    return isNaN(d.getTime()) ? undefined : d;
  }

  async listProducts(opts: {
    page: number;
    pageSize: number;
    updated_since?: string;
  }) {
    const { page, pageSize, updated_since } = opts;
    const date = this.parseUpdatedSince(updated_since);

    const where: any = { isActive: true };
    if (date) where.updatedAt = { gte: date };

    const [total, rows] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: {
          units: {
            include: {
              unit: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const items = rows.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      barcode: p.barcode,
      unitBase: p.unitBase,
      priceBase: Number(p.priceBase),
      taxRate: Number(p.taxRate),
      isActive: p.isActive,
      updatedAt: p.updatedAt,
      units: p.units.map((u) => ({
        unitCode: u.unit.code,
        unitName: u.unit.name,
        unitSymbol: u.unit.symbol,
        factor: u.factor,
      })),
    }));

    return {
      items,
      page,
      pageSize,
      total,
      hasMore: page * pageSize < total,
      lastUpdatedAt: items[0]?.updatedAt ?? null,
    };
  }

  async listCustomers(opts: {
    page: number;
    pageSize: number;
    updated_since?: string;
  }) {
    const { page, pageSize, updated_since } = opts;
    const date = this.parseUpdatedSince(updated_since);

    const where: any = { isActive: true };
    if (date) where.updatedAt = { gte: date };

    const [total, rows] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const items = rows.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      nit: c.nit,
      phone: c.phone,
      address: c.address,
      isActive: c.isActive,
      updatedAt: c.updatedAt,
    }));

    return {
      items,
      page,
      pageSize,
      total,
      hasMore: page * pageSize < total,
      lastUpdatedAt: items[0]?.updatedAt ?? null,
    };
  }

  async createProduct(dto: CreateProductDto) {
    console.log('🛍️ [SERVICE] createProduct called with DTO:', JSON.stringify(dto, null, 2));
    
    try {
      const product = await this.prisma.product.create({
      data: {
        sku: dto.sku,
        name: dto.name,
        barcode: dto.barcode,
        unitBase: dto.unitBase as any,
        priceBase: dto.priceBase,
        taxRate: dto.taxRate,
        isActive: dto.isActive ?? true,
        units: dto.units && dto.units.length > 0 ? {
          create: dto.units.map((unit) => ({
            unitId: unit.unitId,
            factor: unit.factor,
          })),
        } : undefined,
      },
      include: {
        units: {
          include: {
            unit: true,
          },
        },
      },
    });

    // Crear registro de stock inicial en el almacén principal (ID 1)
    try {
      const stockQty = dto.initialStock || 0;
      console.log('📦 [SERVICE] Creating initial stock:', {
        productId: product.id,
        stockQty,
        warehouseId: 1
      });

      await this.prisma.stock.create({
        data: {
          warehouseId: 1, // Almacén principal por defecto
          productId: product.id,
          qty: stockQty,
        },
      });

      console.log(
        `Initial stock created for product ${product.id}: ${stockQty} units`,
      );
    } catch (error) {
      // Si falla la creación del stock, continúa (el producto ya fue creado)
      console.error(
        `Could not create initial stock for product ${product.id}:`,
        error,
      );
    }

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      barcode: product.barcode,
      unitBase: product.unitBase,
      priceBase: Number(product.priceBase),
      taxRate: Number(product.taxRate),
      isActive: product.isActive,
      updatedAt: product.updatedAt,
      units: product.units.map((u) => ({
        unitCode: u.unit.code,
        unitName: u.unit.name,
        unitSymbol: u.unit.symbol,
        factor: u.factor,
      })),
    };
    } catch (error) {
      console.error('❌ [SERVICE] Error creating product:', error);
      throw error;
    }
  }

  async updateProduct(id: number, dto: UpdateProductDto) {
    // Verificar que el producto existe
    const existingProduct = await this.prisma.product.findUnique({
      where: { id },
    });
    if (!existingProduct) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Si se proporcionan unidades, eliminar las existentes y crear las nuevas
    if (dto.units) {
      await this.prisma.productUnit.deleteMany({ where: { productId: id } });
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.sku && { sku: dto.sku }),
        ...(dto.name && { name: dto.name }),
        ...(dto.barcode !== undefined && { barcode: dto.barcode }),
        ...(dto.unitBase && { unitBase: dto.unitBase as any }),
        ...(dto.priceBase !== undefined && { priceBase: dto.priceBase }),
        ...(dto.taxRate !== undefined && { taxRate: dto.taxRate }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.units && {
          units: {
            create: dto.units.map((unit) => ({
              unitId: unit.unitId,
              factor: unit.factor,
            })),
          },
        }),
      },
      include: {
        units: {
          include: {
            unit: true,
          },
        },
      },
    });

    // Actualizar stock si se proporcionó initialStock
    if (dto.initialStock !== undefined) {
      try {
        console.log(
          `Adding stock for product ${id} with qty: ${dto.initialStock}`,
        );

        const stockResult = await this.prisma.stock.upsert({
          where: {
            warehouseId_productId: {
              warehouseId: 1, // Almacén principal por defecto
              productId: id,
            },
          },
          update: {
            qty: {
              increment: dto.initialStock, // Sumar al stock existente
            },
          },
          create: {
            warehouseId: 1,
            productId: id,
            qty: dto.initialStock,
          },
        });

        console.log(`Stock added successfully for product ${id}:`, stockResult);
      } catch (error) {
        console.error(`Could not add stock for product ${id}:`, error);
      }
    }

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      barcode: product.barcode,
      unitBase: product.unitBase,
      priceBase: Number(product.priceBase),
      taxRate: Number(product.taxRate),
      isActive: product.isActive,
      updatedAt: product.updatedAt,
      units: product.units.map((u) => ({
        unitCode: u.unit.code,
        unitName: u.unit.name,
        unitSymbol: u.unit.symbol,
        factor: u.factor,
      })),
    };
  }

  async deleteProduct(id: number) {
    // Verificar que el producto existe
    const existingProduct = await this.prisma.product.findUnique({
      where: { id },
    });
    if (!existingProduct) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Eliminar unidades relacionadas primero
    await this.prisma.productUnit.deleteMany({ where: { productId: id } });

    // Eliminar el producto
    await this.prisma.product.delete({ where: { id } });

    return { message: 'Product deleted successfully' };
  }

  async createCustomer(dto: CreateCustomerDto) {
    const customer = await this.prisma.customer.create({
      data: {
        code: dto.code,
        name: dto.name,
        nit: dto.nit,
        phone: dto.phone,
        address: dto.address,
        isActive: dto.isActive ?? true,
      },
    });

    return {
      id: customer.id,
      code: customer.code,
      name: customer.name,
      nit: customer.nit,
      phone: customer.phone,
      address: customer.address,
      isActive: customer.isActive,
      updatedAt: customer.updatedAt,
    };
  }

  async updateCustomer(id: number, dto: UpdateCustomerDto) {
    // Verificar que el cliente existe
    const existingCustomer = await this.prisma.customer.findUnique({
      where: { id },
    });
    if (!existingCustomer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    const customer = await this.prisma.customer.update({
      where: { id },
      data: {
        ...(dto.code && { code: dto.code }),
        ...(dto.name && { name: dto.name }),
        ...(dto.nit !== undefined && { nit: dto.nit }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    return {
      id: customer.id,
      code: customer.code,
      name: customer.name,
      nit: customer.nit,
      phone: customer.phone,
      address: customer.address,
      isActive: customer.isActive,
      updatedAt: customer.updatedAt,
    };
  }

  async deleteCustomer(id: number) {
    // Verificar que el cliente existe
    const existingCustomer = await this.prisma.customer.findUnique({
      where: { id },
    });
    if (!existingCustomer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    // Eliminar el cliente
    await this.prisma.customer.delete({ where: { id } });

    return { message: 'Customer deleted successfully' };
  }

  async getStock(warehouseId: number = 1) {
    // Obtener todos los productos activos
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
      },
      include: {
        stock: {
          where: {
            warehouseId,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Obtener información del warehouse
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: warehouseId },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    // Mapear productos a formato de stock (creando registros virtuales para productos sin stock)
    return products.map((product) => ({
      id: product.stock[0]?.id || 0, // ID virtual para productos sin stock
      warehouseId,
      productId: product.id,
      qty: product.stock[0]?.qty || 0, // 0 si no tiene stock registrado
      updatedAt: product.stock[0]?.updatedAt || product.updatedAt,
      product: {
        id: product.id,
        sku: product.sku,
        name: product.name,
        barcode: product.barcode,
        unitBase: product.unitBase,
        priceBase: Number(product.priceBase),
        isActive: product.isActive,
      },
      warehouse: warehouse || {
        id: warehouseId,
        code: 'MAIN',
        name: 'Almacén Principal',
      },
    }));
  }

  async addStock(
    productId: number,
    quantity: number,
    warehouseId: number = 1,
    userId: number = 1,
  ) {
    // Verificar que el producto existe
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, sku: true },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    if (quantity <= 0) {
      throw new BadRequestException('La cantidad debe ser mayor a 0');
    }

    // Verificar que el warehouse existe, si no, crear uno por defecto
    let warehouse = await this.prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });

    if (!warehouse) {
      console.log(
        `Warehouse ${warehouseId} not found, creating default warehouse`,
      );
      warehouse = await this.prisma.warehouse.create({
        data: {
          id: warehouseId,
          code: 'MAIN',
          name: 'Almacén Principal',
          isActive: true,
        },
      });
    }

    console.log(
      `Adding ${quantity} units of stock for product ${productId} (${product.name}) in warehouse ${warehouseId}`,
    );

    let stockResult;

    try {
      // Usar upsert para sumar al stock existente o crear nuevo registro
      console.log(
        `Updating stock for product ${productId} in warehouse ${warehouseId}`,
      );
      stockResult = await this.prisma.stock.upsert({
        where: {
          warehouseId_productId: {
            warehouseId,
            productId,
          },
        },
        update: {
          qty: {
            increment: quantity, // Sumar al stock existente
          },
        },
        create: {
          warehouseId,
          productId,
          qty: quantity,
        },
      });

      console.log(`Stock updated successfully: ${stockResult.qty} units`);

      // Crear movimiento de stock para auditoría
      console.log(`Creating stock movement record`);
      await this.prisma.stockMovement.create({
        data: {
          warehouseId,
          productId,
          type: 'PURCHASE',
          qty: quantity,
          note: `Stock addition - Product: ${product.name} (${product.sku})`,
          userId: userId,
        },
      });

      console.log(`Stock movement created successfully`);

      console.log(
        `Stock added successfully for product ${productId}: New total = ${stockResult.qty}`,
      );
    } catch (error) {
      console.error(`Error in addStock operation:`, error);
      throw error;
    }

    return {
      productId,
      productName: product.name,
      productSku: product.sku,
      warehouseId,
      addedQuantity: quantity,
      newTotalQuantity: stockResult.qty,
      message: `Se agregaron ${quantity} unidades de ${product.name}. Stock total: ${stockResult.qty}`,
    };
  }
}
