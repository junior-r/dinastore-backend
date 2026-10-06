import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const NOT_BLANK = {
  message: (args: { property: string }) => `${args.property} must not be blank`,
};

// One entry per variant in the *complete* desired end-state list -- any
// existing variant left out gets deleted (same semantics as categoryIds).
// `id` present updates that variant's stock/price only -- size/color/sku
// are locked once created (see UpdateVariantsEntry in product.entity.ts),
// so those three fields are only required/accepted when `id` is absent.
export class UpdateProductVariantEntryDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @ValidateIf((entry: UpdateProductVariantEntryDto) => !entry.id)
  @IsString()
  @Matches(/\S/, NOT_BLANK)
  size?: string;

  @ValidateIf((entry: UpdateProductVariantEntryDto) => !entry.id)
  @IsString()
  @Matches(/\S/, NOT_BLANK)
  color?: string;

  @ValidateIf((entry: UpdateProductVariantEntryDto) => !entry.id)
  @IsString()
  @Matches(/\S/, NOT_BLANK)
  sku?: string;

  @IsInt()
  @Min(0)
  stock!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;
}

export class UpdateProductVariantsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateProductVariantEntryDto)
  variants!: UpdateProductVariantEntryDto[];
}
