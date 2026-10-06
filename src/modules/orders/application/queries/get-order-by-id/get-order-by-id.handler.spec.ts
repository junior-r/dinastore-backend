import { NotFoundException } from '@nestjs/common';
import { Order } from '@/modules/orders/domain/entities/order.entity';
import type { OrderRepository } from '@/modules/orders/domain/repositories/order.repository';
import { createMockOrderRepository } from '@/modules/orders/testing/mock-order-repository';
import { GetOrderByIdQuery } from './get-order-by-id.query';
import { GetOrderByIdHandler } from './get-order-by-id.handler';

describe('GetOrderByIdHandler', () => {
  let orderRepository: jest.Mocked<OrderRepository>;
  let handler: GetOrderByIdHandler;

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
    handler = new GetOrderByIdHandler(orderRepository);
  });

  it('returns the order when it belongs to the requester', async () => {
    const order = Order.create({
      userId: 'user-1',
      currency: 'USD',
      items: [item],
    });
    orderRepository.findById.mockResolvedValue(order);

    const result = await handler.execute(
      new GetOrderByIdQuery('user-1', order.id),
    );

    expect(result).toBe(order);
  });

  it('throws NotFoundException when the order does not exist', async () => {
    orderRepository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new GetOrderByIdQuery('user-1', 'missing')),
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
      handler.execute(new GetOrderByIdQuery('user-2', order.id)),
    ).rejects.toThrow(NotFoundException);
  });
});
