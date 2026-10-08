import type {
  DailyViews,
  ProductViewGroup,
  VisitorViewGroup,
} from '../product-view-stats';
import type { ProductViewListItem } from '../repositories/product-view.repository';
import type { ViewForecast } from '../view-forecast';

export const PRODUCT_VIEWS_WORKBOOK_PORT = Symbol(
  'PRODUCT_VIEWS_WORKBOOK_PORT',
);

export type WorkbookLanguage = 'en' | 'es';

export interface ProductViewsWorkbookData {
  generatedAt: Date;
  /** For writing instants as the viewer's local date and time. */
  tzOffsetMinutes: number;
  visits: ProductViewListItem[];
  /** How many visits matched; more than `visits.length` when it was capped. */
  totalVisits: number;
  products: ProductViewGroup[];
  visitors: VisitorViewGroup[];
  daily: DailyViews[];
  forecast: ViewForecast;
}

/**
 * Turns the history into a spreadsheet file. The file format is an
 * infrastructure concern; the application only decides what goes in it.
 */
export interface ProductViewsWorkbookPort {
  /** The bytes of an .xlsx file. */
  build(
    data: ProductViewsWorkbookData,
    language: WorkbookLanguage,
  ): Promise<Buffer>;
}

export const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
