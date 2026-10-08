import type { WorkbookLanguage } from '@/modules/analytics/domain/ports/product-views-workbook.port';
import type { ProductViewFilter } from '@/modules/analytics/domain/repositories/product-view.repository';

export class ExportProductViewsQuery {
  constructor(
    public readonly filter: ProductViewFilter = {},
    public readonly tzOffsetMinutes: number = 0,
    public readonly language: WorkbookLanguage = 'en',
    public readonly now: Date = new Date(),
  ) {}
}
