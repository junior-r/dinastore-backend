import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

const NOT_BLANK = {
  message: (args: { property: string }) => `${args.property} must not be blank`,
};

// One entry per image in the complete desired end-state list -- any
// existing image left out gets deleted (same full-replace semantics as
// UpdateProductVariantsDto). `id` present updates that image's
// position/altText/variant tags in place; absent creates a new row.
// variantIds are real ids here, not create()'s index-based scheme -- an
// edit-mode product always already has real variant ids.
export class UpdateProductImageEntryDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsUrl({ require_tld: false }, NOT_BLANK)
  url!: string;

  @IsOptional()
  @IsString()
  altText?: string;

  @IsInt()
  @Min(0)
  position!: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  variantIds?: string[];
}

export class UpdateProductImagesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateProductImageEntryDto)
  images!: UpdateProductImageEntryDto[];
}
