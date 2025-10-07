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

  console.log('✅ Seed done:', {
    admin: admin.username,
    seller: seller.username,
    roles: [adminRole.code, sellerRole.code],
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
