// pos-api/clean-products-customers.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanProductsAndCustomers() {
  try {
    console.log('🧹 Iniciando limpieza de productos y clientes...\n');
    
    // 1. Eliminar todas las ventas
    console.log('🛒 Eliminando ventas...');
    const deletedSales = await prisma.sale.deleteMany({});
    console.log(`   ✅ ${deletedSales.count} ventas eliminadas`);
    
    // 2. Eliminar todos los movimientos de stock relacionados con productos
    console.log('📈 Eliminando movimientos de stock...');
    const deletedMovements = await prisma.stockMovement.deleteMany({});
    console.log(`   ✅ ${deletedMovements.count} movimientos eliminados`);
    
    // 3. Eliminar todos los items de compras
    console.log('📄 Eliminando items de compras...');
    const deletedPurchaseItems = await prisma.purchaseItem.deleteMany({});
    console.log(`   ✅ ${deletedPurchaseItems.count} items de compras eliminados`);
    
    // 4. Eliminar stock
    console.log('📦 Eliminando stock...');
    const deletedStock = await prisma.stock.deleteMany({});
    console.log(`   ✅ ${deletedStock.count} registros de stock eliminados`);
    
    // 5. Eliminar unidades de productos (ProductUnit)
    console.log('🔗 Eliminando unidades de productos...');
    const deletedProductUnits = await prisma.productUnit.deleteMany({});
    console.log(`   ✅ ${deletedProductUnits.count} relaciones producto-unidad eliminadas`);
    
    // 6. Eliminar TODOS los productos
    console.log('📦 Eliminando productos...');
    const deletedProducts = await prisma.product.deleteMany({});
    console.log(`   ✅ ${deletedProducts.count} productos eliminados`);
    
    // 7. Eliminar TODOS los clientes
    console.log('👥 Eliminando clientes...');
    const deletedCustomers = await prisma.customer.deleteMany({});
    console.log(`   ✅ ${deletedCustomers.count} clientes eliminados`);
    
    console.log('\n✅ Limpieza completada exitosamente!');
    console.log('\n📋 Datos eliminados:');
    console.log(`   • Ventas: ${deletedSales.count}`);
    console.log(`   • Productos: ${deletedProducts.count}`);
    console.log(`   • Clientes: ${deletedCustomers.count}`);
    console.log(`   • Stock: ${deletedStock.count}`);
    console.log(`   • Movimientos de stock: ${deletedMovements.count}`);
    console.log(`   • Items de compras: ${deletedPurchaseItems.count}`);
    console.log(`   • Unidades de productos: ${deletedProductUnits.count}`);
    
    console.log('\n🔒 Datos preservados:');
    console.log('   • Usuarios y roles');
    console.log('   • Compras y proveedores');
    console.log('   • Unidades de medida');
    console.log('   • Almacén principal');
    console.log('   • Logs de auditoría');
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
  cleanProductsAndCustomers()
    .then(() => {
      console.log('\n🎉 Proceso completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Error fatal:', error);
      process.exit(1);
    });
}

export { cleanProductsAndCustomers };

