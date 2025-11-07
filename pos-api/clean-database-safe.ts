// pos-api/clean-database-safe.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

async function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function getDataCounts() {
  const counts = await Promise.all([
    prisma.sale.count(),
    prisma.product.count(),
    prisma.customer.count(),
    prisma.stockMovement.count(),
    prisma.stock.count(),
    prisma.purchase.count(),
    prisma.supplier.count(),
    prisma.auditLog.count(),
    prisma.user.count(),
    prisma.role.count(),
    prisma.unit.count(),
    prisma.warehouse.count(),
  ]);

  return {
    sales: counts[0],
    products: counts[1],
    customers: counts[2],
    stockMovements: counts[3],
    stock: counts[4],
    purchases: counts[5],
    suppliers: counts[6],
    auditLogs: counts[7],
    users: counts[8],
    roles: counts[9],
    units: counts[10],
    warehouses: counts[11],
  };
}

async function cleanDatabaseSafe() {
  try {
    console.log('🔍 Verificando estado actual de la base de datos...\n');
    
    const counts = await getDataCounts();
    
    console.log('📊 Datos que se ELIMINARÁN:');
    console.log(`   • Ventas: ${counts.sales}`);
    console.log(`   • Productos: ${counts.products}`);
    console.log(`   • Clientes: ${counts.customers}`);
    console.log(`   • Movimientos de stock: ${counts.stockMovements}`);
    console.log(`   • Stock: ${counts.stock}`);
    console.log(`   • Compras: ${counts.purchases}`);
    console.log(`   • Proveedores: ${counts.suppliers}`);
    console.log(`   • Logs de auditoría: ${counts.auditLogs}`);
    
    console.log('\n🔒 Datos que se PRESERVARÁN:');
    console.log(`   • Usuarios: ${counts.users}`);
    console.log(`   • Roles: ${counts.roles}`);
    console.log(`   • Unidades: ${counts.units}`);
    console.log(`   • Almacenes: ${counts.warehouses}`);
    
    const totalToDelete = counts.sales + counts.products + counts.customers + 
                        counts.stockMovements + counts.stock + counts.purchases + 
                        counts.suppliers + counts.auditLogs;
    
    if (totalToDelete === 0) {
      console.log('\n✅ La base de datos ya está limpia. No hay datos para eliminar.');
      return;
    }
    
    console.log(`\n⚠️  TOTAL DE REGISTROS A ELIMINAR: ${totalToDelete}`);
    
    const confirmed = await askConfirmation('\n¿Estás seguro de que quieres proceder con la limpieza?');
    
    if (!confirmed) {
      console.log('\n❌ Operación cancelada por el usuario.');
      return;
    }
    
    console.log('\n🧹 Iniciando limpieza...\n');
    
    // Eliminar en orden correcto para respetar las foreign keys
    const deletedSales = await prisma.sale.deleteMany({});
    console.log(`✅ ${deletedSales.count} ventas eliminadas`);
    
    const deletedProducts = await prisma.product.deleteMany({});
    console.log(`✅ ${deletedProducts.count} productos eliminados`);
    
    const deletedCustomers = await prisma.customer.deleteMany({});
    console.log(`✅ ${deletedCustomers.count} clientes eliminados`);
    
    const deletedMovements = await prisma.stockMovement.deleteMany({});
    console.log(`✅ ${deletedMovements.count} movimientos de stock eliminados`);
    
    const deletedStock = await prisma.stock.deleteMany({});
    console.log(`✅ ${deletedStock.count} registros de stock eliminados`);
    
    const deletedPurchases = await prisma.purchase.deleteMany({});
    console.log(`✅ ${deletedPurchases.count} compras eliminadas`);
    
    const deletedSuppliers = await prisma.supplier.deleteMany({});
    console.log(`✅ ${deletedSuppliers.count} proveedores eliminados`);
    
    const deletedAuditLogs = await prisma.auditLog.deleteMany({});
    console.log(`✅ ${deletedAuditLogs.count} logs de auditoría eliminados`);
    
    console.log('\n🎉 ¡Limpieza completada exitosamente!');
    console.log('\n📋 Resumen:');
    console.log(`   • Total de registros eliminados: ${totalToDelete}`);
    console.log(`   • Usuarios preservados: ${counts.users}`);
    console.log(`   • Roles preservados: ${counts.roles}`);
    console.log(`   • Unidades preservadas: ${counts.units}`);
    console.log(`   • Almacenes preservados: ${counts.warehouses}`);
    
    console.log('\n💡 Próximos pasos:');
    console.log('   1. Ejecutar: pnpm run seed (para crear datos de prueba)');
    console.log('   2. Ejecutar: pnpm run seed:products (para crear productos de prueba)');
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
  cleanDatabaseSafe()
    .then(() => {
      console.log('\n✅ Proceso completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Error fatal:', error);
      process.exit(1);
    });
}

export { cleanDatabaseSafe };











