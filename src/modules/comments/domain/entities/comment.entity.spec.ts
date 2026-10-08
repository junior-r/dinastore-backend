import { DomainError } from '@/shared/domain/domain-error';
import { Comment } from './comment.entity';

describe('Comment entity', () => {
  const validProps = {
    productId: 'product-1',
    userId: 'user-1',
    body: 'Great product, fits perfectly!',
  };

  describe('create', () => {
    it('creates a comment with a generated id and createdAt', () => {
      const comment = Comment.create(validProps);

      expect(comment.id).toEqual(expect.any(String));
      expect(comment.productId).toBe('product-1');
      expect(comment.userId).toBe('user-1');
      expect(comment.body).toBe(validProps.body);
      expect(comment.createdAt).toBeInstanceOf(Date);
    });

    it('trims the body', () => {
      const comment = Comment.create({ ...validProps, body: '  hi  ' });
      expect(comment.body).toBe('hi');
    });

    it('rejects an empty body', () => {
      expect(() => Comment.create({ ...validProps, body: '   ' })).toThrow(
        DomainError,
      );
      expect(() => Comment.create({ ...validProps, body: '   ' })).toThrow(
        'Comment body cannot be empty',
      );
    });

    it('rejects a body longer than 1000 characters', () => {
      expect(() =>
        Comment.create({ ...validProps, body: 'a'.repeat(1001) }),
      ).toThrow('Comment body cannot exceed 1000 characters');
    });

    it('accepts a body exactly at the 1000 character limit', () => {
      const comment = Comment.create({ ...validProps, body: 'a'.repeat(1000) });
      expect(comment.body).toHaveLength(1000);
    });
  });

  describe('image', () => {
    const image = {
      key: 'comments/a.webp',
      thumbnailKey: 'comments/a-thumb.webp',
      width: 1200,
      height: 800,
    };

    it('has no image unless one is given', () => {
      expect(Comment.create(validProps).image).toBeNull();
    });

    it('carries the image on a root comment', () => {
      expect(Comment.create({ ...validProps, image }).image).toEqual(image);
    });

    it('carries the image on a reply, without inheriting the parent one', () => {
      const parent = Comment.create({ ...validProps, image });

      expect(parent.reply({ userId: 'user-2', body: 'Nice' }).image).toBeNull();
      expect(
        parent.reply({ userId: 'user-2', body: 'Nice', image }).image,
      ).toEqual(image);
    });
  });

  describe('belongsTo', () => {
    it('returns true only for the comment author', () => {
      const comment = Comment.create(validProps);
      expect(comment.belongsTo('user-1')).toBe(true);
      expect(comment.belongsTo('someone-else')).toBe(false);
    });
  });

  describe('reply', () => {
    const root = () => Comment.create(validProps);

    it('nests one level below its parent and inherits the product', () => {
      const reply = root().reply({ userId: 'user-2', body: 'Agreed' });

      expect(reply.depth).toBe(2);
      expect(reply.productId).toBe('product-1');
      expect(reply.userId).toBe('user-2');
    });

    it('points at its parent', () => {
      const parent = root();
      const reply = parent.reply({ userId: 'user-2', body: 'Agreed' });

      expect(reply.parentId).toBe(parent.id);
    });

    it('reaches depth 3 after two replies', () => {
      const level2 = root().reply({ userId: 'user-2', body: 'Agreed' });
      const level3 = level2.reply({ userId: 'user-3', body: 'Same here' });

      expect(level3.depth).toBe(3);
      expect(level3.parentId).toBe(level2.id);
    });

    it('flattens a reply to a depth-3 comment alongside it, not below', () => {
      const level2 = root().reply({ userId: 'user-2', body: 'Agreed' });
      const level3 = level2.reply({ userId: 'user-3', body: 'Same here' });

      const level3again = level3.reply({ userId: 'user-4', body: 'Me too' });

      expect(level3again.depth).toBe(3);
      // Re-parented to level3's own parent, so it renders as a sibling.
      expect(level3again.parentId).toBe(level2.id);
      expect(level3again.parentId).not.toBe(level3.id);
    });

    it('never exceeds depth 3 however many times it is replied to', () => {
      let comment = root();
      for (let i = 0; i < 10; i += 1) {
        comment = comment.reply({ userId: 'user-x', body: 'again' });
      }

      expect(comment.depth).toBe(3);
    });

    it('validates the reply body like any other comment', () => {
      expect(() => root().reply({ userId: 'user-2', body: '   ' })).toThrow(
        DomainError,
      );
      expect(() =>
        root().reply({ userId: 'user-2', body: 'a'.repeat(1001) }),
      ).toThrow(DomainError);
    });
  });

  describe('fromPersistence / toPersistenceProps', () => {
    it('round-trips props without mutation', () => {
      const props = {
        id: 'comment-1',
        productId: 'product-1',
        userId: 'user-1',
        body: 'Nice',
        parentId: null,
        depth: 1,
        image: null,
        createdAt: new Date('2026-01-01'),
      };

      const comment = Comment.fromPersistence(props);

      expect(comment.toPersistenceProps()).toEqual(props);
    });
  });
});
