import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Permission } from '@/modules/users/domain/entities/permission';
import { Role } from '@/modules/users/domain/entities/user.entity';
import { JwtAuthGuard } from '@/modules/users/infrastructure/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/users/infrastructure/auth/permissions.guard';
import { RolesGuard } from '@/modules/users/infrastructure/auth/roles.guard';
import { RequirePermission } from '@/modules/users/presentation/decorators/require-permission.decorator';
import { Roles } from '@/modules/users/presentation/decorators/roles.decorator';
import { PaginatedProductViews } from '@/modules/analytics/application/queries/get-product-views/get-product-views.handler';
import { GetProductViewsQuery } from '@/modules/analytics/application/queries/get-product-views/get-product-views.query';
import { ListProductViewsDto } from '@/modules/analytics/presentation/dto/list-product-views.dto';
import { ProductViewResponseDto } from '@/modules/analytics/presentation/dto/product-view-response.dto';

// Its own permission rather than riding on products:view. This history holds
// visitors' IP addresses and ties them to accounts, which is more sensitive
// than anything else STAFF can be granted, so being allowed to edit the
// catalog must not automatically mean being allowed to read it.
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
    >(new GetProductViewsQuery(query.page, query.pageSize, query.productId));

    return {
      items: result.items.map((item) =>
        ProductViewResponseDto.fromListItem(item),
      ),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}
