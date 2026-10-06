import { DomainError } from '@/shared/domain/domain-error';
import {
  MAX_VIEW_DURATION_MS,
  ProductView,
  StartProductViewInput,
} from './product-view.entity';

function startInput(
  overrides: Partial<StartProductViewInput> = {},
): StartProductViewInput {
  return {
    id: 'view-1',
    productId: 'product-1',
    productName: 'Printed Tee',
    userId: null,
    visitorId: 'visitor-1',
    ipAddress: '203.0.113.7',
    country: 'VE',
    durationMs: 0,
    favorited: false,
    ...overrides,
  };
}

describe('ProductView', () => {
  describe('start', () => {
    it('opens a view with everything it was given', () => {
      const view = ProductView.start(
        startInput({ userId: 'user-1', durationMs: 1500, favorited: true }),
      );

      expect(view.id).toBe('view-1');
      expect(view.productId).toBe('product-1');
      expect(view.productName).toBe('Printed Tee');
      expect(view.userId).toBe('user-1');
      expect(view.visitorId).toBe('visitor-1');
      expect(view.ipAddress).toBe('203.0.113.7');
      expect(view.country).toBe('VE');
      expect(view.durationMs).toBe(1500);
      expect(view.favorited).toBe(true);
      expect(view.lastSeenAt).toEqual(view.startedAt);
    });

    it('allows an anonymous view with no known country', () => {
      const view = ProductView.start(
        startInput({ userId: null, country: null }),
      );

      expect(view.userId).toBeNull();
      expect(view.country).toBeNull();
    });

    it('caps an implausibly long duration instead of rejecting it', () => {
      // A tab left open overnight is still a real visit; it just shouldn't
      // count as nine hours of attention.
      const view = ProductView.start(
        startInput({ durationMs: MAX_VIEW_DURATION_MS + 60_000 }),
      );

      expect(view.durationMs).toBe(MAX_VIEW_DURATION_MS);
    });

    it.each([-1, 1.5, Number.NaN])('rejects a duration of %p', (durationMs) => {
      expect(() => ProductView.start(startInput({ durationMs }))).toThrow(
        DomainError,
      );
    });

    it('rejects a view with no IP address', () => {
      expect(() => ProductView.start(startInput({ ipAddress: '  ' }))).toThrow(
        DomainError,
      );
    });
  });

  describe('progress', () => {
    it('extends the duration and returns a new instance', () => {
      const view = ProductView.start(startInput({ durationMs: 1000 }));

      const updated = view.progress({
        durationMs: 16_000,
        favorited: false,
        userId: null,
      });

      expect(updated).not.toBe(view);
      expect(updated.durationMs).toBe(16_000);
      expect(view.durationMs).toBe(1000);
    });

    it('never shrinks the duration when a stale report arrives late', () => {
      const view = ProductView.start(startInput({ durationMs: 30_000 }));

      const updated = view.progress({
        durationMs: 15_000,
        favorited: false,
        userId: null,
      });

      expect(updated.durationMs).toBe(30_000);
    });

    it('caps the duration on a top-up too', () => {
      const view = ProductView.start(startInput());

      const updated = view.progress({
        durationMs: MAX_VIEW_DURATION_MS * 2,
        favorited: false,
        userId: null,
      });

      expect(updated.durationMs).toBe(MAX_VIEW_DURATION_MS);
    });

    it('follows the favorite state in both directions', () => {
      const view = ProductView.start(startInput({ favorited: false }));

      const saved = view.progress({
        durationMs: 0,
        favorited: true,
        userId: null,
      });
      const removed = saved.progress({
        durationMs: 0,
        favorited: false,
        userId: null,
      });

      expect(saved.favorited).toBe(true);
      expect(removed.favorited).toBe(false);
    });

    it('attaches the user when an anonymous visitor signs in mid-visit', () => {
      const view = ProductView.start(startInput({ userId: null }));

      const updated = view.progress({
        durationMs: 0,
        favorited: false,
        userId: 'user-1',
      });

      expect(updated.userId).toBe('user-1');
    });

    it('keeps the original user if a later report has none or another', () => {
      const view = ProductView.start(startInput({ userId: 'user-1' }));

      const loggedOut = view.progress({
        durationMs: 0,
        favorited: false,
        userId: null,
      });
      const someoneElse = view.progress({
        durationMs: 0,
        favorited: false,
        userId: 'user-2',
      });

      expect(loggedOut.userId).toBe('user-1');
      expect(someoneElse.userId).toBe('user-1');
    });

    it('leaves who, where and which product untouched', () => {
      const view = ProductView.start(startInput());

      const updated = view.progress({
        durationMs: 5000,
        favorited: true,
        userId: null,
      });

      expect(updated.productId).toBe(view.productId);
      expect(updated.visitorId).toBe(view.visitorId);
      expect(updated.ipAddress).toBe(view.ipAddress);
      expect(updated.country).toBe(view.country);
      expect(updated.startedAt).toEqual(view.startedAt);
    });
  });
});
