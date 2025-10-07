import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding roles and admin user...');

  // Crear roles
  const adminRole = await prisma.role.upsert({
    where: { code: 'ADMIN' },
    update: {},
    create: {
      code: 'ADMIN',
      name: 'Administrador'
    }
  });

  const sellerRole = await prisma.role.upsert({
    where: { code: 'SELLER' },
    update: {},
    create: {
      code: 'SELLER',
      name: 'Vendedor'
    }
  });

  console.log('✅ Roles creados:', { adminRole, sellerRole });

  // Crear usuario administrador si no existe
  const existingAdmin = await prisma.user.findUnique({
    where: { username: 'admin' }
  });

  if (!existingAdmin) {
    const adminPassword = await bcrypt.hash('Admin123!', 10);
    
    const adminUser = await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash: adminPassword,
        fullName: 'Administrador del Sistema',
        email: 'admin@surtidorakaty.com',
        isActive: true,
        roles: {
          create: {
            roleId: adminRole.id
          }
        }
      }
    });

    console.log('✅ Usuario administrador creado:', adminUser);
  } else {
    console.log('ℹ️ Usuario administrador ya existe');
  }

  // Crear algunos vendedores de ejemplo
  const existingSellers = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          role: {
            code: 'SELLER'
          }
        }
      }
    }
  });

  if (existingSellers.length === 0) {
    const sellerPassword = await bcrypt.hash('Vendedor123!', 10);
    
    const sellers = [
      {
        username: 'vendedor1',
        fullName: 'María González',
        email: 'maria@surtidorakaty.com',
        employeeCode: 'V001'
      },
      {
        username: 'vendedor2',
        fullName: 'Carlos López',
        email: 'carlos@surtidorakaty.com',
        employeeCode: 'V002'
      },
      {
        username: 'vendedor3',
        fullName: 'Ana Martínez',
        email: 'ana@surtidorakaty.com',
        employeeCode: 'V003'
      }
    ];

    for (const sellerData of sellers) {
      const seller = await prisma.user.create({
        data: {
          username: sellerData.username,
          passwordHash: sellerPassword,
          fullName: sellerData.fullName,
          email: sellerData.email,
          isActive: true,
          roles: {
            create: {
              roleId: sellerRole.id
            }
          }
        }
      });

      console.log('✅ Vendedor creado:', seller);
    }
  } else {
    console.log('ℹ️ Vendedores ya existen');
  }

  console.log('🎉 Seeding completado!');
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
