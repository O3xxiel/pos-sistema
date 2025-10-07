const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testStockOperations() {
  console.log('🧪 Testing stock operations...');
  
  try {
    // 1. Verificar si hay productos
    console.log('\n1. Checking products...');
    const products = await prisma.product.findMany({
      take: 3,
      select: { id: true, name: true, sku: true }
    });
    console.log('Products found:', products);

    // 2. Verificar si hay warehouses
    console.log('\n2. Checking warehouses...');
    const warehouses = await prisma.warehouse.findMany();
    console.log('Warehouses found:', warehouses);

    // 3. Si no hay warehouse, crear uno
    if (warehouses.length === 0) {
      console.log('\n3. Creating default warehouse...');
      const warehouse = await prisma.warehouse.create({
        data: {
          code: 'MAIN',
          name: 'Almacén Principal',
          isActive: true,
        },
      });
      console.log('Warehouse created:', warehouse);
    }

    // 4. Verificar si hay usuarios
    console.log('\n4. Checking users...');
    const users = await prisma.user.findMany({
      take: 3,
      select: { id: true, username: true, fullName: true }
    });
    console.log('Users found:', users);

    // 5. Probar operación de stock si hay productos
    if (products.length > 0) {
      const productId = products[0].id;
      const warehouseId = warehouses.length > 0 ? warehouses[0].id : 1;
      const userId = users.length > 0 ? users[0].id : 1;

      console.log(`\n5. Testing stock operation for product ${productId}...`);
      
      // Verificar stock actual
      const currentStock = await prisma.stock.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId,
            productId,
          },
        },
      });
      console.log('Current stock:', currentStock);

      // Probar upsert de stock
      console.log('Testing stock upsert...');
      const stockResult = await prisma.stock.upsert({
        where: {
          warehouseId_productId: {
            warehouseId,
            productId,
          },
        },
        update: {
          qty: {
            increment: 5,
          },
        },
        create: {
          warehouseId,
          productId,
          qty: 5,
        },
      });
      console.log('Stock upsert result:', stockResult);

      // Probar creación de movimiento
      console.log('Testing stock movement creation...');
      const movement = await prisma.stockMovement.create({
        data: {
          warehouseId,
          productId,
          type: 'PURCHASE',
          qty: 5,
          note: 'Test movement',
          userId,
        },
      });
      console.log('Stock movement created:', movement);

    } else {
      console.log('\n5. No products found, skipping stock test');
    }

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Error during testing:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      meta: error.meta,
    });
  } finally {
    await prisma.$disconnect();
  }
}

testStockOperations();


