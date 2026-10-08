import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ViewInsightsReader } from '@/modules/analytics/application/view-insights.reader';
import type { ViewInsights } from '@/modules/analytics/application/view-insights.reader';
import { GetProductViewInsightsQuery } from './get-product-view-insights.query';

@QueryHandler(GetProductViewInsightsQuery)
export class GetProductViewInsightsHandler implements IQueryHandler<
  GetProductViewInsightsQuery,
  ViewInsights
> {
  constructor(private readonly insights: ViewInsightsReader) {}

  execute(query: GetProductViewInsightsQuery): Promise<ViewInsights> {
    return this.insights.read(query.filter, query.tzOffsetMinutes, query.now);
  }
}
