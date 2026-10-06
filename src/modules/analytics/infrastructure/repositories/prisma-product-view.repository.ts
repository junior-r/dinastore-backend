import { Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import { PRISMA_ERROR } from '@/shared/infrastructure/prisma/prisma-error-codes';
import { PrismaService } from '@/shared/infrastructure/prisma/prisma.service';
import { ProductView } from '@/modules/analytics/domain/entities/product-view.entity';
import {
  ProductViewFilter,
  ProductViewListItem,
  ProductViewRepository,
} from '@/modules/analytics/domain/repositories/product-view.repository';

type ProductViewRecord = Prisma.ProductViewGetPayload<object>;

function toDomain(record: ProductViewRecord): ProductView {
  return ProductView.fromPersistence({
    id: record.id,
    productId: record.productId,
    productName: record.productName,
    userId: record.userId,
    visitorId: record.visitorId,
    ipAddress: record.ipAddress,
    country: record.country,
    durationMs: record.durationMs,
    favorited: record.favorited,
    startedAt: record.startedAt,
    lastSeenAt: record.lastSeenAt,
  });
}

@Injectable()
export class PrismaProductViewRepository implements ProductViewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ProductView | null> {
    const record = await this.prisma.productView.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async save(view: ProductView): Promise<void> {
    // The only fields a visit can change after it opens. Everything else on
    // the row is written once, in `create`.
    const progress = {
      durationMs: view.durationMs,
      favorited: view.favorited,
      userId: view.userId,
    };

    try {
      await this.prisma.productView.upsert({
        where: { id: view.id },
        create: {
          id: view.id,
          productId: view.productId,
          productName: view.productName,
          visitorId: view.visitorId,
          ipAddress: view.ipAddress,
          country: view.country,
          startedAt: view.startedAt,
          ...progress,
        },
        update: progress,
      });
    } catch (error) {
      // Same race as PrismaCommentLikeRepository.like: Prisma's upsert reads
      // then writes, so a page's opening report and its first heartbeat can
      // both find no row and both insert. The loser gets P2002, and the row
      // it collided with is the one it wanted, so it applies its progress to
      // that row instead of failing a request that did nothing wrong.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_ERROR.UNIQUE_CONSTRAINT
      ) {
        await this.prisma.productView.update({
          where: { id: view.id },
          data: progress,
        });
        return;
      }
      throw error;
    }
  }

  async findMany(
    filter: ProductViewFilter & { skip: number; take: number },
  ): Promise<ProductViewListItem[]> {
    const records = await this.prisma.productView.findMany({
      where: this.where(filter),
      orderBy: { startedAt: 'desc' },
      skip: filter.skip,
      take: filter.take,
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: { select: { slug: true } },
      },
    });

    return records.map((record) => ({
      view: toDomain(record),
      user: record.user,
      productSlug: record.product?.slug ?? null,
    }));
  }

  async count(filter: ProductViewFilter): Promise<number> {
    return this.prisma.productView.count({ where: this.where(filter) });
  }

  private where(filter: ProductViewFilter): Prisma.ProductViewWhereInput {
    return filter.productId ? { productId: filter.productId } : {};
  }
}
