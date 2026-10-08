import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Order } from '@/modules/orders/domain/entities/order.entity';
import { ORDER_REPOSITORY } from '@/modules/orders/domain/repositories/order.repository';
import type { OrderRepository } from '@/modules/orders/domain/repositories/order.repository';
import { GetMyOrdersQuery } from './get-my-orders.query';

export interface PaginatedOrders {
  items: Order[];
  total: number;
  page: number;
  pageSize: number;
}

@QueryHandler(GetMyOrdersQuery)
export class GetMyOrdersHandler implements IQueryHandler<
  GetMyOrdersQuery,
  PaginatedOrders
> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orderRepository: OrderRepository,
  ) {}

  async execute(query: GetMyOrdersQuery): Promise<PaginatedOrders> {
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await Promise.all([
      this.orderRepository.findMany({
        userId: query.userId,
        skip,
        take: query.pageSize,
      }),
      this.orderRepository.countByUserId(query.userId),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }
}
