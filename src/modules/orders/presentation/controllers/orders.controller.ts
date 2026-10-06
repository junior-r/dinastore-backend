import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { FILE_STORAGE } from '@/shared/domain/storage/file-storage.port';
import type { FileStorage } from '@/shared/domain/storage/file-storage.port';
import { JwtAuthGuard } from '@/modules/users/infrastructure/auth/jwt-auth.guard';
import { CurrentUser } from '@/modules/users/presentation/decorators/current-user.decorator';
import type { TokenPayload } from '@/modules/users/domain/services/token-service';
import { PlaceOrderCommand } from '@/modules/orders/application/commands/place-order/place-order.command';
import { PayOrderCommand } from '@/modules/orders/application/commands/pay-order/pay-order.command';
import { PaginatedOrders } from '@/modules/orders/application/queries/get-my-orders/get-my-orders.handler';
import { GetMyOrdersQuery } from '@/modules/orders/application/queries/get-my-orders/get-my-orders.query';
import { GetOrderByIdQuery } from '@/modules/orders/application/queries/get-order-by-id/get-order-by-id.query';
import { Order } from '@/modules/orders/domain/entities/order.entity';
import { ListOrdersDto } from '../dto/list-orders.dto';
import { OrderResponseDto } from '../dto/order-response.dto';
import { PlaceOrderDto } from '../dto/place-order.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    @Inject(FILE_STORAGE) private readonly fileStorage: FileStorage,
  ) {}

  @Get()
  async list(
    @CurrentUser() currentUser: TokenPayload,
    @Query() query: ListOrdersDto,
  ) {
    const result = await this.queryBus.execute<
      GetMyOrdersQuery,
      PaginatedOrders
    >(new GetMyOrdersQuery(currentUser.sub, query.page, query.pageSize));

    return {
      items: result.items.map((order) =>
        OrderResponseDto.fromDomain(order, this.fileStorage),
      ),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }

  @Get(':id')
  async findById(
    @CurrentUser() currentUser: TokenPayload,
    @Param('id') id: string,
  ) {
    const order = await this.queryBus.execute<GetOrderByIdQuery, Order>(
      new GetOrderByIdQuery(currentUser.sub, id),
    );
    return OrderResponseDto.fromDomain(order, this.fileStorage);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async place(
    @CurrentUser() currentUser: TokenPayload,
    @Body() dto: PlaceOrderDto,
  ) {
    const order = await this.commandBus.execute<PlaceOrderCommand, Order>(
      new PlaceOrderCommand(currentUser.sub, dto.items),
    );
    return OrderResponseDto.fromDomain(order, this.fileStorage);
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  async pay(@CurrentUser() currentUser: TokenPayload, @Param('id') id: string) {
    const order = await this.commandBus.execute<PayOrderCommand, Order>(
      new PayOrderCommand(currentUser.sub, id),
    );
    return OrderResponseDto.fromDomain(order, this.fileStorage);
  }
}
