import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UnitsManagementService {
  constructor(private prisma: PrismaService) {}

  // Obtener todas las unidades activas
  async getAllUnits() {
    return this.prisma.unit.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  // Obtener una unidad por ID
  async getUnitById(id: number) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
    });

    if (!unit) {
      throw new NotFoundException(`Unidad con ID ${id} no encontrada`);
    }

    return unit;
  }

  // Obtener una unidad por código
  async getUnitByCode(code: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { code },
    });

    if (!unit) {
      throw new NotFoundException(`Unidad con código ${code} no encontrada`);
    }

    return unit;
  }

  // Crear una nueva unidad
  async createUnit(data: { code: string; name: string; symbol?: string }) {
    // Verificar que el código no existe
    const existingUnit = await this.prisma.unit.findUnique({
      where: { code: data.code },
    });

    if (existingUnit) {
      throw new BadRequestException(
        `Ya existe una unidad con el código ${data.code}`,
      );
    }

    return this.prisma.unit.create({
      data: {
        code: data.code,
        name: data.name,
        symbol: data.symbol,
      },
    });
  }

  // Actualizar una unidad
  async updateUnit(
    id: number,
    data: {
      code?: string;
      name?: string;
      symbol?: string;
      isActive?: boolean;
    },
  ) {
    const existingUnit = await this.prisma.unit.findUnique({
      where: { id },
    });

    if (!existingUnit) {
      throw new NotFoundException(`Unidad con ID ${id} no encontrada`);
    }

    // Si se está cambiando el código, verificar que no existe otro con el mismo código
    if (data.code && data.code !== existingUnit.code) {
      const duplicateUnit = await this.prisma.unit.findUnique({
        where: { code: data.code },
      });

      if (duplicateUnit) {
        throw new BadRequestException(
          `Ya existe una unidad con el código ${data.code}`,
        );
      }
    }

    return this.prisma.unit.update({
      where: { id },
      data,
    });
  }

  // Eliminar una unidad (soft delete)
  async deleteUnit(id: number) {
    const existingUnit = await this.prisma.unit.findUnique({
      where: { id },
    });

    if (!existingUnit) {
      throw new NotFoundException(`Unidad con ID ${id} no encontrada`);
    }

    // Verificar que no esté siendo usada por productos activos
    const activeProductUnits = await this.prisma.productUnit.findMany({
      where: { 
        unitId: id,
        isActive: true 
      },
    });

    if (activeProductUnits.length > 0) {
      throw new BadRequestException(
        `No se puede eliminar la unidad porque está siendo usada por ${activeProductUnits.length} productos. Primero desasigna la unidad de esos productos.`,
      );
    }

    return this.prisma.unit.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // Obtener unidades disponibles para un producto
  async getAvailableUnitsForProduct(productId: number) {
    // Obtener todas las unidades activas
    const allUnits = await this.prisma.unit.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    // Obtener unidades ya asignadas al producto
    const assignedUnits = await this.prisma.productUnit.findMany({
      where: {
        productId,
        isActive: true,
      },
      include: { unit: true },
    });

    const assignedUnitIds = assignedUnits.map((pu) => pu.unitId);

    // Filtrar unidades no asignadas
    const availableUnits = allUnits.filter(
      (unit) => !assignedUnitIds.includes(unit.id),
    );

    return {
      available: availableUnits,
      assigned: assignedUnits.map((pu) => ({
        id: pu.id,
        unitId: pu.unit.id,
        code: pu.unit.code,
        name: pu.unit.name,
        symbol: pu.unit.symbol,
        factor: pu.factor,
      })),
    };
  }

  // Asignar unidad a producto
  async assignUnitToProduct(productId: number, unitId: number, factor: number) {
    // Verificar que el producto existe
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Producto con ID ${productId} no encontrado`);
    }

    // Verificar que la unidad existe
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
    });

    if (!unit) {
      throw new NotFoundException(`Unidad con ID ${unitId} no encontrada`);
    }

    // Verificar que no esté ya asignada
    const existingAssignment = await this.prisma.productUnit.findUnique({
      where: {
        productId_unitId: {
          productId,
          unitId,
        },
      },
    });

    if (existingAssignment) {
      throw new BadRequestException(
        `La unidad ya está asignada a este producto`,
      );
    }

    return this.prisma.productUnit.create({
      data: {
        productId,
        unitId,
        factor,
      },
      include: {
        unit: true,
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
    });
  }

  // Remover unidad de producto
  async removeUnitFromProduct(productId: number, unitId: number) {
    const productUnit = await this.prisma.productUnit.findUnique({
      where: {
        productId_unitId: {
          productId,
          unitId,
        },
      },
    });

    if (!productUnit) {
      throw new NotFoundException(`La unidad no está asignada a este producto`);
    }

    return this.prisma.productUnit.update({
      where: { id: productUnit.id },
      data: { isActive: false },
    });
  }

  // Actualizar factor de unidad en producto
  async updateProductUnitFactor(
    productId: number,
    unitId: number,
    factor: number,
  ) {
    const productUnit = await this.prisma.productUnit.findUnique({
      where: {
        productId_unitId: {
          productId,
          unitId,
        },
      },
    });

    if (!productUnit) {
      throw new NotFoundException(`La unidad no está asignada a este producto`);
    }

    return this.prisma.productUnit.update({
      where: { id: productUnit.id },
      data: { factor },
      include: {
        unit: true,
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
    });
  }
}
