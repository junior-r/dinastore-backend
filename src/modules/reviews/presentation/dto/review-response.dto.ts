import { Review } from '@/modules/reviews/domain/entities/review.entity';
import type {
  ReviewAuthor,
  ReviewListItem,
} from '@/modules/reviews/domain/repositories/review.repository';

export class ReviewResponseDto {
  id: string;
  productId: string;
  rating: number;
  body: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Only set on the list (fromListItem). A review returned on its own is
  // always the caller's, and the frontend already knows who that is.
  author?: ReviewAuthor;

  static fromDomain(review: Review): ReviewResponseDto {
    const dto = new ReviewResponseDto();
    dto.id = review.id;
    dto.productId = review.productId;
    dto.rating = review.rating;
    dto.body = review.body;
    dto.createdAt = review.createdAt;
    dto.updatedAt = review.updatedAt;
    return dto;
  }

  static fromListItem(item: ReviewListItem): ReviewResponseDto {
    const dto = new ReviewResponseDto();
    dto.id = item.id;
    dto.productId = item.productId;
    dto.rating = item.rating;
    dto.body = item.body;
    dto.createdAt = item.createdAt;
    dto.updatedAt = item.updatedAt;
    dto.author = item.author;
    return dto;
  }
}
