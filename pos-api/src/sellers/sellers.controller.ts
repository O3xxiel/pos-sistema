import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SellersService } from './sellers.service';
import { CreateSellerDto, UpdateSellerDto } from './dto/seller.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('sellers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

  @Get()
  @Roles('ADMIN') // Solo administradores pueden ver la lista de vendedores
  async getAllSellers(@Query('active') active?: boolean) {
    return await this.sellersService.findAll(active);
  }

  @Get('me')
  @Roles('SELLER') // Vendedores pueden ver su propia información
  async getMyProfile(@Req() req: any) {
    return await this.sellersService.findOne(req.user.id);
  }

  @Get(':id')
  @Roles('ADMIN', 'SELLER')
  async getSeller(@Param('id') id: string, @Req() req: any) {
    // Si es vendedor, solo puede ver su propia información
    if (req.user.roles.includes('SELLER') && +id !== req.user.id) {
      throw new Error('No tienes permisos para ver este vendedor');
    }
    return await this.sellersService.findOne(+id);
  }

  @Post()
  @Roles('ADMIN') // Solo administradores pueden crear vendedores
  async createSeller(@Body() createSellerDto: CreateSellerDto) {
    return await this.sellersService.create(createSellerDto);
  }

  @Put(':id')
  @Roles('ADMIN', 'SELLER')
  async updateSeller(
    @Param('id') id: string,
    @Body() updateSellerDto: UpdateSellerDto,
    @Req() req: any,
  ) {
    // Si es vendedor, solo puede actualizar su propia información
    if (req.user.roles.includes('SELLER') && +id !== req.user.id) {
      throw new Error('No tienes permisos para actualizar este vendedor');
    }
    return await this.sellersService.update(+id, updateSellerDto);
  }

  @Delete(':id')
  @Roles('ADMIN') // Solo administradores pueden eliminar vendedores
  async deleteSeller(@Param('id') id: string) {
    return await this.sellersService.remove(+id);
  }

  @Get(':id/stats')
  @Roles('ADMIN', 'SELLER')
  async getSellerStats(
    @Param('id') id: string,
    @Req() req: any,
    @Query('date') date?: string,
  ) {
    // Si es vendedor, solo puede ver sus propias estadísticas
    if (req.user.roles.includes('SELLER') && +id !== req.user.id) {
      throw new Error(
        'No tienes permisos para ver las estadísticas de este vendedor',
      );
    }
    return await this.sellersService.getStats(+id, date);
  }
}
