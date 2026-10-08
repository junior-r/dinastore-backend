import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import type { Worksheet } from 'exceljs';
import type {
  ProductViewsWorkbookData,
  ProductViewsWorkbookPort,
  WorkbookLanguage,
} from '@/modules/analytics/domain/ports/product-views-workbook.port';

interface Labels {
  sheets: {
    visits: string;
    products: string;
    visitors: string;
    daily: string;
  };
  product: string;
  visitor: string;
  email: string;
  browserId: string;
  country: string;
  ipAddress: string;
  secondsWatched: string;
  avgSecondsWatched: string;
  favorite: string;
  favorites: string;
  started: string;
  lastViewed: string;
  views: string;
  uniqueVisitors: string;
  productsViewed: string;
  day: string;
  kind: string;
  recorded: string;
  forecast: string;
  expected: string;
  low: string;
  high: string;
  yes: string;
  no: string;
  anonymous: string;
  deleted: string;
  truncated: (shown: number, total: number) => string;
  noForecast: (have: number, need: number) => string;
}

const LABELS: Record<WorkbookLanguage, Labels> = {
  en: {
    sheets: {
      visits: 'Visits',
      products: 'By product',
      visitors: 'By visitor',
      daily: 'Daily',
    },
    product: 'Product',
    visitor: 'Visitor',
    email: 'Email',
    browserId: 'Browser id',
    country: 'Country',
    ipAddress: 'IP address',
    secondsWatched: 'Time watched (s)',
    avgSecondsWatched: 'Average time per visit (s)',
    favorite: 'Favorite',
    favorites: 'Visits with favorite',
    started: 'Started',
    lastViewed: 'Last visit',
    views: 'Views',
    uniqueVisitors: 'Unique visitors',
    productsViewed: 'Products viewed',
    day: 'Day',
    kind: 'Type',
    recorded: 'Recorded',
    forecast: 'Forecast',
    expected: 'Expected views',
    low: 'Low estimate',
    high: 'High estimate',
    yes: 'Yes',
    no: 'No',
    anonymous: 'Not signed in',
    deleted: '(product deleted)',
    truncated: (shown, total) =>
      `Showing the ${shown} most recent of ${total} visits. Narrow the filters to export the rest.`,
    noForecast: (have, need) =>
      `No forecast yet: ${have} of the ${need} days of history it needs.`,
  },
  es: {
    sheets: {
      visits: 'Visitas',
      products: 'Por producto',
      visitors: 'Por visitante',
      daily: 'Diario',
    },
    product: 'Producto',
    visitor: 'Visitante',
    email: 'Correo',
    browserId: 'Id del navegador',
    country: 'País',
    ipAddress: 'Dirección IP',
    secondsWatched: 'Tiempo de vista (s)',
    avgSecondsWatched: 'Tiempo promedio por visita (s)',
    favorite: 'Favorito',
    favorites: 'Visitas con favorito',
    started: 'Inicio',
    lastViewed: 'Última visita',
    views: 'Vistas',
    uniqueVisitors: 'Visitantes únicos',
    productsViewed: 'Productos vistos',
    day: 'Día',
    kind: 'Tipo',
    recorded: 'Registrado',
    forecast: 'Pronóstico',
    expected: 'Vistas esperadas',
    low: 'Estimación baja',
    high: 'Estimación alta',
    yes: 'Sí',
    no: 'No',
    anonymous: 'Sin iniciar sesión',
    deleted: '(producto eliminado)',
    truncated: (shown, total) =>
      `Se muestran las ${shown} visitas más recientes de ${total}. Ajusta los filtros para exportar el resto.`,
    noForecast: (have, need) =>
      `Todavía no hay pronóstico: ${have} de los ${need} días de historial que necesita.`,
  },
};

const DATE_TIME_FORMAT = 'yyyy-mm-dd hh:mm:ss';
const DATE_FORMAT = 'yyyy-mm-dd';

