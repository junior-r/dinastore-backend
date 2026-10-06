import { Comment } from '@/modules/comments/domain/entities/comment.entity';
import type {
  CommentImageView,
  CommentView,
} from '@/modules/comments/application/queries/get-product-comments/get-product-comments.handler';

export class CommentResponseDto {
  id: string;
  productId: string;
  body: string;
  parentId: string | null;
  depth: number;
  createdAt: Date;
  // Only set on the GET list (fromListItem) — the create response would
  // need an extra DB round trip to join the author, and the frontend
  // already knows the current user, so it just refetches the list instead.
  author?: { id: string; name: string; avatarUrl: string | null };
  userId?: string;
  // Same reasoning: a freshly created comment has no likes yet, so the
  // create response carries the resting values rather than querying for them.
  likeCount: number;
  likedByViewer: boolean;
  // Also list-only, like `author`: the entity holds storage keys, and turning
  // those into URLs is the read side's job. `hasImage` is what the create
  // response reports instead.
  image?: CommentImageView | null;
  hasImage: boolean;

  static fromDomain(comment: Comment): CommentResponseDto {
    const dto = new CommentResponseDto();
    dto.id = comment.id;
    dto.productId = comment.productId;
    dto.body = comment.body;
    dto.parentId = comment.parentId;
    dto.depth = comment.depth;
    dto.createdAt = comment.createdAt;
    dto.userId = comment.userId;
    dto.likeCount = 0;
    dto.likedByViewer = false;
    dto.hasImage = comment.image !== null;
    return dto;
  }

  static fromListItem(item: CommentView): CommentResponseDto {
    const dto = new CommentResponseDto();
    dto.id = item.id;
    dto.productId = item.productId;
    dto.body = item.body;
    dto.parentId = item.parentId;
    dto.depth = item.depth;
    dto.createdAt = item.createdAt;
    dto.author = item.author;
    dto.likeCount = item.likeCount;
    dto.likedByViewer = item.likedByViewer;
    dto.image = item.image;
    dto.hasImage = item.image !== null;
    return dto;
  }
}
