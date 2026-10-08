import {
  ArrayMinSize,
  ArrayUnique,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
} from 'class-validator';

const NOT_BLANK = {
  message: (args: { property: string }) => `${args.property} must not be blank`,
};

export class UpdateProductDto {
  @IsString()
  @Matches(/\S/, NOT_BLANK)
  name!: string;

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
}
