import { NotFoundException } from '@nestjs/common';
import {
  Order,
  OrderStatus,
} from '@/modules/orders/domain/entities/order.entity';
import type { OrderRepository } from '@/modules/orders/domain/repositories/order.repository';
import { createMockOrderRepository } from '@/modules/orders/testing/mock-order-repository';
import { PayOrderCommand } from './pay-order.command';
import { PayOrderHandler } from './pay-order.handler';

describe('PayOrderHandler', () => {
  let orderRepository: jest.Mocked<OrderRepository>;
  let handler: PayOrderHandler;

  const item = {
    productId: 'product-1',
    productVariantId: 'variant-1',
    productName: 'Classic Tee',
    variantSize: 'M',
    variantColor: 'black',
    unitPriceCents: 2500,
    quantity: 1,
    customization: null,
  };

  beforeEach(() => {
    orderRepository = createMockOrderRepository();
    handler = new PayOrderHandler(orderRepository);
  });

  it('marks a pending order owned by the requester as PAID', async () => {
    const order = Order.create({
      userId: 'user-1',
      currency: 'USD',
      items: [item],
    });
    orderRepository.findById.mockResolvedValue(order);
    orderRepository.updateStatus.mockImplementation((updated) =>
      Promise.resolve(updated),
    );

    const result = await handler.execute(
      new PayOrderCommand('user-1', order.id),
    );

    expect(result.status).toBe(OrderStatus.PAID);
    expect(orderRepository.updateStatus).toHaveBeenCalledWith(
      expect.any(Order),
    );
  });

  it('throws NotFoundException when the order does not exist', async () => {
    orderRepository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new PayOrderCommand('user-1', 'missing')),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when the order belongs to a different user', async () => {
    const order = Order.create({
      userId: 'user-1',
      currency: 'USD',
      items: [item],
    });
    orderRepository.findById.mockResolvedValue(order);

    await expect(
      handler.execute(new PayOrderCommand('user-2', order.id)),
    ).rejects.toThrow(NotFoundException);
    expect(orderRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('rejects paying an order that is not PENDING', async () => {
    const order = Order.create({
      userId: 'user-1',
      currency: 'USD',
      items: [item],
    }).pay();
    orderRepository.findById.mockResolvedValue(order);

    await expect(
      handler.execute(new PayOrderCommand('user-1', order.id)),
    ).rejects.toThrow('Cannot pay an order in "PAID" status');
  });
});
