import { DomainError } from '@/shared/domain/domain-error';
import { MAX_REVIEW_BODY_LENGTH, Review } from './review.entity';

describe('Review', () => {
  const base = { productId: 'product-1', userId: 'user-1' };

  it('creates a rating without a comment', () => {
    const review = Review.create({ ...base, rating: 4 });

    expect(review.rating).toBe(4);
    expect(review.body).toBeNull();
    expect(review.productId).toBe('product-1');
    expect(review.userId).toBe('user-1');
  });

  it('creates a rating with a trimmed comment', () => {
    const review = Review.create({ ...base, rating: 5, body: '  Great tee ' });

    expect(review.body).toBe('Great tee');
  });

  it.each(['', '   ', null, undefined])(
    'treats a blank comment (%p) as no comment',
    (body) => {
      expect(Review.create({ ...base, rating: 3, body }).body).toBeNull();
    },
  );

  it.each([0, 6, -1, 3.5, Number.NaN])('rejects a rating of %p', (rating) => {
    expect(() => Review.create({ ...base, rating })).toThrow(DomainError);
  });

  it.each([1, 2, 3, 4, 5])('accepts a rating of %p', (rating) => {
    expect(Review.create({ ...base, rating }).rating).toBe(rating);
  });

  it('rejects a comment over the length limit', () => {
    expect(() =>
      Review.create({
        ...base,
        rating: 5,
        body: 'a'.repeat(MAX_REVIEW_BODY_LENGTH + 1),
      }),
    ).toThrow(DomainError);
  });

  describe('revise', () => {
    const original = Review.fromPersistence({
      id: 'review-1',
      ...base,
      rating: 2,
      body: 'Runs small',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });

    it('replaces the rating and comment but keeps identity', () => {
      const revised = original.revise({
        rating: 5,
        body: 'Exchanged, perfect',
      });

      expect(revised.rating).toBe(5);
      expect(revised.body).toBe('Exchanged, perfect');
      expect(revised.id).toBe('review-1');
      expect(revised.productId).toBe('product-1');
      expect(revised.userId).toBe('user-1');
      expect(revised.createdAt).toEqual(original.createdAt);
      expect(revised.updatedAt.getTime()).toBeGreaterThan(
        original.updatedAt.getTime(),
      );
    });

    it('removes the comment when the new rating has none', () => {
      expect(original.revise({ rating: 2 }).body).toBeNull();
    });

    it('leaves the original untouched', () => {
      original.revise({ rating: 5 });

      expect(original.rating).toBe(2);
      expect(original.body).toBe('Runs small');
    });

    it('applies the same validation as create', () => {
      expect(() => original.revise({ rating: 9 })).toThrow(DomainError);
    });
  });
});
