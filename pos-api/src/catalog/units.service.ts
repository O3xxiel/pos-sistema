import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UnitsService {
  constructor(private prisma: PrismaService) {}

  // Obtener todas las unidades de un producto
  async getProductUnits(productId: number) {
    return this.prisma.productUnit.findMany({
      where: {
        productId,
        isActive: true,
      },
      include: {
        unit: true,
      },
      orderBy: {
        factor: 'asc',
      },
    });
  }

  // Crear una nueva unidad para un producto (usando unitId)
  async createProductUnit(
    productId: number,
    unitData: {
      unitId: number;
      factor: number;
    },
  ) {
    // Verificar que el producto existe
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('Producto no encontrado');
    }

    // Verificar que la unidad existe
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitData.unitId },
    });

    if (!unit) {
      throw new Error('Unidad no encontrada');
    }

    // Verificar que no existe una unidad con el mismo ID para este producto
    const existingUnit = await this.prisma.productUnit.findUnique({
      where: {
        productId_unitId: {
          productId,
          unitId: unitData.unitId,
        },
      },
    });

    if (existingUnit) {
      throw new Error('Ya existe esta unidad para este producto');
    }

    return this.prisma.productUnit.create({
      data: {
        productId,
        unitId: unitData.unitId,
        factor: unitData.factor,
      },
      include: {
        unit: true,
      },
    });
  }

  // Actualizar una unidad existente
  async updateProductUnit(
    unitId: number,
    unitData: {
      factor?: number;
      isActive?: boolean;
    },
  ) {
    const existingUnit = await this.prisma.productUnit.findUnique({
      where: { id: unitId },
    });

    if (!existingUnit) {
      throw new Error('Unidad no encontrada');
    }

    return this.prisma.productUnit.update({
      where: { id: unitId },
      data: unitData,
      include: {
        unit: true,
      },
    });
  }

  // Eliminar una unidad (soft delete)
  async deleteProductUnit(unitId: number) {
    return this.prisma.productUnit.update({
      where: { id: unitId },
      data: { isActive: false },
    });
  }

  // Obtener unidades estándar (UND, DOC, CAJ)
  async getStandardUnits() {
    return this.prisma.unit.findMany({
      where: {
        code: { in: ['UND', 'DOC', 'CAJ'] },
        isActive: true,
      },
      orderBy: { code: 'asc' },
    });
  }

  // Inicializar unidades estándar para un producto si no las tiene
  async initializeStandardUnits(productId: number) {
    const existingUnits = await this.prisma.productUnit.findMany({
      where: { productId },
      include: { unit: true },
    });

    if (existingUnits.length > 0) {
      return existingUnits; // Ya tiene unidades
    }

    const standardUnits = await this.getStandardUnits();
    const createdUnits: any[] = [];

    for (const unit of standardUnits) {
      const createdUnit = await this.prisma.productUnit.create({
        data: {
          productId,
          unitId: unit.id,
          factor: unit.code === 'UND' ? 1 : unit.code === 'DOC' ? 12 : 24,
        },
        include: {
          unit: true,
        },
      });
      createdUnits.push(createdUnit);
    }

    return createdUnits;
  }
}
