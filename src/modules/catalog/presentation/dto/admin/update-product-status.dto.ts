import { IsEnum } from 'class-validator';
import { ProductStatus } from '@/modules/catalog/domain/entities/product.entity';

export class UpdateProductStatusDto {
  @IsEnum(ProductStatus)
  status!: ProductStatus;
}
