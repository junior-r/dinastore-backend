import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { FILE_STORAGE } from '@/shared/domain/storage/file-storage.port';
import type { FileStorage } from '@/shared/domain/storage/file-storage.port';
import { Permission } from '@/modules/users/domain/entities/permission';
import { Role } from '@/modules/users/domain/entities/user.entity';
import { JwtAuthGuard } from '@/modules/users/infrastructure/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/users/infrastructure/auth/permissions.guard';
import { RolesGuard } from '@/modules/users/infrastructure/auth/roles.guard';
import { RequirePermission } from '@/modules/users/presentation/decorators/require-permission.decorator';
import { Roles } from '@/modules/users/presentation/decorators/roles.decorator';
import { PaginatedCustomizedOrderItems } from '@/modules/orders/application/queries/get-customized-order-items/get-customized-order-items.handler';
import { GetCustomizedOrderItemsQuery } from '@/modules/orders/application/queries/get-customized-order-items/get-customized-order-items.query';
import { CustomizedOrderItemResponseDto } from '../../dto/customized-order-item-response.dto';
import { ListOrdersDto } from '../../dto/list-orders.dto';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.STAFF)
export class AdminOrdersController {
  constructor(
    private readonly queryBus: QueryBus,
    @Inject(FILE_STORAGE) private readonly fileStorage: FileStorage,
  ) {}

  // What fulfillment works from: every ordered item with a customer design,
  // across all customers, with the print-ready file.
  @Get('custom-items')
  @RequirePermission(Permission.ORDERS_VIEW)
  async listCustomItems(@Query() query: ListOrdersDto) {
    const result = await this.queryBus.execute<
      GetCustomizedOrderItemsQuery,
      PaginatedCustomizedOrderItems
    >(new GetCustomizedOrderItemsQuery(query.page, query.pageSize));

    return {
      items: result.items.map((item) =>
        CustomizedOrderItemResponseDto.fromListItem(item, this.fileStorage),
      ),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}
