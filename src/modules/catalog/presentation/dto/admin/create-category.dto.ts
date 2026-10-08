import { IsOptional, IsString, Matches } from 'class-validator';

const NOT_BLANK = {
  message: (args: { property: string }) => `${args.property} must not be blank`,
};

export class CreateCategoryDto {
  @IsString()
  @Matches(/\S/, NOT_BLANK)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
