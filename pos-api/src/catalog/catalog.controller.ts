import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { ListQueryDto } from './dto/list.dto';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { AddStockDto } from './dto/add-stock.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('catalog')
export class CatalogController {
  constructor(private service: CatalogService) {}

  // ========== LECTURA (Todos pueden leer) ==========
  @Get('products')
  @Roles('ADMIN', 'SELLER')
  listProducts(@Query() q: ListQueryDto) {
    const { page = 1, pageSize = 200, updated_since } = q;
    return this.service.listProducts({ page, pageSize, updated_since });
  }

  @Get('customers')
  @Roles('ADMIN', 'SELLER')
  listCustomers(@Query() q: ListQueryDto) {
    const { page = 1, pageSize = 200, updated_since } = q;
    return this.service.listCustomers({ page, pageSize, updated_since });
  }

  @Get('stock')
  @Roles('ADMIN', 'SELLER')
  getStock(@Query('warehouseId') warehouseId?: string) {
    const warehouse = warehouseId ? parseInt(warehouseId) : 1; // Default warehouse 1
    return this.service.getStock(warehouse);
  }

  @Post('stock/test')
  @Roles('ADMIN')
  async testStock(@Req() req: any) {
    try {
      console.log('🧪 [CONTROLLER] Testing stock operations...');

      // Verificar productos
      const products = await this.service.listProducts({
        page: 1,
        pageSize: 1,
      });
      console.log('📦 Products found:', products.items.length);

      // Verificar stock
      const stock = await this.service.getStock(1);
      console.log('📊 Stock records found:', stock.length);

      // Verificar si el almacén existe
      const warehouse = await this.service.checkWarehouse(1);
      console.log('🏪 Warehouse 1 exists:', warehouse);

      return {
        message: 'Test completed successfully',
        productsCount: products.items.length,
        stockCount: stock.length,
        warehouseExists: warehouse,
        user: req.user,
      };
    } catch (error) {
      console.error('❌ [CONTROLLER] Error in testStock:', error);
      throw error;
    }
  }

  @Post('stock/add')
  @Roles('ADMIN')
  async addStock(@Body() dto: AddStockDto, @Req() req: any) {
    try {
      console.log('📦 [CONTROLLER] Received addStock request:', dto);
      console.log('👤 [CONTROLLER] User:', req.user);

      const result = await this.service.addStock(
        dto.productId,
        dto.quantity,
        dto.warehouseId || 1,
        req.user.id,
      );

      console.log('✅ [CONTROLLER] addStock completed successfully');
      return result;
    } catch (error) {
      console.error('❌ [CONTROLLER] Error in addStock:', error);
      throw error;
    }
  }

  // ========== GESTIÓN DE PRODUCTOS (Solo ADMIN) ==========
  @Post('products')
  @Roles('ADMIN')
  createProduct(@Body() dto: CreateProductDto, @Req() req: any) {
    console.log('🛍️ [CONTROLLER] createProduct called by user:', req.user?.username);
    console.log('🛍️ [CONTROLLER] DTO received:', JSON.stringify(dto, null, 2));
    return this.service.createProduct(dto);
  }

  @Put('products/:id')
  @Roles('ADMIN')
  updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
  ) {
    return this.service.updateProduct(id, dto);
  }

  @Delete('products/:id')
  @Roles('ADMIN')
  deleteProduct(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteProduct(id);
  }

  // ========== GESTIÓN DE CLIENTES (Solo ADMIN) ==========
  @Post('customers')
  @Roles('ADMIN')
  createCustomer(@Body() dto: CreateCustomerDto) {
    return this.service.createCustomer(dto);
  }

  @Put('customers/:id')
  @Roles('ADMIN')
  updateCustomer(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.service.updateCustomer(id, dto);
  }

  @Delete('customers/:id')
  @Roles('ADMIN')
  deleteCustomer(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteCustomer(id);
  }
}
