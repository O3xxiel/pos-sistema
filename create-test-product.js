// Script para crear un producto de prueba con unidades personalizadas
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestProduct() {
  try {
    console.log('🧪 Creando producto de prueba con unidades personalizadas...');

    // 1. Crear unidades personalizadas
    const customUnits = await Promise.all([
      prisma.unit.upsert({
        where: { code: 'BOLSA' },
        update: {},
        create: {
          code: 'BOLSA',
          name: 'Bolsa',
          symbol: 'bolsa',
          isActive: true,
        },
      }),
      prisma.unit.upsert({
        where: { code: 'PAQUETE' },
        update: {},
        create: {
          code: 'PAQUETE',
          name: 'Paquete',
          symbol: 'pkg',
          isActive: true,
        },
      }),
      prisma.unit.upsert({
        where: { code: 'KG' },
        update: {},
        create: {
          code: 'KG',
          name: 'Kilogramo',
          symbol: 'kg',
          isActive: true,
        },
      }),
      prisma.unit.upsert({
        where: { code: 'L' },
        update: {},
        create: {
          code: 'L',
          name: 'Litro',
          symbol: 'L',
          isActive: true,
        },
      }),
      prisma.unit.upsert({
        where: { code: 'M' },
        update: {},
        create: {
          code: 'M',
          name: 'Metro',
          symbol: 'm',
          isActive: true,
        },
      }),
    ]);

    console.log('✅ Unidades personalizadas creadas:', customUnits.map(u => `${u.code} (${u.name})`));

    // 2. Obtener la unidad base UND
    const undUnit = await prisma.unit.findUnique({
      where: { code: 'UND' }
    });

    if (!undUnit) {
      throw new Error('Unidad UND no encontrada');
    }

    // 3. Crear producto de prueba
    const testProduct = await prisma.product.upsert({
      where: { sku: 'TEST-UNITS-001' },
      update: {},
      create: {
        sku: 'TEST-UNITS-001',
        name: 'Producto de Prueba para Unidades',
        barcode: '1234567890123',
        unitBase: 'UND',
        priceBase: 10.00,
        taxRate: 0,
        isActive: true,
        units: {
          create: [
            { unitId: undUnit.id, factor: 1 },           // UND = 1 UND
            { unitId: customUnits[0].id, factor: 30 },   // BOLSA = 30 UND
            { unitId: customUnits[1].id, factor: 6 },    // PAQUETE = 6 UND
            { unitId: customUnits[2].id, factor: 1000 }, // KG = 1000 UND (ejemplo)
            { unitId: customUnits[3].id, factor: 100 },  // L = 100 UND (ejemplo)
            { unitId: customUnits[4].id, factor: 10 },   // M = 10 UND (ejemplo)
          ],
        },
      },
      include: {
        units: {
          include: {
            unit: true
          }
        }
      },
    });

    console.log('✅ Producto de prueba creado:', {
      id: testProduct.id,
      sku: testProduct.sku,
      name: testProduct.name,
      units: testProduct.units.map(u => ({
        code: u.unit.code,
        name: u.unit.name,
        factor: u.factor
      }))
    });

    // 4. Crear stock inicial
    await prisma.stock.upsert({
      where: {
        warehouseId_productId: {
          warehouseId: 1,
          productId: testProduct.id,
        },
      },
      update: { qty: 100 },
      create: {
        warehouseId: 1,
        productId: testProduct.id,
        qty: 100,
      },
    });

    console.log('✅ Stock inicial creado: 100 UND');

    console.log('\n🎉 Producto de prueba creado exitosamente!');
    console.log('📋 Unidades disponibles:');
    testProduct.units.forEach(unit => {
      console.log(`  - ${unit.unit.name} (${unit.unit.code}): ${unit.factor} UND`);
    });

  } catch (error) {
    console.error('❌ Error creando producto de prueba:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestProduct();
