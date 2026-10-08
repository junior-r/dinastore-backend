import { NotFoundException } from '@nestjs/common';
import { DomainError } from '@/shared/domain/domain-error';
import {
  InvalidImageError,
  type ImageProcessor,
} from '@/shared/domain/images/image-processor.port';
import type { FileStorage } from '@/shared/domain/storage/file-storage.port';
import { createMockFileStorage } from '@/shared/testing/mock-file-storage';
import { createMockImageProcessor } from '@/shared/testing/mock-image-processor';
import { Comment } from '@/modules/comments/domain/entities/comment.entity';
import type { ProductLookupPort } from '@/modules/comments/domain/ports/product-lookup.port';
import type { CommentRepository } from '@/modules/comments/domain/repositories/comment.repository';
import type { CommentModerationPort } from '@/modules/comments/domain/services/comment-moderation.port';
import { createMockCommentModeration } from '@/modules/comments/testing/mock-comment-moderation';
import { createMockCommentRepository } from '@/modules/comments/testing/mock-comment-repository';
import { createMockProductLookup } from '@/modules/comments/testing/mock-product-lookup';
import { CreateCommentCommand } from './create-comment.command';
import { CreateCommentHandler } from './create-comment.handler';

describe('CreateCommentHandler', () => {
  let repository: jest.Mocked<CommentRepository>;
  let productLookup: jest.Mocked<ProductLookupPort>;
  let moderation: jest.Mocked<CommentModerationPort>;
  let imageProcessor: jest.Mocked<ImageProcessor>;
  let fileStorage: jest.Mocked<FileStorage>;
  let handler: CreateCommentHandler;

  beforeEach(() => {
    repository = createMockCommentRepository();
    productLookup = createMockProductLookup();
    moderation = createMockCommentModeration();
    imageProcessor = createMockImageProcessor();
    fileStorage = createMockFileStorage();
    handler = new CreateCommentHandler(
      repository,
      productLookup,
      moderation,
      imageProcessor,
      fileStorage,
    );
  });

  it('creates and persists a comment when the product exists and moderation allows it', async () => {
    productLookup.exists.mockResolvedValue(true);
    repository.create.mockImplementation((comment) => Promise.resolve(comment));

    const result = await handler.execute(
      new CreateCommentCommand('product-1', 'user-1', 'Great fit!'),
    );

    expect(productLookup.exists).toHaveBeenCalledWith('product-1');
    expect(moderation.review).toHaveBeenCalledWith('Great fit!');
    expect(repository.create).toHaveBeenCalledWith(expect.any(Comment));
    expect(result.productId).toBe('product-1');
    expect(result.userId).toBe('user-1');
    expect(result.body).toBe('Great fit!');
  });

  it('throws NotFoundException when the product does not exist', async () => {
    productLookup.exists.mockResolvedValue(false);

    await expect(
      handler.execute(new CreateCommentCommand('missing', 'user-1', 'hi')),
    ).rejects.toThrow(NotFoundException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('throws DomainError with the moderation reason when the body is rejected', async () => {
    productLookup.exists.mockResolvedValue(true);
    moderation.review.mockResolvedValue({
      allowed: false,
      reason: 'Please keep comments respectful.',
    });

    await expect(
      handler.execute(new CreateCommentCommand('product-1', 'user-1', 'rude')),
    ).rejects.toThrow(DomainError);
    await expect(
      handler.execute(new CreateCommentCommand('product-1', 'user-1', 'rude')),
    ).rejects.toThrow('Please keep comments respectful.');
    expect(repository.create).not.toHaveBeenCalled();
  });
  describe('image attachment', () => {
    const upload = Buffer.from('raw upload bytes');

    beforeEach(() => {
      productLookup.exists.mockResolvedValue(true);
      repository.create.mockImplementation((comment) =>
        Promise.resolve(comment),
      );
    });

    it('does no image work for a text-only comment', async () => {
      const result = await handler.execute(
        new CreateCommentCommand('product-1', 'user-1', 'Great fit!'),
      );

      expect(result.image).toBeNull();
      expect(imageProcessor.optimize).not.toHaveBeenCalled();
      expect(fileStorage.put).not.toHaveBeenCalled();
    });

    it('stores an optimized full image and thumbnail and records their keys', async () => {
      const result = await handler.execute(
        new CreateCommentCommand('product-1', 'user-1', 'Look!', null, upload),
      );

      expect(imageProcessor.optimize).toHaveBeenCalledTimes(1);
      expect(imageProcessor.optimize.mock.calls[0][0]).toBe(upload);

      expect(result.image?.key).toMatch(/^comments\/[0-9a-f-]{36}\.webp$/);
      expect(result.image?.thumbnailKey).toMatch(
        /^comments\/[0-9a-f-]{36}-thumb\.webp$/,
      );
      expect(result.image).toMatchObject({ width: 1600, height: 1600 });

      // What reaches storage is the processor output, never the raw upload.
      expect(fileStorage.put).toHaveBeenCalledTimes(2);
      for (const [key, data, options] of fileStorage.put.mock.calls) {
        expect([result.image?.key, result.image?.thumbnailKey]).toContain(key);
        expect(data).not.toBe(upload);
        expect(options).toEqual({
          contentType: 'image/webp',
          cacheControl: 'public, max-age=31536000, immutable',
        });
      }
    });

    it('uses a fresh key for every upload so stored files are never overwritten', async () => {
      const command = () =>
        new CreateCommentCommand('product-1', 'user-1', 'Look!', null, upload);

      const first = await handler.execute(command());
      const second = await handler.execute(command());

      expect(first.image?.key).not.toBe(second.image?.key);
    });

    it('attaches an image to a reply too', async () => {
      const parent = Comment.create({
        productId: 'product-1',
        userId: 'author-1',
        body: 'Root',
      });
      repository.findById.mockResolvedValue(parent);

      const result = await handler.execute(
        new CreateCommentCommand(
          'product-1',
          'user-2',
          'Mine too',
          parent.id,
          upload,
        ),
      );

      expect(result.parentId).toBe(parent.id);
      expect(result.image).not.toBeNull();
    });

    it('rejects a file that is not a usable image, storing nothing', async () => {
      imageProcessor.optimize.mockRejectedValue(new InvalidImageError());

      await expect(
        handler.execute(
          new CreateCommentCommand(
            'product-1',
            'user-1',
            'Look!',
            null,
            upload,
          ),
        ),
      ).rejects.toThrow(InvalidImageError);
      expect(fileStorage.put).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('never processes the image when the text fails moderation', async () => {
      moderation.review.mockResolvedValue({ allowed: false, reason: 'nope' });

      await expect(
        handler.execute(
          new CreateCommentCommand('product-1', 'user-1', 'rude', null, upload),
        ),
      ).rejects.toThrow(DomainError);
      expect(imageProcessor.optimize).not.toHaveBeenCalled();
      expect(fileStorage.put).not.toHaveBeenCalled();
    });

    it('removes the stored files again if the comment cannot be saved', async () => {
      repository.create.mockRejectedValue(new Error('db is down'));

      await expect(
        handler.execute(
          new CreateCommentCommand(
            'product-1',
            'user-1',
            'Look!',
            null,
            upload,
          ),
        ),
      ).rejects.toThrow('db is down');

      const stored = fileStorage.put.mock.calls.map(([key]) => key).sort();
      const removed = fileStorage.delete.mock.calls.map(([key]) => key).sort();
      expect(stored).toHaveLength(2);
      expect(removed).toEqual(stored);
    });

    it('removes a half-stored image if one of the two uploads fails', async () => {
      fileStorage.put
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('storage is down'));

      await expect(
        handler.execute(
          new CreateCommentCommand(
            'product-1',
            'user-1',
            'Look!',
            null,
            upload,
          ),
        ),
      ).rejects.toThrow('storage is down');

      expect(fileStorage.delete).toHaveBeenCalledTimes(2);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('replies', () => {
    const parent = Comment.create({
      productId: 'product-1',
      userId: 'author-1',
      body: 'Root comment',
    });

    beforeEach(() => {
      productLookup.exists.mockResolvedValue(true);
      repository.create.mockImplementation((comment) =>
        Promise.resolve(comment),
      );
    });

    it('attaches a reply to its parent one level down', async () => {
      repository.findById.mockResolvedValue(parent);

      const result = await handler.execute(
        new CreateCommentCommand('product-1', 'user-2', 'Agreed', parent.id),
      );

      expect(result.parentId).toBe(parent.id);
      expect(result.depth).toBe(2);
    });

    it('404s when the parent does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        handler.execute(
          new CreateCommentCommand('product-1', 'user-2', 'Agreed', 'missing'),
        ),
      ).rejects.toThrow(NotFoundException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('404s when the parent belongs to a different product', async () => {
      repository.findById.mockResolvedValue(
        Comment.create({
          productId: 'product-2',
          userId: 'author-1',
          body: 'Elsewhere',
        }),
      );

      await expect(
        handler.execute(
          new CreateCommentCommand('product-1', 'user-2', 'Agreed', 'other'),
        ),
      ).rejects.toThrow(NotFoundException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('still moderates a reply body', async () => {
      repository.findById.mockResolvedValue(parent);
      moderation.review.mockResolvedValue({ allowed: false, reason: 'nope' });

      await expect(
        handler.execute(
          new CreateCommentCommand('product-1', 'user-2', 'rude', parent.id),
        ),
      ).rejects.toThrow(DomainError);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });
});
