import { NotFoundException } from '@nestjs/common';
import { ProductView } from '@/modules/analytics/domain/entities/product-view.entity';
import type { CountryResolverPort } from '@/modules/analytics/domain/ports/country-resolver.port';
import type { ViewedProductPort } from '@/modules/analytics/domain/ports/viewed-product.port';
import type { ProductViewRepository } from '@/modules/analytics/domain/repositories/product-view.repository';
import {
  createMockCountryResolver,
  createMockViewedProductPort,
} from '@/modules/analytics/testing/mock-analytics-ports';
import { createMockProductViewRepository } from '@/modules/analytics/testing/mock-product-view-repository';
import { RecordProductViewCommand } from './record-product-view.command';
import { RecordProductViewHandler } from './record-product-view.handler';

interface CommandOverrides {
  viewId?: string;
  productId?: string;
  visitorId?: string;
  durationMs?: number;
  favorited?: boolean;
  userId?: string | null;
  ipAddress?: string;
  countryHint?: string | null;
}

function command(overrides: CommandOverrides = {}): RecordProductViewCommand {
  return new RecordProductViewCommand(
    overrides.viewId ?? 'view-1',
    overrides.productId ?? 'product-1',
    overrides.visitorId ?? 'visitor-1',
    overrides.durationMs ?? 0,
    overrides.favorited ?? false,
    overrides.userId ?? null,
    overrides.ipAddress ?? '203.0.113.7',
    overrides.countryHint ?? null,
  );
}

describe('RecordProductViewHandler', () => {
  let views: jest.Mocked<ProductViewRepository>;
  let products: jest.Mocked<ViewedProductPort>;
  let countries: jest.Mocked<CountryResolverPort>;
  let handler: RecordProductViewHandler;

  function savedView(): ProductView {
    return views.save.mock.calls[0][0];
  }

  beforeEach(() => {
    views = createMockProductViewRepository();
    products = createMockViewedProductPort();
    countries = createMockCountryResolver();
    handler = new RecordProductViewHandler(views, products, countries);

    views.findById.mockResolvedValue(null);
    products.findName.mockResolvedValue('Printed Tee');
    countries.resolve.mockReturnValue('VE');
  });

  describe('first report of a visit', () => {
    it('opens an anonymous view with the resolved country', async () => {
      await handler.execute(command({ durationMs: 800 }));

      expect(countries.resolve).toHaveBeenCalledWith('203.0.113.7');
      const view = savedView();
      expect(view.id).toBe('view-1');
      expect(view.productName).toBe('Printed Tee');
      expect(view.userId).toBeNull();
      expect(view.visitorId).toBe('visitor-1');
      expect(view.ipAddress).toBe('203.0.113.7');
      expect(view.country).toBe('VE');
      expect(view.durationMs).toBe(800);
    });

    it('ties the view to the user when the visitor is signed in', async () => {
      await handler.execute(command({ userId: 'user-1' }));

      expect(savedView().userId).toBe('user-1');
    });

    it('records whether the product is already a favorite', async () => {
      await handler.execute(command({ favorited: true }));

      expect(savedView().favorited).toBe(true);
    });

    it('prefers a trusted country hint over the lookup', async () => {
      await handler.execute(command({ countryHint: 'CO' }));

      expect(savedView().country).toBe('CO');
      expect(countries.resolve).not.toHaveBeenCalled();
    });

    it('stores no country when the address cannot be placed', async () => {
      countries.resolve.mockReturnValue(null);

      await handler.execute(command({ ipAddress: '::1' }));

      expect(savedView().country).toBeNull();
    });

    it('404s for a product that does not exist, and stores nothing', async () => {
      products.findName.mockResolvedValue(null);

      await expect(handler.execute(command())).rejects.toThrow(
        NotFoundException,
      );
      expect(views.save).not.toHaveBeenCalled();
    });
  });

  describe('later reports of the same visit', () => {
    const existing = ProductView.start({
      id: 'view-1',
      productId: 'product-1',
      productName: 'Printed Tee',
      userId: null,
      visitorId: 'visitor-1',
      ipAddress: '203.0.113.7',
      country: 'VE',
      durationMs: 15_000,
      favorited: false,
    });

    beforeEach(() => {
      views.findById.mockResolvedValue(existing);
    });

    it('extends the duration and updates the favorite state', async () => {
      await handler.execute(command({ durationMs: 30_000, favorited: true }));

      const view = savedView();
      expect(view.durationMs).toBe(30_000);
      expect(view.favorited).toBe(true);
    });

    it('does not let a late, smaller report shrink the duration', async () => {
      await handler.execute(command({ durationMs: 4000 }));

      expect(savedView().durationMs).toBe(15_000);
    });

    it('does not look the product or the country up again', async () => {
      await handler.execute(command({ durationMs: 30_000 }));

      expect(products.findName).not.toHaveBeenCalled();
      expect(countries.resolve).not.toHaveBeenCalled();
    });

    it('keeps the address and country from when the visit opened', async () => {
      // e.g. a phone moving from wifi to mobile data mid-visit. The row
      // describes where the visit started; it is not rewritten per report.
      await handler.execute(
        command({ ipAddress: '198.51.100.9', countryHint: 'CO' }),
      );

      const view = savedView();
      expect(view.ipAddress).toBe('203.0.113.7');
      expect(view.country).toBe('VE');
    });

    it('still works after the product has been deleted', async () => {
      // No product lookup on a top-up, so a visit in progress when an admin
      // deletes the product finishes recording instead of starting to 404.
      products.findName.mockResolvedValue(null);

      await expect(
        handler.execute(command({ durationMs: 30_000 })),
      ).resolves.toBeUndefined();
      expect(views.save).toHaveBeenCalledTimes(1);
    });

    it('404s when another browser tries to use the view id', async () => {
      await expect(
        handler.execute(command({ visitorId: 'someone-else' })),
      ).rejects.toThrow(NotFoundException);
      expect(views.save).not.toHaveBeenCalled();
    });

    it('404s when the view id is reused for a different product', async () => {
      await expect(
        handler.execute(command({ productId: 'product-2' })),
      ).rejects.toThrow(NotFoundException);
      expect(views.save).not.toHaveBeenCalled();
    });
  });
});
