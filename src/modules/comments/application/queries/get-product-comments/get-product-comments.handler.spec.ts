import type { FileStorage } from '@/shared/domain/storage/file-storage.port';
import { createMockFileStorage } from '@/shared/testing/mock-file-storage';
import type {
  CommentListItem,
  CommentRepository,
} from '@/modules/comments/domain/repositories/comment.repository';
import { createMockCommentRepository } from '@/modules/comments/testing/mock-comment-repository';
import { GetProductCommentsHandler } from './get-product-comments.handler';
import { GetProductCommentsQuery } from './get-product-comments.query';

describe('GetProductCommentsHandler', () => {
  let repository: jest.Mocked<CommentRepository>;
  let fileStorage: jest.Mocked<FileStorage>;
  let handler: GetProductCommentsHandler;

  beforeEach(() => {
    repository = createMockCommentRepository();
    fileStorage = createMockFileStorage();
    handler = new GetProductCommentsHandler(repository, fileStorage);
  });

  const item: CommentListItem = {
    id: 'comment-1',
    productId: 'product-1',
    body: 'hi',
    parentId: null,
    depth: 1,
    author: { id: 'user-1', name: 'Ada', avatarUrl: null },
    likeCount: 0,
    likedByViewer: false,
    image: null,
    createdAt: new Date('2026-01-01'),
  };

  it('resolves stored image keys to public URLs through the storage port', async () => {
    repository.findByProduct.mockResolvedValue([
      {
        ...item,
        image: {
          key: 'comments/a.webp',
          thumbnailKey: 'comments/a-thumb.webp',
          width: 1200,
          height: 800,
        },
      },
    ]);
    repository.countByProduct.mockResolvedValue(1);
    repository.countRootsByProduct.mockResolvedValue(1);

    const result = await handler.execute(
      new GetProductCommentsQuery('product-1'),
    );

    expect(result.items[0].image).toEqual({
      url: 'https://files.test/comments/a.webp',
      thumbnailUrl: 'https://files.test/comments/a-thumb.webp',
      width: 1200,
      height: 800,
    });
  });

  it('leaves a comment without an image as null', async () => {
    repository.findByProduct.mockResolvedValue([item]);
    repository.countByProduct.mockResolvedValue(1);
    repository.countRootsByProduct.mockResolvedValue(1);

    const result = await handler.execute(
      new GetProductCommentsQuery('product-1'),
    );

    expect(result.items[0].image).toBeNull();
    expect(fileStorage.publicUrl).not.toHaveBeenCalled();
  });

  it('paginates using skip/take derived from page and pageSize', async () => {
    repository.findByProduct.mockResolvedValue([item]);
    repository.countByProduct.mockResolvedValue(41);
    repository.countRootsByProduct.mockResolvedValue(12);

    const result = await handler.execute(
      new GetProductCommentsQuery('product-1', 3, 20),
    );

    expect(repository.findByProduct).toHaveBeenCalledWith({
      productId: 'product-1',
      skip: 40,
      take: 20,
      viewerId: undefined,
    });
    expect(repository.countByProduct).toHaveBeenCalledWith('product-1');
    expect(result).toEqual({
      items: [item],
      total: 41,
      rootTotal: 12,
      page: 3,
      pageSize: 20,
    });
  });

  it('defaults to page 1 and pageSize 20', async () => {
    repository.findByProduct.mockResolvedValue([]);
    repository.countByProduct.mockResolvedValue(0);
    repository.countRootsByProduct.mockResolvedValue(0);

    await handler.execute(new GetProductCommentsQuery('product-1'));

    expect(repository.findByProduct).toHaveBeenCalledWith({
      productId: 'product-1',
      skip: 0,
      take: 20,
      viewerId: undefined,
    });
  });

  it('clamps a page of 0 or negative back to page 1', async () => {
    repository.findByProduct.mockResolvedValue([]);
    repository.countByProduct.mockResolvedValue(0);
    repository.countRootsByProduct.mockResolvedValue(0);

    await handler.execute(new GetProductCommentsQuery('product-1', 0));
    expect(repository.findByProduct).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0 }),
    );

    await handler.execute(new GetProductCommentsQuery('product-1', -5));
    expect(repository.findByProduct).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0 }),
    );
  });

  it('caps an oversized pageSize at 100', async () => {
    repository.findByProduct.mockResolvedValue([]);
    repository.countByProduct.mockResolvedValue(0);
    repository.countRootsByProduct.mockResolvedValue(0);

    await handler.execute(new GetProductCommentsQuery('product-1', 1, 10_000));

    expect(repository.findByProduct).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });
});
