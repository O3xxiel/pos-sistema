import {
  IsArray,
  IsString,
  IsNumber,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SyncSaleItemDto {
  @IsString()
  id: string; // UUID local del item

  @IsNumber()
  productId: number;

  @IsString()
  productSku: string;

  @IsString()
  productName: string;

  @IsString()
  unitCode: string; // 'UND' | 'DOC' | 'CAJ'

  @IsNumber()
  unitFactor: number;

  @IsNumber()
  qty: number;

  @IsNumber()
  qtyBase: number;

  @IsNumber()
  priceUnit: number;

  @IsNumber()
  discount: number;

  @IsNumber()
  lineTotal: number;
}

export class SyncSaleDto {
  @IsString()
  id: string; // UUID de la venta offline

  @IsNumber()
  customerId: number;

  @IsNumber()
  warehouseId: number;

  @IsNumber()
  sellerId: number;

  @IsNumber()
  subtotal: number;

  @IsNumber()
  taxTotal: number;

  @IsNumber()
  grandTotal: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncSaleItemDto)
  items: SyncSaleItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsString()
  createdAt: string; // ISO string
}

export class SyncSalesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncSaleDto)
  sales: SyncSaleDto[];
}
