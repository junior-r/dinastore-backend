import { Order } from '@/modules/orders/domain/entities/order.entity';
import type { OrderRepository } from '@/modules/orders/domain/repositories/order.repository';
import { createMockOrderRepository } from '@/modules/orders/testing/mock-order-repository';
import { GetMyOrdersHandler } from './get-my-orders.handler';
import { GetMyOrdersQuery } from './get-my-orders.query';

describe('GetMyOrdersHandler', () => {
  let orderRepository: jest.Mocked<OrderRepository>;
  let handler: GetMyOrdersHandler;

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
    handler = new GetMyOrdersHandler(orderRepository);
  });

  it('paginates orders scoped to the requesting user', async () => {
    const order = Order.create({
      userId: 'user-1',
      currency: 'USD',
      items: [item],
    });
    orderRepository.findMany.mockResolvedValue([order]);
    orderRepository.countByUserId.mockResolvedValue(1);

    const result = await handler.execute(new GetMyOrdersQuery('user-1', 2, 10));

    expect(orderRepository.findMany).toHaveBeenCalledWith({
      userId: 'user-1',
      skip: 10,
      take: 10,
    });
    expect(orderRepository.countByUserId).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ items: [order], total: 1, page: 2, pageSize: 10 });
  });
});
