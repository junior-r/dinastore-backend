import { IsOptional, IsString, Matches } from 'class-validator';

const NOT_BLANK = {
  message: (args: { property: string }) => `${args.property} must not be blank`,
};

export class UpdateCategoryDto {
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
}
