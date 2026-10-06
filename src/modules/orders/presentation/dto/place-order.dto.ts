import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PLACEMENT_WIDTH } from '@/modules/orders/domain/design-placement';

export class DesignPlacementDto {
  @IsNumber()
  @Min(0)
  @Max(1)
  x!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  y!: number;

  @IsNumber()
  @Min(PLACEMENT_WIDTH.min)
  @Max(PLACEMENT_WIDTH.max)
  width!: number;
}

export class OrderItemCustomizationDto {
  @IsUUID()
  designId!: string;

  @ValidateNested()
  @Type(() => DesignPlacementDto)
  placement!: DesignPlacementDto;
}

export class PlaceOrderItemDto {
  @IsUUID()
  productVariantId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => OrderItemCustomizationDto)
  customization?: OrderItemCustomizationDto;
}

export class PlaceOrderDto {
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PlaceOrderItemDto)
  items!: PlaceOrderItemDto[];
}
