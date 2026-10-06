import { DomainError } from '@/shared/domain/domain-error';
import { Order, OrderStatus } from './order.entity';

describe('Order entity', () => {
  const validItem = {
    productId: 'product-1',
    productVariantId: 'variant-1',
    productName: 'Classic Tee',
    variantSize: 'M',
    variantColor: 'black',
    unitPriceCents: 2500,
    quantity: 2,
    customization: null,
  };

  describe('create', () => {
    it('creates an order in PENDING status with a generated id', () => {
      const order = Order.create({
        userId: 'user-1',
        currency: 'USD',
        items: [validItem],
      });

      expect(order.id).toEqual(expect.any(String));
      expect(order.status).toBe(OrderStatus.PENDING);
      expect(order.userId).toBe('user-1');
      expect(order.items).toHaveLength(1);
      expect(order.items[0].id).toEqual(expect.any(String));
    });

    it('rejects an order with no items', () => {
      expect(() =>
        Order.create({ userId: 'user-1', currency: 'USD', items: [] }),
      ).toThrow('An order must have at least one item');
    });

    it('rejects a non-positive quantity', () => {
      expect(() =>
        Order.create({
          userId: 'user-1',
          currency: 'USD',
          items: [{ ...validItem, quantity: 0 }],
        }),
      ).toThrow(DomainError);
    });

    it('rejects a negative unit price', () => {
      expect(() =>
        Order.create({
          userId: 'user-1',
          currency: 'USD',
          items: [{ ...validItem, unitPriceCents: -1 }],
        }),
      ).toThrow('Order item unitPriceCents cannot be negative');
    });
  });

  describe('subtotalCents', () => {
    it('sums unitPriceCents * quantity across items', () => {
      const order = Order.create({
        userId: 'user-1',
        currency: 'USD',
        items: [
          validItem,
          { ...validItem, productVariantId: 'variant-2', quantity: 1 },
        ],
      });

      expect(order.subtotalCents()).toBe(2500 * 2 + 2500 * 1);
    });
  });

  describe('belongsTo', () => {
    it('returns true only for the owning user', () => {
      const order = Order.create({
        userId: 'user-1',
        currency: 'USD',
        items: [validItem],
      });
      expect(order.belongsTo('user-1')).toBe(true);
      expect(order.belongsTo('user-2')).toBe(false);
    });
  });

  describe('pay', () => {
    it('transitions a PENDING order to PAID', () => {
      const order = Order.create({
        userId: 'user-1',
        currency: 'USD',
        items: [validItem],
      });
      const paid = order.pay();
      expect(paid.status).toBe(OrderStatus.PAID);
    });

    it('rejects paying a non-PENDING order', () => {
      const order = Order.create({
        userId: 'user-1',
        currency: 'USD',
        items: [validItem],
      });
      const paid = order.pay();
      expect(() => paid.pay()).toThrow('Cannot pay an order in "PAID" status');
    });
  });

  describe('cancel', () => {
    it('transitions a PENDING order to CANCELLED', () => {
      const order = Order.create({
        userId: 'user-1',
        currency: 'USD',
        items: [validItem],
      });
      expect(order.cancel().status).toBe(OrderStatus.CANCELLED);
    });

    it('rejects cancelling a non-PENDING order', () => {
      const order = Order.create({
        userId: 'user-1',
        currency: 'USD',
        items: [validItem],
      });
      const paid = order.pay();
      expect(() => paid.cancel()).toThrow(
        'Cannot cancel an order in "PAID" status',
      );
    });
  });

  describe('fromPersistence / toPersistenceProps', () => {
    it('round-trips props without mutation', () => {
      const props = {
        id: 'order-1',
        userId: 'user-1',
        status: OrderStatus.PAID,
        currency: 'USD',
        items: [{ id: 'item-1', ...validItem }],
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      };

      const order = Order.fromPersistence(props);

      expect(order.toPersistenceProps()).toEqual(props);
    });
  });
});
