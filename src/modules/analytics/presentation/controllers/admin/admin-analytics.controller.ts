import {
  Controller,
  Get,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Permission } from '@/modules/users/domain/entities/permission';
import { Role } from '@/modules/users/domain/entities/user.entity';
import { JwtAuthGuard } from '@/modules/users/infrastructure/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/users/infrastructure/auth/permissions.guard';
import { RolesGuard } from '@/modules/users/infrastructure/auth/roles.guard';
import { RequirePermission } from '@/modules/users/presentation/decorators/require-permission.decorator';
import { Roles } from '@/modules/users/presentation/decorators/roles.decorator';
import { ExportProductViewsQuery } from '@/modules/analytics/application/queries/export-product-views/export-product-views.query';
import type { PaginatedGroups } from '@/modules/analytics/application/queries/get-product-view-groups/get-product-view-groups.handler';
import {
  GetProductViewsByProductQuery,
  GetProductViewsByVisitorQuery,
} from '@/modules/analytics/application/queries/get-product-view-groups/get-product-view-groups.query';
import { GetProductViewInsightsQuery } from '@/modules/analytics/application/queries/get-product-view-insights/get-product-view-insights.query';
import { PaginatedProductViews } from '@/modules/analytics/application/queries/get-product-views/get-product-views.handler';
import { GetProductViewsQuery } from '@/modules/analytics/application/queries/get-product-views/get-product-views.query';
import type { ViewInsights } from '@/modules/analytics/application/view-insights.reader';
import { XLSX_CONTENT_TYPE } from '@/modules/analytics/domain/ports/product-views-workbook.port';
import type {
  ProductViewGroup,
  VisitorViewGroup,
} from '@/modules/analytics/domain/product-view-stats';
import {
  ExportProductViewsDto,
  ListProductViewsDto,
  ProductViewInsightsDto,
} from '@/modules/analytics/presentation/dto/list-product-views.dto';
import { ProductViewResponseDto } from '@/modules/analytics/presentation/dto/product-view-response.dto';

// Its own permission rather than riding on products:view. This history holds
// visitors' IP addresses and ties them to accounts, which is more sensitive
// than anything else STAFF can be granted, so being allowed to edit the
// catalog must not automatically mean being allowed to read it.
//
// Every route here takes the same filters (ProductViewFilterDto), so the
// table, the charts and the exported file always describe the same visits.
@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.STAFF)
export class AdminAnalyticsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('product-views')
  @RequirePermission(Permission.ANALYTICS_VIEW)
  async listProductViews(@Query() query: ListProductViewsDto) {
    const result = await this.queryBus.execute<
      GetProductViewsQuery,
      PaginatedProductViews
    >(new GetProductViewsQuery(query.page, query.pageSize, query.toFilter()));

    return {
      items: result.items.map((item) =>
        ProductViewResponseDto.fromListItem(item),
      ),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }

  @Get('product-views/by-product')
  @RequirePermission(Permission.ANALYTICS_VIEW)
  listByProduct(@Query() query: ListProductViewsDto) {
    return this.queryBus.execute<
      GetProductViewsByProductQuery,
      PaginatedGroups<ProductViewGroup>
    >(
      new GetProductViewsByProductQuery(
        query.page,
        query.pageSize,
        query.toFilter(),
      ),
    );
  }

  @Get('product-views/by-visitor')
  @RequirePermission(Permission.ANALYTICS_VIEW)
  listByVisitor(@Query() query: ListProductViewsDto) {
    return this.queryBus.execute<
      GetProductViewsByVisitorQuery,
      PaginatedGroups<VisitorViewGroup>
    >(
      new GetProductViewsByVisitorQuery(
        query.page,
        query.pageSize,
        query.toFilter(),
      ),
    );
  }

  @Get('product-views/insights')
  @RequirePermission(Permission.ANALYTICS_VIEW)
  insights(@Query() query: ProductViewInsightsDto) {
    return this.queryBus.execute<GetProductViewInsightsQuery, ViewInsights>(
      new GetProductViewInsightsQuery(query.toFilter(), query.tzOffset),
    );
  }

  @Get('product-views/export')
  @RequirePermission(Permission.ANALYTICS_VIEW)
  async export(@Query() query: ExportProductViewsDto): Promise<StreamableFile> {
    const file = await this.queryBus.execute<ExportProductViewsQuery, Buffer>(
      new ExportProductViewsQuery(query.toFilter(), query.tzOffset, query.lang),
    );

    return new StreamableFile(file, {
      type: XLSX_CONTENT_TYPE,
      disposition: 'attachment; filename="product-views.xlsx"',
      length: file.length,
    });
  }
}
