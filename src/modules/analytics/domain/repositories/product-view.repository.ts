import type { ProductView } from '../entities/product-view.entity';
import type {
  CountryViews,
  DailyViews,
  ProductViewGroup,
  ProductWindowCounts,
  ViewTotals,
  VisitorViewGroup,
} from '../product-view-stats';

export const PRODUCT_VIEW_REPOSITORY = Symbol('PRODUCT_VIEW_REPOSITORY');

/** `country` value that selects the visits whose address couldn't be placed. */
export const UNKNOWN_COUNTRY = 'unknown';

export type VisitorKind = 'signed-in' | 'anonymous';

/**
 * Every way the history can be narrowed. All fields combine with AND, and
 * the same filter drives the list, every aggregate and the export, so a
 * chart always describes exactly the rows the table is showing.
 */
export interface ProductViewFilter {
  /** Only visits to this product. */
  productId?: string;
  /** Only visits by this account. */
  userId?: string;
  /** Only visits from this browser. */
  visitorId?: string;
  /**
   * Free text, matched case-insensitively against the product name, the
   * visitor's name and email, the IP address, and the start of the browser id.
   */
  search?: string;
  /** Visits that started at or after this instant. */
  from?: Date;
  /** Visits that started before this instant. */
  to?: Date;
  /** ISO 3166-1 alpha-2, or UNKNOWN_COUNTRY. */
  country?: string;
  visitorKind?: VisitorKind;
  favorited?: boolean;
}

export interface PageWindow {
  skip: number;
  take: number;
}

/**
 * A view as the admin history shows it: the visit itself plus the two things
 * read live at query time rather than stored on the row.
 */
export interface ProductViewListItem {
  view: ProductView;
  /** Null for an anonymous visit, or once the account has been deleted. */
  user: { id: string; name: string; email: string } | null;
  /** Null once the product has been deleted; lets the UI link to it otherwise. */
  productSlug: string | null;
}

export interface ProductViewRepository {
  findById(id: string): Promise<ProductView | null>;
  /** Inserts the view, or updates it if a row with its id already exists. */
  save(view: ProductView): Promise<void>;
  /** Newest visit first. */
  findMany(
    filter: ProductViewFilter & PageWindow,
  ): Promise<ProductViewListItem[]>;
  count(filter: ProductViewFilter): Promise<number>;

  totals(filter: ProductViewFilter): Promise<ViewTotals>;
  /**
   * One entry per calendar day that had a visit, oldest first. Days are the
   * viewer's own: `tzOffsetMinutes` is what `Date#getTimezoneOffset` returns
   * in their browser (minutes to add to local time to get UTC).
   */
  daily(
    filter: ProductViewFilter,
    tzOffsetMinutes: number,
  ): Promise<DailyViews[]>;
  /** Most viewed first. */
  byCountry(filter: ProductViewFilter): Promise<CountryViews[]>;
  /** Most viewed first. */
  groupByProduct(
    filter: ProductViewFilter & PageWindow,
  ): Promise<ProductViewGroup[]>;
  countProducts(filter: ProductViewFilter): Promise<number>;
  /**
   * One entry per person: an account (across all of its browsers), or a
   * browser that never signed in. Most views first.
   */
  groupByVisitor(
    filter: ProductViewFilter & PageWindow,
  ): Promise<VisitorViewGroup[]>;
  countVisitors(filter: ProductViewFilter): Promise<number>;
  /**
   * Per product, the visits in [middle, end) and in [start, middle). Any
   * `from`/`to` on the filter is ignored: the windows are the range.
   */
  productWindows(
    filter: ProductViewFilter,
    windows: { start: Date; middle: Date; end: Date },
  ): Promise<ProductWindowCounts[]>;
}