@Injectable()
export class ExcelJsProductViewsWorkbook implements ProductViewsWorkbookPort {
  async build(
    data: ProductViewsWorkbookData,
    language: WorkbookLanguage,
  ): Promise<Buffer> {
    const labels = LABELS[language];
    const workbook = new Workbook();
    workbook.created = data.generatedAt;

    // A spreadsheet cell holds a wall-clock time with no zone attached, so
    // each instant is shifted to the viewer's local time before it is
    // written. The file then reads the way the page did.
    const local = (instant: Date) =>
      new Date(instant.getTime() - data.tzOffsetMinutes * 60_000);
    const seconds = (ms: number) => Math.round(ms / 1000);

    const visits = workbook.addWorksheet(labels.sheets.visits);
    setColumns(visits, [
      [labels.started, 20, DATE_TIME_FORMAT],
      [labels.product, 32],
      [labels.visitor, 26],
      [labels.email, 30],
      [labels.browserId, 38],
      [labels.country, 10],
      [labels.ipAddress, 18],
      [labels.secondsWatched, 18],
      [labels.favorite, 10],
    ]);
    for (const { view, user, productSlug } of data.visits) {
      visits.addRow([
        local(view.startedAt),
        productSlug === null && view.productId === null
          ? `${view.productName} ${labels.deleted}`
          : view.productName,
        user?.name ?? labels.anonymous,
        user?.email ?? '',
        view.visitorId,
        view.country ?? '',
        view.ipAddress,
        seconds(view.durationMs),
        view.favorited ? labels.yes : labels.no,
      ]);
    }
    if (data.totalVisits > data.visits.length) {
      visits.addRow([]);
      visits.addRow([
        labels.truncated(data.visits.length, data.totalVisits),
      ]).font = { italic: true };
    }

    const products = workbook.addWorksheet(labels.sheets.products);
    setColumns(products, [
      [labels.product, 32],
      [labels.views, 10],
      [labels.uniqueVisitors, 16],
      [labels.secondsWatched, 18],
      [labels.avgSecondsWatched, 26],
      [labels.favorites, 20],
      [labels.lastViewed, 20, DATE_TIME_FORMAT],
    ]);
    for (const group of data.products) {
      products.addRow([
        group.productId === null
          ? `${group.productName} ${labels.deleted}`
          : group.productName,
        group.views,
        group.visitors,
        seconds(group.totalDurationMs),
        seconds(group.totalDurationMs / group.views),
        group.favorites,
        local(group.lastViewedAt),
      ]);
    }

    const visitors = workbook.addWorksheet(labels.sheets.visitors);
    setColumns(visitors, [
      [labels.visitor, 26],
      [labels.email, 30],
      [labels.browserId, 38],
      [labels.views, 10],
      [labels.productsViewed, 16],
      [labels.secondsWatched, 18],
      [labels.favorites, 20],
      [labels.lastViewed, 20, DATE_TIME_FORMAT],
    ]);
    for (const group of data.visitors) {
      visitors.addRow([
        group.user?.name ?? labels.anonymous,
        group.user?.email ?? '',
        group.visitorId ?? '',
        group.views,
        group.products,
        seconds(group.totalDurationMs),
        group.favorites,
        local(group.lastViewedAt),
      ]);
    }

    // Recorded days and forecast days share one sheet and one date column so
    // they can be charted as a single continuous series.
    const daily = workbook.addWorksheet(labels.sheets.daily);
    setColumns(daily, [
      [labels.day, 14, DATE_FORMAT],
      [labels.kind, 14],
      [labels.views, 10],
      [labels.uniqueVisitors, 16],
      [labels.secondsWatched, 18],
      [labels.low, 14],
      [labels.high, 14],
    ]);
    const asDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
    for (const entry of data.daily) {
      daily.addRow([
        asDate(entry.day),
        labels.recorded,
        entry.views,
        entry.visitors,
        seconds(entry.durationMs),
      ]);
    }
    if (data.forecast.status === 'ok') {
      for (const entry of data.forecast.days) {
        daily.addRow([
          asDate(entry.day),
          labels.forecast,
          entry.expected,
          null,
          null,
          entry.low,
          entry.high,
        ]).font = { italic: true };
      }
    } else {
      daily.addRow([]);
      daily.addRow([
        labels.noForecast(
          data.forecast.daysOfHistory,
          data.forecast.daysNeeded,
        ),
      ]).font = { italic: true };
    }

    // exceljs types this as its own Buffer-like; it is a Node Buffer here.
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}

/** Header row (bold, frozen) plus a width and optional number format per column. */
function setColumns(
  sheet: Worksheet,
  columns: [header: string, width: number, format?: string][],
): void {
  sheet.columns = columns.map(([header, width, numFmt]) => ({
    header,
    width,
    style: numFmt ? { numFmt } : {},
  }));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}
