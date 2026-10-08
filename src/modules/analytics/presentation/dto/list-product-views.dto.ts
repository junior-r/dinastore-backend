import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { UNKNOWN_COUNTRY } from '@/modules/analytics/domain/repositories/product-view.repository';
import type {
  ProductViewFilter,
  VisitorKind,
} from '@/modules/analytics/domain/repositories/product-view.repository';

/**
 * The filters every product-view route accepts. Kept in one class so the
 * list, the grouped lists, the insights and the export can never drift apart
 * on what a query string means.
 */
export class ProductViewFilterDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  visitorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /** Visits that started at or after this instant. */
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  /** Visits that started before this instant. */
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  /** Two-letter country code, or "unknown" for visits that couldn't be placed. */
  @IsOptional()
  @Matches(new RegExp(`^([A-Z]{2}|${UNKNOWN_COUNTRY})$`), {
    message: `country must be a two-letter code or "${UNKNOWN_COUNTRY}"`,
  })
  country?: string;

  @IsOptional()
  @IsIn(['signed-in', 'anonymous'])
  visitor?: VisitorKind;

  // A string rather than a boolean: every query-string value arrives as text,
  // and implicit conversion would turn "false" into `true`.
  @IsOptional()
  @IsIn(['true', 'false'])
  favorited?: 'true' | 'false';

  toFilter(): ProductViewFilter {
    return {
      productId: this.productId,
      userId: this.userId,
      visitorId: this.visitorId,
      search: this.search?.trim() || undefined,
      from: this.from ? new Date(this.from) : undefined,
      to: this.to ? new Date(this.to) : undefined,
      country: this.country,
      visitorKind: this.visitor,
      favorited:
        this.favorited === undefined ? undefined : this.favorited === 'true',
    };
  }
}

export class ListProductViewsDto extends ProductViewFilterDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}

// Real offsets run from UTC-12 to UTC+14; `getTimezoneOffset` has the
// opposite sign, hence -840..720.
const MIN_TZ_OFFSET = -840;
const MAX_TZ_OFFSET = 720;

export class ProductViewInsightsDto extends ProductViewFilterDto {
  /** `new Date().getTimezoneOffset()` from the browser. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_TZ_OFFSET)
  @Max(MAX_TZ_OFFSET)
  tzOffset: number = 0;
}

export class ExportProductViewsDto extends ProductViewInsightsDto {
  /** Language of the sheet names and column headers. */
  @IsOptional()
  @IsIn(['en', 'es'])
  lang: 'en' | 'es' = 'en';
}
