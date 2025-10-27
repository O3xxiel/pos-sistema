// pos-api/clean-database.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanDatabase() {
  try {
    console.log('🧹 Iniciando limpieza de base de datos...\n');
    
    // 1. Eliminar todas las ventas y sus items
    console.log('📊 Eliminando ventas...');
    const deletedSales = await prisma.sale.deleteMany({});
    console.log(`   ✅ ${deletedSales.count} ventas eliminadas`);
    
    // 2. Eliminar todos los productos y sus unidades
    console.log('📦 Eliminando productos...');
    const deletedProducts = await prisma.product.deleteMany({});
    console.log(`   ✅ ${deletedProducts.count} productos eliminados`);
    
    // 3. Eliminar todos los clientes
    console.log('👥 Eliminando clientes...');
    const deletedCustomers = await prisma.customer.deleteMany({});
    console.log(`   ✅ ${deletedCustomers.count} clientes eliminados`);
    
    // 4. Eliminar movimientos de stock
    console.log('📈 Eliminando movimientos de stock...');
    const deletedMovements = await prisma.stockMovement.deleteMany({});
    console.log(`   ✅ ${deletedMovements.count} movimientos eliminados`);
    
    // 5. Eliminar stock
    console.log('📦 Eliminando stock...');
    const deletedStock = await prisma.stock.deleteMany({});
    console.log(`   ✅ ${deletedStock.count} registros de stock eliminados`);
    
    // 6. Eliminar compras y sus items
    console.log('🛒 Eliminando compras...');
    const deletedPurchases = await prisma.purchase.deleteMany({});
    console.log(`   ✅ ${deletedPurchases.count} compras eliminadas`);
    
    // 7. Eliminar proveedores
    console.log('🏢 Eliminando proveedores...');
    const deletedSuppliers = await prisma.supplier.deleteMany({});
    console.log(`   ✅ ${deletedSuppliers.count} proveedores eliminados`);
    
    // 8. Eliminar logs de auditoría
    console.log('📝 Eliminando logs de auditoría...');
    const deletedAuditLogs = await prisma.auditLog.deleteMany({});
    console.log(`   ✅ ${deletedAuditLogs.count} logs eliminados`);
    
    console.log('\n✅ Limpieza completada exitosamente!');
    console.log('\n📋 Datos eliminados:');
    console.log(`   • Ventas: ${deletedSales.count}`);
    console.log(`   • Productos: ${deletedProducts.count}`);
    console.log(`   • Clientes: ${deletedCustomers.count}`);
    console.log(`   • Movimientos de stock: ${deletedMovements.count}`);
    console.log(`   • Stock: ${deletedStock.count}`);
    console.log(`   • Compras: ${deletedPurchases.count}`);
    console.log(`   • Proveedores: ${deletedSuppliers.count}`);
    console.log(`   • Logs de auditoría: ${deletedAuditLogs.count}`);
    
    console.log('\n🔒 Datos preservados:');
    console.log('   • Usuarios y roles');
    console.log('   • Unidades de medida');
    console.log('   • Almacén principal');
    console.log('   • Estructura de la base de datos');
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
  cleanDatabase()
    .then(() => {
      console.log('\n🎉 Proceso completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Error fatal:', error);
      process.exit(1);
    });
}

export { cleanDatabase };




