import type { OrderRepository } from '../domain/repositories/order.repository';

export function createMockOrderRepository(): jest.Mocked<OrderRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findMany: jest.fn(),
    countByUserId: jest.fn(),
    updateStatus: jest.fn(),
    findCustomizedItems: jest.fn(),
    countCustomizedItems: jest.fn(),
  };
}
