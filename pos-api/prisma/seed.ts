import 'dotenv/config';            // <— carga .env si ejecutas ts-node directo
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // 1) Roles (idempotente)
  await prisma.role.createMany({
    data: [
      { code: 'ADMIN',  name: 'Administrador' },
      { code: 'SELLER', name: 'Vendedor' },
    ],
    skipDuplicates: true,
  });

  // 2) Leer los roles creados/asegurados
  const [adminRole, sellerRole] = await Promise.all([
    prisma.role.findUnique({ where: { code: 'ADMIN'  } }),
    prisma.role.findUnique({ where: { code: 'SELLER' } }),
  ]);
  if (!adminRole || !sellerRole) throw new Error('Roles not found after seeding');

  // 3) Admin (idempotente)
  const passwordHash = await bcrypt.hash('Admin123!', 10);
  const admin = await prisma.user.upsert({
    where:  { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      fullName: 'Administrador General',
      email: 'admin@local',
      passwordHash,
      isActive: true,
    },
  });

  // 4) Enlace user↔role (idempotente por clave compuesta)
  await prisma.userRole.upsert({
    where:  { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });

  console.log('✅ Seed done:', { admin: admin.username, roles: [adminRole.code, sellerRole.code] });
}

main()
  .catch((e) => { console.error('SEED ERROR →\n', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
