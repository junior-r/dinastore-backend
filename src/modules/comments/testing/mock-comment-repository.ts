import type { CommentRepository } from '../domain/repositories/comment.repository';

export function createMockCommentRepository(): jest.Mocked<CommentRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    deleteById: jest.fn(),
    findImagesInSubtree: jest.fn().mockResolvedValue([]),
    findByProduct: jest.fn(),
    countByProduct: jest.fn(),
    countRootsByProduct: jest.fn(),
  };
}
