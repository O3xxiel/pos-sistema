import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';

@Controller('debug')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class DebugController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('users')
  @Roles('ADMIN')
  async getAllUsers() {
    return await this.prisma.user.findMany({
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  @Get('users/:username')
  @Roles('ADMIN')
  async getUserByUsername(@Param('username') username: string) {
    return await this.prisma.user.findUnique({
      where: { username },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  @Get('roles')
  @Roles('ADMIN')
  async getAllRoles() {
    return await this.prisma.role.findMany();
  }
}
