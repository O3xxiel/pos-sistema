import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateUnitDto {
  @IsString()
  @MaxLength(10)
  code: string;

  @IsString()
  @MaxLength(50)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  symbol?: string;
}

export class UpdateUnitDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  symbol?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AssignUnitToProductDto {
  @IsNumber()
  unitId: number;

  @IsNumber()
  @Min(1)
  factor: number;
}

export class UpdateProductUnitFactorDto {
  @IsNumber()
  @Min(1)
  factor: number;
}
