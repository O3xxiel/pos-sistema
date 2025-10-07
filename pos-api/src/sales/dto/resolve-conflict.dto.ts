// pos-api/src/sales/dto/resolve-conflict.dto.ts
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsPositive,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum ConflictAction {
  EDIT_QUANTITIES = 'EDIT_QUANTITIES',
  CANCEL = 'CANCEL',
}

export class EditItemDto {
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @IsPositive()
  id: number;

  @IsOptional()
  @Transform(({ value }) =>
    value !== undefined ? parseFloat(value) : undefined,
  )
  @IsNumber()
  newQty?: number;

  @IsOptional()
  @Transform(({ value }) =>
    value !== undefined ? parseFloat(value) : undefined,
  )
  @IsNumber()
  newQtyBase?: number;
}

export class ResolveConflictDto {
  @IsEnum(ConflictAction)
  action: ConflictAction;

  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @IsPositive()
  saleId: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EditItemDto)
  items?: EditItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
