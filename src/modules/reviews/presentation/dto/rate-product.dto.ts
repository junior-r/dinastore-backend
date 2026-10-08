import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  MAX_RATING,
  MAX_REVIEW_BODY_LENGTH,
  MIN_RATING,
} from '@/modules/reviews/domain/entities/review.entity';

export class RateProductDto {
  @IsInt()
  @Min(MIN_RATING)
  @Max(MAX_RATING)
  rating!: number;

  /** Omit, send null, or send an empty string for a rating with no comment. */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_REVIEW_BODY_LENGTH)
  body?: string | null;
}
