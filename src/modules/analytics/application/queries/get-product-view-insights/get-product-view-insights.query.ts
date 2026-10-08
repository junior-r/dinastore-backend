import type { ProductViewFilter } from '@/modules/analytics/domain/repositories/product-view.repository';

export class GetProductViewInsightsQuery {
  constructor(
    public readonly filter: ProductViewFilter = {},
    /**
     * What `Date#getTimezoneOffset` returns in the viewer's browser, so "a
     * day" on the chart is their calendar day.
     */
    public readonly tzOffsetMinutes: number = 0,
    /** Injectable so tests can pin "today". */
    public readonly now: Date = new Date(),
  ) {}
}
