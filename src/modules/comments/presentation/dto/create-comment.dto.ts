import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @Length(1, 1000)
  body!: string;

  /** Omit for a root comment; the comment being replied to otherwise. */
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
