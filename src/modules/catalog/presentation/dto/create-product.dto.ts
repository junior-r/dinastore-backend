import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

const NOT_BLANK = {
  message: (args: { property: string }) => `${args.property} must not be blank`,
};

export class CreateProductVariantDto {
  @IsString()
  @Matches(/\S/, NOT_BLANK)
  size!: string;

  @IsString()
  @Matches(/\S/, NOT_BLANK)
  color!: string;

  @IsString()
  @Matches(/\S/, NOT_BLANK)
  sku!: string;

  @IsInt()
  @Min(0)
  stock!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;
}

export class CreateProductImageDto {
  @IsUrl({ require_tld: false }, NOT_BLANK)
  url!: string;

  @IsOptional()
  @IsString()
  altText?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  // Indexes into this request's own `variants` array -- the image applies
  // only to those variants. Omitted/empty means "all variants".
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  variantIndexes?: number[];
}

export class CreateProductDto {
  @IsString()
  @Matches(/\S/, NOT_BLANK)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase, alphanumeric, and hyphen-separated',
  })
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(0)
  basePriceCents!: number;

  @IsString()
  @Length(3, 3)
  currency!: string;

  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  categoryIds!: string[];

  @IsOptional()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants?: CreateProductVariantDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductImageDto)
  images?: CreateProductImageDto[];
}
