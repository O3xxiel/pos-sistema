import { IsNumber, IsPositive, IsOptional, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class AddStockDto {
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @IsPositive()
  productId: number;

  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @IsPositive()
  @Min(1)
  quantity: number;

  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value) : 1))
  @IsNumber()
  @IsPositive()
  warehouseId?: number;
}
