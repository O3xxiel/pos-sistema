import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateSellerDto, UpdateSellerDto } from './dto/seller.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SellersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(active?: boolean) {
    const where = active !== undefined ? { isActive: active } : {};

    return await this.prisma.user.findMany({
      where: {
        ...where,
        roles: {
          some: {
            role: {
              code: 'SELLER',
            },
          },
        },
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        _count: {
          select: {
            sales: true,
          },
        },
      },
      orderBy: {
        fullName: 'asc',
      },
    });
  }

  async findOne(id: number) {
    const seller = await this.prisma.user.findFirst({
      where: {
        id,
        roles: {
          some: {
            role: {
              code: 'SELLER',
            },
          },
        },
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        _count: {
          select: {
            sales: true,
          },
        },
      },
    });

    if (!seller) {
      throw new NotFoundException(`Vendedor con ID ${id} no encontrado`);
    }

    return seller;
  }

  async create(createSellerDto: CreateSellerDto) {
    // Verificar si el username ya existe
    const existingUser = await this.prisma.user.findUnique({
      where: { username: createSellerDto.username },
    });

    if (existingUser) {
      throw new ConflictException('El nombre de usuario ya existe');
    }

    // Verificar si el email ya existe (si se proporciona)
    if (createSellerDto.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: createSellerDto.email },
      });

      if (existingEmail) {
        throw new ConflictException('El email ya está registrado');
      }
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(createSellerDto.password, 10);

    // Obtener el rol de vendedor
    const sellerRole = await this.prisma.role.findUnique({
      where: { code: 'SELLER' },
    });

    if (!sellerRole) {
      throw new NotFoundException('Rol de vendedor no encontrado');
    }

    // Crear el usuario
    const user = await this.prisma.user.create({
      data: {
        username: createSellerDto.username,
        passwordHash: hashedPassword,
        fullName: createSellerDto.fullName,
        email: createSellerDto.email,
        phone: createSellerDto.phone,
        address: createSellerDto.address,
        isActive: createSellerDto.isActive ?? true,
        roles: {
          create: {
            roleId: sellerRole.id,
          },
        },
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    return user;
  }

  async update(id: number, updateSellerDto: UpdateSellerDto) {
    // Verificar que el vendedor existe
    const existingSeller = await this.findOne(id);

    // Verificar si el username ya existe (si se está actualizando)
    if (
      updateSellerDto.username &&
      updateSellerDto.username !== existingSeller.username
    ) {
      const existingUser = await this.prisma.user.findUnique({
        where: { username: updateSellerDto.username },
      });

      if (existingUser) {
        throw new ConflictException('El nombre de usuario ya existe');
      }
    }

    // Verificar si el email ya existe (si se está actualizando)
    if (
      updateSellerDto.email &&
      updateSellerDto.email !== existingSeller.email
    ) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: updateSellerDto.email },
      });

      if (existingEmail) {
        throw new ConflictException('El email ya está registrado');
      }
    }

    // Preparar datos de actualización
    const updateData: any = { ...updateSellerDto };

    // Hash de la contraseña si se está actualizando
    if (updateSellerDto.password) {
      updateData.passwordHash = await bcrypt.hash(updateSellerDto.password, 10);
      delete updateData.password;
    }

    // Actualizar el usuario
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    return updatedUser;
  }

  async remove(id: number) {
    // Verificar que el vendedor existe
    await this.findOne(id);

    // Soft delete - marcar como inactivo
    return await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async getStats(sellerId: number, date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
    );
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    // Verificar que el vendedor existe
    await this.findOne(sellerId);

    // Obtener ventas del día
    const sales = await this.prisma.sale.findMany({
      where: {
        sellerId,
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Calcular métricas
    const totalSales = sales.length;
    const totalAmount = sales.reduce(
      (sum, sale) => sum + Number(sale.grandTotal),
      0,
    );
    const averageTicket = totalSales > 0 ? totalAmount / totalSales : 0;

    // Top productos
    const productSales = new Map();
    sales.forEach((sale) => {
      sale.items.forEach((item) => {
        const productName = item.product.name;
        const quantity = item.qty;
        const amount = Number(item.lineTotal);

        if (productSales.has(productName)) {
          const existing = productSales.get(productName);
          productSales.set(productName, {
            quantity: existing.quantity + quantity,
            amount: existing.amount + amount,
            sales: existing.sales + 1,
          });
        } else {
          productSales.set(productName, {
            quantity,
            amount,
            sales: 1,
          });
        }
      });
    });

    const topProducts = Array.from(productSales.entries())
      .map(([name, stats]) => ({
        name,
        quantity: stats.quantity,
        amount: stats.amount,
        sales: stats.sales,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Horas pico
    const hourlySales = new Map();
    sales.forEach((sale) => {
      const hour = sale.createdAt.getHours();
      const amount = Number(sale.grandTotal);

      if (hourlySales.has(hour)) {
        hourlySales.set(hour, hourlySales.get(hour) + amount);
      } else {
        hourlySales.set(hour, amount);
      }
    });

    const peakHours = Array.from(hourlySales.entries())
      .map(([hour, amount]) => ({ hour, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    // Ventas pendientes de sincronizar
    const pendingSales = await this.prisma.sale.count({
      where: {
        sellerId,
        status: 'PENDING_SYNC',
      },
    });

    return {
      date: targetDate.toISOString().split('T')[0],
      sellerId,
      totalSales,
      totalAmount,
      averageTicket,
      topProducts,
      peakHours,
      pendingSales,
      sales: sales.map((sale) => ({
        id: sale.id,
        folio: sale.folio,
        total: Number(sale.grandTotal),
        createdAt: sale.createdAt,
        status: sale.status,
      })),
    };
  }
}
