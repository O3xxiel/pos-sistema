import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class SaleItemDto {
  @Transform(({ value }) => Number(value))
  @IsNumber()
  productId: number;

  @IsString()
  unitCode: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  qty: number;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  qtyBase: number;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  priceUnit: number;

  @Transform(({ value }) => Number(value) || 0)
  @IsNumber()
  @IsOptional()
  discount?: number;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  lineTotal: number;
}

export class ConfirmSaleDto {
  @Transform(({ value }) => Number(value))
  @IsNumber()
  customerId: number;

  @Transform(({ value }) => Number(value) || 1)
  @IsNumber()
  @IsOptional()
  warehouseId?: number; // Default: 1

  @Transform(({ value }) => Number(value))
  @IsNumber()
  sellerId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  @Transform(({ value }) => Number(value))
  @IsNumber()
  subtotal: number;

  @Transform(({ value }) => Number(value) || 0)
  @IsNumber()
  @IsOptional()
  taxTotal?: number; // Default: 0

  @Transform(({ value }) => Number(value))
  @IsNumber()
  grandTotal: number;

  @IsString()
  @IsOptional()
  uuid?: string; // Para idempotencia
}
