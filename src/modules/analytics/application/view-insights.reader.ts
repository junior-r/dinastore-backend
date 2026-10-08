import { Inject, Injectable } from '@nestjs/common';
import {
  addDays,
  fillDays,
  localDay,
  startOfLocalDay,
} from '@/modules/analytics/domain/product-view-stats';
import type {
  CountryViews,
  DailyViews,
  ProductViewGroup,
  ViewTotals,
} from '@/modules/analytics/domain/product-view-stats';
import { PRODUCT_VIEW_REPOSITORY } from '@/modules/analytics/domain/repositories/product-view.repository';
import type {
  ProductViewFilter,
  ProductViewRepository,
} from '@/modules/analytics/domain/repositories/product-view.repository';
import {
  FORECAST_HISTORY_DAYS,
  FORECAST_HORIZON_DAYS,
  forecastViews,
  rankMomentum,
} from '@/modules/analytics/domain/view-forecast';
import type {
  ProductMomentum,
  ViewForecast,
} from '@/modules/analytics/domain/view-forecast';

/** Longest daily series returned for charting. */
export const MAX_CHART_DAYS = 90;
/** Days charted when the filter has no start date. */
const DEFAULT_CHART_DAYS = 30;
const TOP_PRODUCTS = 8;
const TOP_MOVERS = 5;
const MS_PER_DAY = 86_400_000;

export interface ViewInsights {
  totals: ViewTotals & {
    /** Mean visible time per visit. Zero when there are no visits. */
    avgDurationMs: number;
    /** Share of visits where the product was a favorite, 0..1. */
    favoriteRate: number;
  };
  /** One entry per day, oldest first, zero-filled. At most MAX_CHART_DAYS. */
  daily: DailyViews[];
  /** Most viewed first, at most TOP_PRODUCTS. */
  topProducts: ProductViewGroup[];
  /** Every country seen, most viewed first. */
  countries: CountryViews[];
  /** Next week's daily views, from the recent history. */
  forecast: ViewForecast;
  /** Products ranked by where their views are heading. */
  movers: ProductMomentum[];
}

/**
 * Assembles everything the admin page charts from one filter. Shared by the
 * insights query and the export, so the spreadsheet holds the same numbers
 * the screen showed.
 */
@Injectable()
export class ViewInsightsReader {
  constructor(
    @Inject(PRODUCT_VIEW_REPOSITORY)
    private readonly viewRepository: ProductViewRepository,
  ) {}

  async read(
    filter: ProductViewFilter,
    tzOffsetMinutes: number,
    now: Date,
  ): Promise<ViewInsights> {
    const today = localDay(now, tzOffsetMinutes);
    const chart = chartWindow(filter, tzOffsetMinutes, today);

    // The forecast and the movers describe what happens next, so they always
    // read the most recent weeks: the date range picked for the charts would
    // otherwise have them "predict" from an arbitrary slice of the past. Every
    // other filter still applies, which is what makes a forecast for one
    // product or one country possible.
    const undated: ProductViewFilter = {
      ...filter,
      from: undefined,
      to: undefined,
    };
    const historyFirstDay = addDays(today, -FORECAST_HISTORY_DAYS);
    const historyLastDay = addDays(today, -1);
    const momentumEnd = now;
    const momentumMiddle = new Date(
      now.getTime() - FORECAST_HORIZON_DAYS * MS_PER_DAY,
    );
    const momentumStart = new Date(
      now.getTime() - 2 * FORECAST_HORIZON_DAYS * MS_PER_DAY,
    );

    const [totals, chartDays, topProducts, countries, historyDays, windows] =
      await Promise.all([
        this.viewRepository.totals(filter),
        this.viewRepository.daily(
          {
            ...filter,
            from: startOfLocalDay(chart.firstDay, tzOffsetMinutes),
            to: startOfLocalDay(addDays(chart.lastDay, 1), tzOffsetMinutes),
          },
          tzOffsetMinutes,
        ),
        this.viewRepository.groupByProduct({
          ...filter,
          skip: 0,
          take: TOP_PRODUCTS,
        }),
        this.viewRepository.byCountry(filter),
        this.viewRepository.daily(
          {
            ...undated,
            from: startOfLocalDay(historyFirstDay, tzOffsetMinutes),
            // Up to, not including, today: a day still in progress would
            // read as a drop.
            to: startOfLocalDay(today, tzOffsetMinutes),
          },
          tzOffsetMinutes,
        ),
        this.viewRepository.productWindows(undated, {
          start: momentumStart,
          middle: momentumMiddle,
          end: momentumEnd,
        }),
      ]);

    return {
      totals: {
        ...totals,
        avgDurationMs:
          totals.views === 0
            ? 0
            : Math.round(totals.totalDurationMs / totals.views),
        favoriteRate: totals.views === 0 ? 0 : totals.favorites / totals.views,
      },
      daily: fillDays(chartDays, chart.firstDay, chart.lastDay),
      topProducts,
      countries,
      forecast: forecastViews(
        fillDays(historyDays, historyFirstDay, historyLastDay),
      ),
      movers: rankMomentum(windows, TOP_MOVERS),
    };
  }
}

/**
 * The days the daily chart covers: the filter's own range when it has one,
 * otherwise the last DEFAULT_CHART_DAYS, and never more than MAX_CHART_DAYS
 * (the most recent ones win) or past today.
 */
function chartWindow(
  filter: ProductViewFilter,
  tzOffsetMinutes: number,
  today: string,
): { firstDay: string; lastDay: string } {
  // `to` is exclusive, so the last day shown is the one just before it.
  const requestedLast = filter.to
    ? localDay(new Date(filter.to.getTime() - 1), tzOffsetMinutes)
    : today;
  const lastDay = requestedLast > today ? today : requestedLast;

  const earliest = addDays(lastDay, -(MAX_CHART_DAYS - 1));
  const requestedFirst = filter.from
    ? localDay(filter.from, tzOffsetMinutes)
    : addDays(lastDay, -(DEFAULT_CHART_DAYS - 1));
  const firstDay = requestedFirst < earliest ? earliest : requestedFirst;

  return { firstDay: firstDay > lastDay ? lastDay : firstDay, lastDay };
}
