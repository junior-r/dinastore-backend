import { Order, OrderStatus } from '../entities/order.entity';
import type {
  OrderItemCustomization,
  OrderItemProps,
} from '../entities/order.entity';

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');

export interface StockDecrement {
  productVariantId: string;
  quantity: number;
}

export interface FindOrdersParams {
  userId: string;
  skip?: number;
  take?: number;
}

/**
 * One ordered item that carries a customer design, with just enough of its
 * order and buyer for fulfillment to act on it. A read model for the admin
 * custom-prints list, not an aggregate.
 */
export interface CustomizedOrderItem {
  orderId: string;
  orderStatus: OrderStatus;
  orderedAt: Date;
  customer: { id: string; name: string; email: string };
  item: OrderItemProps & { customization: OrderItemCustomization };
}

export interface PageParams {
  skip?: number;
  take?: number;
}

export interface OrderRepository {
  /** Persists a new order and applies `stockDecrements` atomically in the same transaction. */
  create(order: Order, stockDecrements: StockDecrement[]): Promise<Order>;
  findById(id: string): Promise<Order | null>;
  findMany(params: FindOrdersParams): Promise<Order[]>;
  countByUserId(userId: string): Promise<number>;
  updateStatus(order: Order): Promise<Order>;
  /** Newest first. */
  findCustomizedItems(params: PageParams): Promise<CustomizedOrderItem[]>;
  countCustomizedItems(): Promise<number>;
}
