import type { ReviewRepository } from '../domain/repositories/review.repository';

export function createMockReviewRepository(): jest.Mocked<ReviewRepository> {
  return {
    save: jest.fn((review) => Promise.resolve(review)),
    findByProductAndUser: jest.fn().mockResolvedValue(null),
    deleteByProductAndUser: jest.fn(),
    findWrittenByProduct: jest.fn().mockResolvedValue([]),
    countWrittenByProduct: jest.fn().mockResolvedValue(0),
    summarize: jest.fn(),
  };
}
