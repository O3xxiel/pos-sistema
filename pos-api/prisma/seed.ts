/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import 'dotenv/config'; // <— carga .env si ejecutas ts-node directo
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // 1) Roles (idempotente)
  await prisma.role.createMany({
    data: [
      { code: 'ADMIN', name: 'Administrador' },
      { code: 'SELLER', name: 'Vendedor' },
    ],
    skipDuplicates: true,
  });

  // 2) Leer los roles creados/asegurados
  const [adminRole, sellerRole] = await Promise.all([
    prisma.role.findUnique({ where: { code: 'ADMIN' } }),
    prisma.role.findUnique({ where: { code: 'SELLER' } }),
  ]);
  if (!adminRole || !sellerRole)
    throw new Error('Roles not found after seeding');

  // 3) Admin personalizado (idempotente)
  // NOTA: Cambiar estas credenciales en producción por seguridad
  const adminPasswordHash = await bcrypt.hash('SurtidoraK2025!', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'adminSk' },
    update: {},
    create: {
      username: 'adminSk',
      fullName: 'Administrador Surtidora Katy',
      email: 'admin@surtidorakaty.com',
      passwordHash: adminPasswordHash,
      isActive: true,
    },
  });

  // 4) Vendedor personalizado (idempotente)
  // NOTA: Cambiar estas credenciales en producción por seguridad
  const sellerPasswordHash = await bcrypt.hash('BrayanL2025!', 10);
  const seller = await prisma.user.upsert({
    where: { username: 'brayan' },
    update: {},
    create: {
      username: 'brayan',
      fullName: 'Brayan Lopez',
      email: 'brayan@surtidorakaty.com',
      passwordHash: sellerPasswordHash,
      isActive: true,
    },
  });

  // 5) Enlaces user↔role (idempotente por clave compuesta)
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: seller.id, roleId: sellerRole.id } },
    update: {},
    create: { userId: seller.id, roleId: sellerRole.id },
  });

  // 6) Crear almacén principal (idempotente)
  await prisma.warehouse.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'Almacén Principal',
      location: 'Surtidora Katy',
      isActive: true,
    },
  });

  // 7) Crear unidades básicas (idempotente)
  await prisma.unit.createMany({
    data: [
      { code: 'UND', name: 'Unidad', symbol: 'und', isActive: true },
      { code: 'DOC', name: 'Docena', symbol: 'doc', isActive: true },
      { code: 'CAJ', name: 'Caja', symbol: 'caj', isActive: true },
      { code: 'KG', name: 'Kilogramo', symbol: 'kg', isActive: true },
      { code: 'GR', name: 'Gramo', symbol: 'gr', isActive: true },
      { code: 'LT', name: 'Litro', symbol: 'lt', isActive: true },
      { code: 'ML', name: 'Mililitro', symbol: 'ml', isActive: true },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Seed done:', {
    admin: admin.username,
    seller: seller.username,
    roles: [adminRole.code, sellerRole.code],
    warehouse: 'Created main warehouse (ID: 1)',
    units: 'Created basic units (UND, DOC, CAJ, KG, GR, LT, ML)',
  });
}

main()
  .catch((e) => {
    console.error('SEED ERROR →\n', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
