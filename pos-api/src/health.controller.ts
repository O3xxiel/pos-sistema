import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller()
export class HealthController {
  constructor(private prisma: PrismaService) {}
  @Get('health')
  async health() {
    const now = await this.prisma.$queryRaw`SELECT NOW()`;
    return { ok: true, db: 'up', now };
  }
}
