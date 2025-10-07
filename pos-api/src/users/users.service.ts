import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: {
        username,
        isActive: true, // Solo usuarios activos
      },
      include: { roles: { include: { role: true } } },
    });
  }
}
