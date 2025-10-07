// pos-api/prisma/fix-missing-stock.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Obtener el almacén principal
  let warehouse = await prisma.warehouse.findUnique({
    where: { code: 'MAIN' }
  });

  if (!warehouse) {
    // Crear almacén principal si no existe
    warehouse = await prisma.warehouse.create({
      data: {
        code: 'MAIN',
        name: 'Almacén Principal',
        isActive: true,
      }
    });
  }

  // Obtener todos los productos activos
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      stock: {
        where: { warehouseId: warehouse.id }
      }
    }
  });

  // Encontrar productos sin stock
  const productsWithoutStock = products.filter(product => product.stock.length === 0);

  console.log(`Found ${productsWithoutStock.length} products without stock records`);

  // Crear registros de stock para productos que no lo tienen
  if (productsWithoutStock.length > 0) {
    await Promise.all(
      productsWithoutStock.map(product =>
        prisma.stock.create({
          data: {
            warehouseId: warehouse.id,
            productId: product.id,
            qty: 0, // Stock inicial de 0
          }
        })
      )
    );

    console.log(`✅ Created stock records for ${productsWithoutStock.length} products`);
  }

  // Mostrar resumen
  const totalProducts = await prisma.product.count({ where: { isActive: true } });
  const totalStock = await prisma.stock.count({ where: { warehouseId: warehouse.id } });

  console.log('📊 Summary:');
  console.log(`  - Total active products: ${totalProducts}`);
  console.log(`  - Products with stock records: ${totalStock}`);
  console.log(`  - Warehouse: ${warehouse.name} (ID: ${warehouse.id})`);
}

main()
  .catch((e) => {
    console.error('FIX STOCK ERROR →\n', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());






