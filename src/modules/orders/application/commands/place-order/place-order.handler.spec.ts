import { NotFoundException } from '@nestjs/common';
import { DomainError } from '@/shared/domain/domain-error';
import { Order } from '@/modules/orders/domain/entities/order.entity';
import type {
  DesignLookupPort,
  OrderableDesign,
} from '@/modules/orders/domain/repositories/design-lookup.port';
import type { OrderRepository } from '@/modules/orders/domain/repositories/order.repository';
import type {
  OrderableVariant,
  ProductCatalogPort,
} from '@/modules/orders/domain/repositories/product-catalog.port';
import { createMockOrderRepository } from '@/modules/orders/testing/mock-order-repository';
import {
  createMockDesignLookup,
  createMockProductCatalog,
} from '@/modules/orders/testing/mock-product-catalog';
import { PlaceOrderCommand } from './place-order.command';
import { PlaceOrderHandler } from './place-order.handler';

describe('PlaceOrderHandler', () => {
  let orderRepository: jest.Mocked<OrderRepository>;
  let catalog: jest.Mocked<ProductCatalogPort>;
  let designs: jest.Mocked<DesignLookupPort>;
  let handler: PlaceOrderHandler;

  const variant: OrderableVariant = {
    productVariantId: 'variant-1',
    productId: 'product-1',
    productName: 'Classic Tee',
    variantSize: 'M',
    variantColor: 'black',
    stock: 10,
    unitPriceCents: 2500,
    currency: 'USD',
    isPublished: true,
    imageUrl: null,
  };

  beforeEach(() => {
    orderRepository = createMockOrderRepository();
    catalog = createMockProductCatalog();
    designs = createMockDesignLookup();
    handler = new PlaceOrderHandler(orderRepository, catalog, designs);
  });

  it('places an order for a valid, published, in-stock variant', async () => {
    catalog.findVariantsByIds.mockResolvedValue([variant]);
    orderRepository.create.mockImplementation((order) =>
      Promise.resolve(order),
    );

    const result = await handler.execute(
      new PlaceOrderCommand('user-1', [
        { productVariantId: 'variant-1', quantity: 2 },
      ]),
    );

    expect(result).toBeInstanceOf(Order);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      productVariantId: 'variant-1',
      unitPriceCents: 2500,
      quantity: 2,
    });
    expect(orderRepository.create).toHaveBeenCalledWith(expect.any(Order), [
      { productVariantId: 'variant-1', quantity: 2 },
    ]);
  });

  it('merges duplicate line items for the same variant into a single quantity', async () => {
    catalog.findVariantsByIds.mockResolvedValue([variant]);
    orderRepository.create.mockImplementation((order) =>
      Promise.resolve(order),
    );

    const result = await handler.execute(
      new PlaceOrderCommand('user-1', [
        { productVariantId: 'variant-1', quantity: 1 },
        { productVariantId: 'variant-1', quantity: 2 },
      ]),
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].quantity).toBe(3);
  });

  it('rejects an empty item list', async () => {
    await expect(
      handler.execute(new PlaceOrderCommand('user-1', [])),
    ).rejects.toThrow(DomainError);
    expect(catalog.findVariantsByIds).not.toHaveBeenCalled();
  });

  it('rejects a non-positive quantity', async () => {
    await expect(
      handler.execute(
        new PlaceOrderCommand('user-1', [
          { productVariantId: 'variant-1', quantity: 0 },
        ]),
      ),
    ).rejects.toThrow(DomainError);
  });

  it('throws NotFoundException when a variant does not exist', async () => {
    catalog.findVariantsByIds.mockResolvedValue([]);

    await expect(
      handler.execute(
        new PlaceOrderCommand('user-1', [
          { productVariantId: 'missing', quantity: 1 },
        ]),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(orderRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a variant belonging to an unpublished product', async () => {
    catalog.findVariantsByIds.mockResolvedValue([
      { ...variant, isPublished: false },
    ]);

    await expect(
      handler.execute(
        new PlaceOrderCommand('user-1', [
          { productVariantId: 'variant-1', quantity: 1 },
        ]),
      ),
    ).rejects.toThrow('is not available for purchase');
    expect(orderRepository.create).not.toHaveBeenCalled();
  });

  it('rejects items whose variants have mismatched currencies', async () => {
    catalog.findVariantsByIds.mockResolvedValue([
      variant,
      { ...variant, productVariantId: 'variant-2', currency: 'EUR' },
    ]);

    await expect(
      handler.execute(
        new PlaceOrderCommand('user-1', [
          { productVariantId: 'variant-1', quantity: 1 },
          { productVariantId: 'variant-2', quantity: 1 },
        ]),
      ),
    ).rejects.toThrow('Order items must share the same currency');
  });

  describe('customized items', () => {
    const design: OrderableDesign = {
      designId: 'design-1',
      ownerId: 'user-1',
      thumbnailKey: 'designs/design-1-thumb.webp',
      printKey: 'designs/design-1-print.png',
    };
    const placement = { x: 0.5, y: 0.4, width: 0.3 };
    const customized = {
      productVariantId: 'variant-1',
      quantity: 1,
      customization: { designId: 'design-1', placement },
    };

    beforeEach(() => {
      catalog.findVariantsByIds.mockResolvedValue([
        { ...variant, imageUrl: 'http://files/tee.webp' },
      ]);
      designs.findByIds.mockResolvedValue([design]);
      orderRepository.create.mockImplementation((order) =>
        Promise.resolve(order),
      );
    });

    it('snapshots the design files, garment photo and placement', async () => {
      const result = await handler.execute(
        new PlaceOrderCommand('user-1', [customized]),
      );

      expect(result.items[0].customization).toEqual({
        designId: 'design-1',
        thumbnailKey: 'designs/design-1-thumb.webp',
        printKey: 'designs/design-1-print.png',
        garmentImageUrl: 'http://files/tee.webp',
        placement,
      });
    });

    it('keeps customized lines apart but takes stock from one pile', async () => {
      const result = await handler.execute(
        new PlaceOrderCommand('user-1', [
          { productVariantId: 'variant-1', quantity: 2 },
          customized,
          { ...customized, quantity: 3 },
        ]),
      );

      expect(result.items.map((item) => item.quantity)).toEqual([2, 1, 3]);
      expect(result.items[0].customization).toBeNull();
      expect(orderRepository.create).toHaveBeenCalledWith(expect.any(Order), [
        { productVariantId: 'variant-1', quantity: 6 },
      ]);
    });

    it("reports another user's design as not found", async () => {
      designs.findByIds.mockResolvedValue([{ ...design, ownerId: 'user-2' }]);

      await expect(
        handler.execute(new PlaceOrderCommand('user-1', [customized])),
      ).rejects.toThrow(NotFoundException);
      expect(orderRepository.create).not.toHaveBeenCalled();
    });

    it('rejects a placement outside the allowed size', async () => {
      await expect(
        handler.execute(
          new PlaceOrderCommand('user-1', [
            {
              ...customized,
              customization: {
                designId: 'design-1',
                placement: { ...placement, width: 0.99 },
              },
            },
          ]),
        ),
      ).rejects.toThrow(DomainError);
    });
  });
});
