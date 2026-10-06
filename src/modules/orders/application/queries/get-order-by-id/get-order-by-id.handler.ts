import { Inject, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Order } from '@/modules/orders/domain/entities/order.entity';
import { ORDER_REPOSITORY } from '@/modules/orders/domain/repositories/order.repository';
import type { OrderRepository } from '@/modules/orders/domain/repositories/order.repository';
import { GetOrderByIdQuery } from './get-order-by-id.query';

@QueryHandler(GetOrderByIdQuery)
export class GetOrderByIdHandler implements IQueryHandler<
  GetOrderByIdQuery,
  Order
> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orderRepository: OrderRepository,
  ) {}

  async execute(query: GetOrderByIdQuery): Promise<Order> {
    const order = await this.orderRepository.findById(query.orderId);
    if (!order || !order.belongsTo(query.userId)) {
      throw new NotFoundException(`Order "${query.orderId}" not found`);
    }
    return order;
  }
}
