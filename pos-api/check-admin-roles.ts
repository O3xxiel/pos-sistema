import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAdminRoles() {
  try {
    console.log('🔍 Verificando roles del admin...\n');
    
    const admin = await prisma.user.findUnique({
      where: { username: 'admin' },
      select: {
        id: true,
        username: true,
        fullName: true,
        roles: {
          select: {
            role: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });
    
    if (admin) {
      console.log(`👤 Admin: ${admin.fullName} (${admin.username}) - ID: ${admin.id}`);
      console.log('   Roles:');
      admin.roles.forEach((userRole, index) => {
        console.log(`     ${index + 1}. ${userRole.role.name} (${userRole.role.code})`);
      });
      
      // Verificar si tiene rol SELLER
      const hasSellerRole = admin.roles.some(role => role.role.code === 'SELLER');
      console.log(`\n   ¿Tiene rol SELLER?: ${hasSellerRole}`);
      
      if (hasSellerRole) {
        console.log('   ❌ PROBLEMA: El admin tiene rol SELLER, no debería tenerlo');
      } else {
        console.log('   ✅ OK: El admin no tiene rol SELLER');
      }
    } else {
      console.log('❌ Admin no encontrado');
    }
    
    // Verificar consulta de vendedores
    console.log('\n🔍 Consulta de vendedores:');
    const sellers = await prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: {
              code: 'SELLER',
            },
          },
        },
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        roles: {
          select: {
            role: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });
    
    console.log(`   Vendedores encontrados: ${sellers.length}`);
    sellers.forEach((seller, index) => {
      console.log(`   ${index + 1}. ${seller.fullName} (${seller.username}) - ID: ${seller.id}`);
      seller.roles.forEach((userRole, roleIndex) => {
        console.log(`      - ${userRole.role.name} (${userRole.role.code})`);
      });
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdminRoles();






