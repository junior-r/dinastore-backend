import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Order } from '@/modules/orders/domain/entities/order.entity';
import { ORDER_REPOSITORY } from '@/modules/orders/domain/repositories/order.repository';
import type { OrderRepository } from '@/modules/orders/domain/repositories/order.repository';
import { PayOrderCommand } from './pay-order.command';

@CommandHandler(PayOrderCommand)
export class PayOrderHandler implements ICommandHandler<
  PayOrderCommand,
  Order
> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orderRepository: OrderRepository,
  ) {}

  async execute(command: PayOrderCommand): Promise<Order> {
    const order = await this.orderRepository.findById(command.orderId);
    if (!order || !order.belongsTo(command.userId)) {
      throw new NotFoundException(`Order "${command.orderId}" not found`);
    }

    // No real payment gateway wired up yet (see backend/CLAUDE.md) — this
    // confirms payment immediately instead of round-tripping to Stripe/MercadoPago.
    return this.orderRepository.updateStatus(order.pay());
  }
}
