import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ORDER_REPOSITORY } from '@/modules/orders/domain/repositories/order.repository';
import type {
  CustomizedOrderItem,
  OrderRepository,
} from '@/modules/orders/domain/repositories/order.repository';
import { GetCustomizedOrderItemsQuery } from './get-customized-order-items.query';

const MAX_PAGE_SIZE = 100;

export interface PaginatedCustomizedOrderItems {
  items: CustomizedOrderItem[];
  total: number;
  page: number;
  pageSize: number;
}

@QueryHandler(GetCustomizedOrderItemsQuery)
export class GetCustomizedOrderItemsHandler implements IQueryHandler<
  GetCustomizedOrderItemsQuery,
  PaginatedCustomizedOrderItems
> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orderRepository: OrderRepository,
  ) {}

  async execute(
    query: GetCustomizedOrderItemsQuery,
  ): Promise<PaginatedCustomizedOrderItems> {
    // Clamped here as well as in the DTO: the handler is callable from
    // anywhere in the app, not only through the validated HTTP route.
    const page = Math.max(1, Math.trunc(query.page));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.trunc(query.pageSize)),
    );

    const [items, total] = await Promise.all([
      this.orderRepository.findCustomizedItems({
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.orderRepository.countCustomizedItems(),
    ]);

    return { items, total, page, pageSize };
  }
}
