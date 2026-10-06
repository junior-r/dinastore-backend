import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/shared/infrastructure/prisma/prisma.service';
import { Comment } from '@/modules/comments/domain/entities/comment.entity';
import type { CommentImage } from '@/modules/comments/domain/entities/comment.entity';
import {
  CommentListItem,
  CommentRepository,
  FindCommentsParams,
} from '@/modules/comments/domain/repositories/comment.repository';

const authorInclude = {
  select: { id: true, name: true, avatarUrl: true },
} as const;

interface ImageColumns {
  imageKey: string | null;
  imageThumbnailKey: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
}

// The four columns are written together or not at all; a row missing any of
// them is treated as having no image rather than a half-described one.
function toImage(record: ImageColumns): CommentImage | null {
  if (
    record.imageKey === null ||
    record.imageThumbnailKey === null ||
    record.imageWidth === null ||
    record.imageHeight === null
  ) {
    return null;
  }
  return {
    key: record.imageKey,
    thumbnailKey: record.imageThumbnailKey,
    width: record.imageWidth,
    height: record.imageHeight,
  };
}

function toDomain(
  record: ImageColumns & {
    id: string;
    productId: string;
    userId: string;
    body: string;
    parentId: string | null;
    depth: number;
    createdAt: Date;
  },
): Comment {
  return Comment.fromPersistence({
    id: record.id,
    productId: record.productId,
    userId: record.userId,
    body: record.body,
    parentId: record.parentId,
    depth: record.depth,
    image: toImage(record),
    createdAt: record.createdAt,
  });
}

@Injectable()
export class PrismaCommentRepository implements CommentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(comment: Comment): Promise<Comment> {
    const props = comment.toPersistenceProps();
    const record = await this.prisma.comment.create({
      data: {
        id: props.id,
        productId: props.productId,
        userId: props.userId,
        body: props.body,
        parentId: props.parentId,
        depth: props.depth,
        imageKey: props.image?.key ?? null,
        imageThumbnailKey: props.image?.thumbnailKey ?? null,
        imageWidth: props.image?.width ?? null,
        imageHeight: props.image?.height ?? null,
      },
    });
    return toDomain(record);
  }

  async findById(id: string): Promise<Comment | null> {
    const record = await this.prisma.comment.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.comment.delete({ where: { id } });
  }

  async findImagesInSubtree(id: string): Promise<CommentImage[]> {
    // Same two-hop walk as findByProduct: depth is capped at 3, so the
    // comment's entire subtree is its children and their children.
    const children = await this.prisma.comment.findMany({
      where: { parentId: id },
      select: { id: true },
    });
    const childIds = children.map((child) => child.id);

    const records = await this.prisma.comment.findMany({
      where: {
        imageKey: { not: null },
        OR: [{ id }, { parentId: { in: [id, ...childIds] } }],
      },
      select: {
        imageKey: true,
        imageThumbnailKey: true,
        imageWidth: true,
        imageHeight: true,
      },
    });

    return records
      .map((record) => toImage(record))
      .filter((image): image is CommentImage => image !== null);
  }

  async findByProduct(params: FindCommentsParams): Promise<CommentListItem[]> {
    // Two queries rather than one nested `include` three levels deep: the
    // page is defined by its roots, and the descendant fetch is a single
    // flat read the client re-nests. Threads stay whole across pagination
    // because replies are selected by root membership, not by offset.
    const roots = await this.prisma.comment.findMany({
      where: { productId: params.productId, parentId: null },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
    });

    if (roots.length === 0) {
      return [];
    }

    const rootIds = roots.map((root) => root.id);
    // Depth is capped at 3, so a root's whole subtree is reachable in two
    // further hops — no recursive CTE needed.
    const children = await this.prisma.comment.findMany({
      where: { parentId: { in: rootIds } },
      select: { id: true },
    });
    const grandchildren = await this.prisma.comment.findMany({
      where: { parentId: { in: children.map((child) => child.id) } },
      select: { id: true },
    });

    const ids = [
      ...rootIds,
      ...children.map((child) => child.id),
      ...grandchildren.map((grandchild) => grandchild.id),
    ];

    const records = await this.prisma.comment.findMany({
      where: { id: { in: ids } },
      include: {
        user: authorInclude,
        _count: { select: { likes: true } },
        // An empty relation filter for an anonymous reader would match every
        // like row, so skip the join entirely and treat it as "liked by
        // nobody" below.
        likes: params.viewerId
          ? { where: { userId: params.viewerId }, select: { userId: true } }
          : false,
      },
      // Roots newest-first (the page order), replies oldest-first so a
      // conversation reads top to bottom.
      orderBy: { createdAt: 'asc' },
    });

    const byId = new Map(
      records.map((record) => [
        record.id,
        {
          id: record.id,
          productId: record.productId,
          body: record.body,
          parentId: record.parentId,
          depth: record.depth,
          author: {
            id: record.user.id,
            name: record.user.name,
            avatarUrl: record.user.avatarUrl,
          },
          likeCount: record._count.likes,
          likedByViewer: Array.isArray(record.likes)
            ? record.likes.length > 0
            : false,
          image: toImage(record),
          createdAt: record.createdAt,
        } satisfies CommentListItem,
      ]),
    );

    // Emit each root (in the page's newest-first order) immediately followed
    // by its subtree, so the client can render by walking the array once.
    const ordered: CommentListItem[] = [];
    const childrenByParent = new Map<string, CommentListItem[]>();
    for (const item of byId.values()) {
      if (!item.parentId) continue;
      const siblings = childrenByParent.get(item.parentId) ?? [];
      siblings.push(item);
      childrenByParent.set(item.parentId, siblings);
    }

    const push = (item: CommentListItem): void => {
      ordered.push(item);
      for (const child of childrenByParent.get(item.id) ?? []) {
        push(child);
      }
    };
    for (const rootId of rootIds) {
      const root = byId.get(rootId);
      if (root) push(root);
    }

    return ordered;
  }

  async countByProduct(productId: string): Promise<number> {
    return this.prisma.comment.count({ where: { productId } });
  }

  async countRootsByProduct(productId: string): Promise<number> {
    return this.prisma.comment.count({
      where: { productId, parentId: null },
    });
  }
}
