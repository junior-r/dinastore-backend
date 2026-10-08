import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { RecordProductViewHandler } from './application/commands/record-product-view/record-product-view.handler';
import { ExportProductViewsHandler } from './application/queries/export-product-views/export-product-views.handler';
import {
  GetProductViewsByProductHandler,
  GetProductViewsByVisitorHandler,
} from './application/queries/get-product-view-groups/get-product-view-groups.handler';
import { GetProductViewInsightsHandler } from './application/queries/get-product-view-insights/get-product-view-insights.handler';
import { GetProductViewsHandler } from './application/queries/get-product-views/get-product-views.handler';
import { ViewInsightsReader } from './application/view-insights.reader';
import { PRODUCT_VIEWS_WORKBOOK_PORT } from './domain/ports/product-views-workbook.port';
import { COUNTRY_RESOLVER_PORT } from './domain/ports/country-resolver.port';
import { VIEWED_PRODUCT_PORT } from './domain/ports/viewed-product.port';
import { PRODUCT_VIEW_REPOSITORY } from './domain/repositories/product-view.repository';
import { PrismaViewedProductAdapter } from './infrastructure/adapters/prisma-viewed-product.adapter';
import { ExcelJsProductViewsWorkbook } from './infrastructure/export/exceljs-product-views-workbook';
import { GeoIpCountryResolver } from './infrastructure/geo/geoip-country-resolver';
import { PrismaProductViewRepository } from './infrastructure/repositories/prisma-product-view.repository';
import { AdminAnalyticsController } from './presentation/controllers/admin/admin-analytics.controller';
import { ProductViewsController } from './presentation/controllers/product-views.controller';

@Module({
  // PassportModule for the JWT guards; UsersModule because PermissionsGuard
  // (on the admin controller) needs USER_REPOSITORY. Same pair CatalogModule
  // imports for the same reason.
  imports: [CqrsModule, PassportModule, UsersModule],
  controllers: [ProductViewsController, AdminAnalyticsController],
  providers: [
    RecordProductViewHandler,
    GetProductViewsHandler,
    GetProductViewsByProductHandler,
    GetProductViewsByVisitorHandler,
    GetProductViewInsightsHandler,
    ExportProductViewsHandler,
    ViewInsightsReader,
    {
      provide: PRODUCT_VIEW_REPOSITORY,
      useClass: PrismaProductViewRepository,
    },
    { provide: VIEWED_PRODUCT_PORT, useClass: PrismaViewedProductAdapter },
    { provide: COUNTRY_RESOLVER_PORT, useClass: GeoIpCountryResolver },
    {
      provide: PRODUCT_VIEWS_WORKBOOK_PORT,
      useClass: ExcelJsProductViewsWorkbook,
    },
  ],
})
export class AnalyticsModule {}
