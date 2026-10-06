import { Comment, CommentImage } from '../entities/comment.entity';

export const COMMENT_REPOSITORY = Symbol('COMMENT_REPOSITORY');

export interface CommentAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
}

// A read-side projection (author joined in), distinct from the Comment
// aggregate — User doesn't belong to Comment's own aggregate, so this is
// assembled by the repository for the list query rather than living on the
// domain entity itself. The same goes for likeCount/likedByViewer: likes are
// their own table, aggregated here for the read model only.
export interface CommentListItem {
  id: string;
  productId: string;
  body: string;
  parentId: string | null;
  depth: number;
  author: CommentAuthor;
  likeCount: number;
  likedByViewer: boolean;
  image: CommentImage | null;
  createdAt: Date;
}

export interface FindCommentsParams {
  productId: string;
  skip?: number;
  take?: number;
  // Whose likes to resolve `likedByViewer` against. Undefined for an
  // anonymous reader, who still sees counts but never a filled heart.
  viewerId?: string;
}

export interface CommentRepository {
  create(comment: Comment): Promise<Comment>;
  findById(id: string): Promise<Comment | null>;
  deleteById(id: string): Promise<void>;
  /**
   * Images attached to this comment **and to every reply beneath it** — a
   * delete cascades through the subtree, so these are the files that become
   * orphaned by it and have to be removed from storage alongside.
   */
  findImagesInSubtree(id: string): Promise<CommentImage[]>;
  /**
   * Returns the page's **root** comments plus every descendant of those
   * roots, newest root first. Pagination applies to roots only — a thread is
   * never split across pages.
   */
  findByProduct(params: FindCommentsParams): Promise<CommentListItem[]>;
  /** Every comment on the product, replies included — the displayed total. */
  countByProduct(productId: string): Promise<number>;
  /** Root comments only — what `page`/`pageSize` actually index into. */
  countRootsByProduct(productId: string): Promise<number>;
}
