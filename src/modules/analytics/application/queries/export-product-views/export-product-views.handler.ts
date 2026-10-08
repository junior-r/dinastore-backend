import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ViewInsightsReader } from '@/modules/analytics/application/view-insights.reader';
import { PRODUCT_VIEWS_WORKBOOK_PORT } from '@/modules/analytics/domain/ports/product-views-workbook.port';
import type { ProductViewsWorkbookPort } from '@/modules/analytics/domain/ports/product-views-workbook.port';
import { PRODUCT_VIEW_REPOSITORY } from '@/modules/analytics/domain/repositories/product-view.repository';
import type { ProductViewRepository } from '@/modules/analytics/domain/repositories/product-view.repository';
import { ExportProductViewsQuery } from './export-product-views.query';

/**
 * Most visits written to one file. Past this the file says it was cut short
 * (newest kept) rather than growing without bound: the whole workbook is
 * built in memory.
 */
export const MAX_EXPORTED_VISITS = 20_000;
/** Most rows on the per-product and per-visitor sheets. */
export const MAX_EXPORTED_GROUPS = 5_000;

@QueryHandler(ExportProductViewsQuery)
export class ExportProductViewsHandler implements IQueryHandler<
  ExportProductViewsQuery,
  Buffer
> {
  constructor(
    @Inject(PRODUCT_VIEW_REPOSITORY)
    private readonly viewRepository: ProductViewRepository,
    @Inject(PRODUCT_VIEWS_WORKBOOK_PORT)
    private readonly workbook: ProductViewsWorkbookPort,
    private readonly insights: ViewInsightsReader,
  ) {}

  async execute(query: ExportProductViewsQuery): Promise<Buffer> {
    const { filter } = query;

    const [visits, totalVisits, products, visitors, insights] =
      await Promise.all([
        this.viewRepository.findMany({
          ...filter,
          skip: 0,
          take: MAX_EXPORTED_VISITS,
        }),
        this.viewRepository.count(filter),
        this.viewRepository.groupByProduct({
          ...filter,
          skip: 0,
          take: MAX_EXPORTED_GROUPS,
        }),
        this.viewRepository.groupByVisitor({
          ...filter,
          skip: 0,
          take: MAX_EXPORTED_GROUPS,
        }),
        this.insights.read(filter, query.tzOffsetMinutes, query.now),
      ]);

    return this.workbook.build(
      {
        generatedAt: query.now,
        tzOffsetMinutes: query.tzOffsetMinutes,
        visits,
        totalVisits,
        products,
        visitors,
        daily: insights.daily,
        forecast: insights.forecast,
      },
      query.language,
    );
  }
}
