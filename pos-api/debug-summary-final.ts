import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugSummaryFinal() {
  try {
    console.log('🔍 Debuggeando resumen final...\n');
    
    const date = new Date('2025-10-03T00:00:00');
    const startOfDay = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    
    console.log(`📅 Fecha: ${date.toISOString()}`);
    console.log(`📅 Inicio: ${startOfDay.toISOString()}`);
    console.log(`📅 Fin: ${endOfDay.toISOString()}`);
    
    // Consulta exacta del servicio
    const allSellers = await prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: {
              code: 'SELLER',
            },
          },
        },
      },
      select: {
        id: true,
        username: true,
        fullName: true,
      },
    });

    console.log(`\n👥 Vendedores encontrados: ${allSellers.length}`);
    allSellers.forEach((seller, index) => {
      console.log(`   ${index + 1}. ${seller.fullName} (${seller.username}) - ID: ${seller.id}`);
    });
    
    // Verificar si el admin tiene rol SELLER
    const admin = await prisma.user.findUnique({
      where: { username: 'admin' },
      select: {
        id: true,
        username: true,
        fullName: true,
        roles: {
          select: {
            role: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });
    
    console.log('\n👤 Admin:');
    if (admin) {
      console.log(`   ${admin.fullName} (${admin.username}) - ID: ${admin.id}`);
      console.log('   Roles:');
      admin.roles.forEach((userRole, index) => {
        console.log(`     ${index + 1}. ${userRole.role.name} (${userRole.role.code})`);
      });
    }
    
    // Simular la lógica del resumen
    const sellerMetrics = await Promise.all(
      allSellers.map(async (seller) => {
        const sales = await prisma.sale.findMany({
          where: {
            sellerId: seller.id,
            status: 'CONFIRMED',
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
            customer: true,
          },
        });

        const totalSales = sales.length;
        const totalAmount = sales.reduce(
          (sum, sale) => sum + Number(sale.grandTotal),
          0,
        );
        const totalQuantity = sales.reduce(
          (sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.qtyBase, 0),
          0,
        );
        const averageTicket = totalSales > 0 ? totalAmount / totalSales : 0;

        console.log(`\n   📊 ${seller.fullName}:`);
        console.log(`      Ventas: ${totalSales}`);
        console.log(`      Total: Q${totalAmount}`);
        console.log(`      Cantidad: ${totalQuantity}`);
        console.log(`      Ticket Promedio: Q${averageTicket}`);

        return {
          seller: {
            id: seller.id,
            username: seller.username,
            fullName: seller.fullName,
          },
          metrics: {
            totalSales,
            totalAmount,
            totalQuantity,
            averageTicket,
          },
          topProducts: [],
        };
      })
    );

    // Calcular totales generales
    const totalSales = sellerMetrics.reduce((sum, seller) => sum + seller.metrics.totalSales, 0);
    const totalAmount = sellerMetrics.reduce((sum, seller) => sum + seller.metrics.totalAmount, 0);
    const totalQuantity = sellerMetrics.reduce((sum, seller) => sum + seller.metrics.totalQuantity, 0);
    const averageTicket = totalSales > 0 ? totalAmount / totalSales : 0;

    console.log(`\n📊 Totales Generales:`);
    console.log(`   Total Ventas: ${totalSales}`);
    console.log(`   Total Vendido: Q${totalAmount}`);
    console.log(`   Vendedores Activos: ${sellerMetrics.filter(s => s.metrics.totalSales > 0).length}/${sellerMetrics.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugSummaryFinal();








