import { NotFoundException } from '@nestjs/common';
import type { FileStorage } from '@/shared/domain/storage/file-storage.port';
import { createMockFileStorage } from '@/shared/testing/mock-file-storage';
import { Comment } from '@/modules/comments/domain/entities/comment.entity';
import type { CommentRepository } from '@/modules/comments/domain/repositories/comment.repository';
import { createMockCommentRepository } from '@/modules/comments/testing/mock-comment-repository';
import { DeleteCommentCommand } from './delete-comment.command';
import { DeleteCommentHandler } from './delete-comment.handler';

describe('DeleteCommentHandler', () => {
  let repository: jest.Mocked<CommentRepository>;
  let fileStorage: jest.Mocked<FileStorage>;
  let handler: DeleteCommentHandler;

  beforeEach(() => {
    repository = createMockCommentRepository();
    fileStorage = createMockFileStorage();
    handler = new DeleteCommentHandler(repository, fileStorage);
  });

  it('deletes the comment when it belongs to the requesting user', async () => {
    const comment = Comment.create({
      productId: 'product-1',
      userId: 'user-1',
      body: 'hi',
    });
    repository.findById.mockResolvedValue(comment);

    await handler.execute(new DeleteCommentCommand(comment.id, 'user-1'));

    expect(repository.deleteById).toHaveBeenCalledWith(comment.id);
  });

  it('throws NotFoundException when the comment does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new DeleteCommentCommand('missing', 'user-1')),
    ).rejects.toThrow(NotFoundException);
    expect(repository.deleteById).not.toHaveBeenCalled();
  });

  it('throws NotFoundException (not Forbidden) when the comment belongs to another user', async () => {
    const comment = Comment.create({
      productId: 'product-1',
      userId: 'someone-else',
      body: 'hi',
    });
    repository.findById.mockResolvedValue(comment);

    await expect(
      handler.execute(new DeleteCommentCommand(comment.id, 'user-1')),
    ).rejects.toThrow(NotFoundException);
    expect(repository.deleteById).not.toHaveBeenCalled();
    expect(fileStorage.delete).not.toHaveBeenCalled();
  });

  describe('attached images', () => {
    const comment = Comment.create({
      productId: 'product-1',
      userId: 'user-1',
      body: 'hi',
    });
    const images = [
      {
        key: 'comments/a.webp',
        thumbnailKey: 'comments/a-thumb.webp',
        width: 10,
        height: 10,
      },
      {
        key: 'comments/b.webp',
        thumbnailKey: 'comments/b-thumb.webp',
        width: 10,
        height: 10,
      },
    ];

    beforeEach(() => {
      repository.findById.mockResolvedValue(comment);
      repository.findImagesInSubtree.mockResolvedValue(images);
    });

    it('removes every file in the deleted subtree from storage', async () => {
      await handler.execute(new DeleteCommentCommand(comment.id, 'user-1'));

      expect(repository.findImagesInSubtree).toHaveBeenCalledWith(comment.id);
      expect(fileStorage.delete.mock.calls.map(([key]) => key)).toEqual([
        'comments/a.webp',
        'comments/a-thumb.webp',
        'comments/b.webp',
        'comments/b-thumb.webp',
      ]);
    });

    it('reads the image keys before the rows that hold them are deleted', async () => {
      await handler.execute(new DeleteCommentCommand(comment.id, 'user-1'));

      expect(
        repository.findImagesInSubtree.mock.invocationCallOrder[0],
      ).toBeLessThan(repository.deleteById.mock.invocationCallOrder[0]);
    });

    it('still succeeds when storage cannot delete a file', async () => {
      fileStorage.delete.mockRejectedValueOnce(new Error('storage is down'));

      await expect(
        handler.execute(new DeleteCommentCommand(comment.id, 'user-1')),
      ).resolves.toBeUndefined();
      expect(repository.deleteById).toHaveBeenCalledWith(comment.id);
      // One failure must not stop the remaining files being cleaned up.
      expect(fileStorage.delete).toHaveBeenCalledTimes(4);
    });

    it('does not touch storage if the row delete fails', async () => {
      repository.deleteById.mockRejectedValue(new Error('db is down'));

      await expect(
        handler.execute(new DeleteCommentCommand(comment.id, 'user-1')),
      ).rejects.toThrow('db is down');
      expect(fileStorage.delete).not.toHaveBeenCalled();
    });
  });
});
