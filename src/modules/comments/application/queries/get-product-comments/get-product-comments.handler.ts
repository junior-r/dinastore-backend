import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { FILE_STORAGE } from '@/shared/domain/storage/file-storage.port';
import type { FileStorage } from '@/shared/domain/storage/file-storage.port';
import { COMMENT_REPOSITORY } from '@/modules/comments/domain/repositories/comment.repository';
import type {
  CommentListItem,
  CommentRepository,
} from '@/modules/comments/domain/repositories/comment.repository';
import { GetProductCommentsQuery } from './get-product-comments.query';

/** What a reader needs to display a comment's image — URLs, not keys. */
export interface CommentImageView {
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
}

export type CommentView = Omit<CommentListItem, 'image'> & {
  image: CommentImageView | null;
};

export interface PaginatedComments {
  /** A page of root comments, each followed by all of its descendants. */
  items: CommentView[];
  /** Every comment on the product, replies included — what the UI displays. */
  total: number;
  /** Root comments only — what `page`/`pageSize` index into. */
  rootTotal: number;
  page: number;
  pageSize: number;
}

@QueryHandler(GetProductCommentsQuery)
export class GetProductCommentsHandler implements IQueryHandler<
  GetProductCommentsQuery,
  PaginatedComments
> {
  constructor(
    @Inject(COMMENT_REPOSITORY)
    private readonly commentRepository: CommentRepository,
    @Inject(FILE_STORAGE)
    private readonly fileStorage: FileStorage,
  ) {}

  async execute(query: GetProductCommentsQuery): Promise<PaginatedComments> {
    const skip = (query.page - 1) * query.pageSize;

    const [items, total, rootTotal] = await Promise.all([
      this.commentRepository.findByProduct({
        productId: query.productId,
        skip,
        take: query.pageSize,
        viewerId: query.viewerId,
      }),
      this.commentRepository.countByProduct(query.productId),
      this.commentRepository.countRootsByProduct(query.productId),
    ]);

    return {
      // Keys become URLs here, at read time, so whichever storage backend is
      // configured *now* decides where the browser is sent — nothing about
      // the location is baked into the stored rows.
      items: items.map((item) => ({
        ...item,
        image: item.image && {
          url: this.fileStorage.publicUrl(item.image.key),
          thumbnailUrl: this.fileStorage.publicUrl(item.image.thumbnailKey),
          width: item.image.width,
          height: item.image.height,
        },
      })),
      total,
      rootTotal,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
