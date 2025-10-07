// pos-api/prisma/seed-products.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1) Crear almacén por defecto
  const warehouse = await prisma.warehouse.upsert({
    where: { code: 'MAIN' },
    update: {},
    create: {
      code: 'MAIN',
      name: 'Almacén Principal',
      isActive: true,
    },
  });

  // 2) Crear unidades estándar
  const units = await Promise.all([
    prisma.unit.upsert({
      where: { code: 'UND' },
      update: {},
      create: {
        code: 'UND',
        name: 'Unidad',
        symbol: 'und',
        isActive: true,
      },
    }),
    prisma.unit.upsert({
      where: { code: 'DOC' },
      update: {},
      create: {
        code: 'DOC',
        name: 'Docena',
        symbol: 'doc',
        isActive: true,
      },
    }),
    prisma.unit.upsert({
      where: { code: 'CAJ' },
      update: {},
      create: {
        code: 'CAJ',
        name: 'Caja',
        symbol: 'caj',
        isActive: true,
      },
    }),
  ]);

  // 3) Crear algunos clientes de prueba
  const customers = await Promise.all([
    prisma.customer.upsert({
      where: { code: 'C001' },
      update: {},
      create: {
        code: 'C001',
        name: 'Juan Pérez',
        nit: '12345678-9',
        phone: '2234-5678',
        address: 'Ciudad de Guatemala',
        isActive: true,
      },
    }),
    prisma.customer.upsert({
      where: { code: 'C002' },
      update: {},
      create: {
        code: 'C002',
        name: 'María López',
        nit: '87654321-0',
        phone: '5555-1234',
        address: 'Mixco, Guatemala',
        isActive: true,
      },
    }),
    prisma.customer.upsert({
      where: { code: 'CF' },
      update: {},
      create: {
        code: 'CF',
        name: 'Consumidor Final',
        nit: 'CF',
        phone: null,
        address: null,
        isActive: true,
      },
    }),
  ]);

  // 4) Crear productos de prueba
  const products = await Promise.all([
    prisma.product.upsert({
      where: { sku: 'PROD001' },
      update: {},
      create: {
        sku: 'PROD001',
        name: 'Coca Cola 600ml',
        barcode: '7501055300013',
        unitBase: 'UND',
        priceBase: 8.50,
        taxRate: 0,
        isActive: true,
        units: {
          create: [
            { unitId: units[0].id, factor: 1 }, // UND
            { unitId: units[1].id, factor: 12 }, // DOC
            { unitId: units[2].id, factor: 24 }, // CAJ
          ],
        },
      },
    }),
    prisma.product.upsert({
      where: { sku: 'PROD002' },
      update: {},
      create: {
        sku: 'PROD002',
        name: 'Pan Dulce Bimbo',
        barcode: '7501000100015',
        unitBase: 'UND',
        priceBase: 3.25,
        taxRate: 0,
        isActive: true,
        units: {
          create: [
            { unitId: units[0].id, factor: 1 }, // UND
            { unitId: units[1].id, factor: 12 }, // DOC
          ],
        },
      },
    }),
    prisma.product.upsert({
      where: { sku: 'PROD003' },
      update: {},
      create: {
        sku: 'PROD003',
        name: 'Leche Dos Pinos 1L',
        barcode: '7441001000016',
        unitBase: 'UND',
        priceBase: 12.75,
        taxRate: 0,
        isActive: true,
        units: {
          create: [
            { unitId: units[0].id, factor: 1 }, // UND
            { unitId: units[1].id, factor: 12 }, // DOC
          ],
        },
      },
    }),
    prisma.product.upsert({
      where: { sku: 'PROD004' },
      update: {},
      create: {
        sku: 'PROD004',
        name: 'Arroz San Francisco 1 lb',
        barcode: '7501234567890',
        unitBase: 'UND',
        priceBase: 4.50,
        taxRate: 0,
        isActive: true,
        units: {
          create: [
            { unitId: units[0].id, factor: 1 }, // UND
            { unitId: units[1].id, factor: 24 }, // DOC
            { unitId: units[2].id, factor: 48 }, // CAJ
          ],
        },
      },
    }),
    prisma.product.upsert({
      where: { sku: 'PROD005' },
      update: {},
      create: {
        sku: 'PROD005',
        name: 'Aceite Capullo 1L',
        barcode: '7501098765432',
        unitBase: 'UND',
        priceBase: 18.25,
        taxRate: 0,
        isActive: true,
        units: {
          create: [
            { unitId: units[0].id, factor: 1 }, // UND
            { unitId: units[1].id, factor: 12 }, // DOC
          ],
        },
      },
    }),
  ]);

  // 5) Crear stock inicial
  const stockData = [
    { productId: products[0].id, qty: 150 }, // Coca Cola
    { productId: products[1].id, qty: 85 },  // Pan Dulce
    { productId: products[2].id, qty: 0 },   // Leche (sin stock)
    { productId: products[3].id, qty: 200 }, // Arroz
    { productId: products[4].id, qty: 45 },  // Aceite
  ];

  await Promise.all(
    stockData.map(({ productId, qty }) =>
      prisma.stock.upsert({
        where: {
          warehouseId_productId: {
            warehouseId: warehouse.id,
            productId,
          },
        },
        update: { qty },
        create: {
          warehouseId: warehouse.id,
          productId,
          qty,
        },
      })
    )
  );

  console.log('✅ Products and stock seeded:', {
    warehouse: warehouse.name,
    customers: customers.length,
    products: products.length,
    stock: stockData.length,
  });
}

main()
  .catch((e) => {
    console.error('SEED PRODUCTS ERROR →\n', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());






