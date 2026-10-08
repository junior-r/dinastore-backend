import { Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import { PRISMA_ERROR } from '@/shared/infrastructure/prisma/prisma-error-codes';
import { PrismaService } from '@/shared/infrastructure/prisma/prisma.service';
import { ProductView } from '@/modules/analytics/domain/entities/product-view.entity';
import type {
  CountryViews,
  DailyViews,
  ProductViewGroup,
  ProductWindowCounts,
  ViewTotals,
  VisitorViewGroup,
} from '@/modules/analytics/domain/product-view-stats';
import {
  PageWindow,
  ProductViewFilter,
  ProductViewListItem,
  ProductViewRepository,
  UNKNOWN_COUNTRY,
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
    filter: ProductViewFilter & PageWindow,
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

  async totals(filter: ProductViewFilter): Promise<ViewTotals> {
    const [row] = await this.prisma.$queryRaw<
      {
        views: bigint;
        visitors: bigint;
        products: bigint;
        duration: bigint | null;
        favorites: bigint;
      }[]
    >`
      SELECT count(*) AS views,
             count(DISTINCT v.visitor_id) AS visitors,
             count(DISTINCT coalesce(v.product_id, v.product_name)) AS products,
             sum(v.duration_ms) AS duration,
             count(*) FILTER (WHERE v.favorited) AS favorites
      ${FROM_VIEWS}
      WHERE ${whereSql(filter)}`;

    return {
      views: Number(row.views),
      visitors: Number(row.visitors),
      products: Number(row.products),
      totalDurationMs: Number(row.duration ?? 0),
      favorites: Number(row.favorites),
    };
  }

  async daily(
    filter: ProductViewFilter,
    tzOffsetMinutes: number,
  ): Promise<DailyViews[]> {
    // Shifting the stored UTC time by the viewer's offset before truncating
    // is what makes a "day" their day rather than a UTC one.
    const rows = await this.prisma.$queryRaw<
      { day: string; views: bigint; visitors: bigint; duration: bigint }[]
    >`
      SELECT to_char(
               date_trunc('day', v.started_at - make_interval(mins => ${tzOffsetMinutes}::int)),
               'YYYY-MM-DD'
             ) AS day,
             count(*) AS views,
             count(DISTINCT v.visitor_id) AS visitors,
             sum(v.duration_ms) AS duration
      ${FROM_VIEWS}
      WHERE ${whereSql(filter)}
      GROUP BY 1
      ORDER BY 1`;

    return rows.map((row) => ({
      day: row.day,
      views: Number(row.views),
      visitors: Number(row.visitors),
      durationMs: Number(row.duration),
    }));
  }

  async byCountry(filter: ProductViewFilter): Promise<CountryViews[]> {
    const rows = await this.prisma.$queryRaw<
      { country: string | null; views: bigint }[]
    >`
      SELECT v.country AS country, count(*) AS views
      ${FROM_VIEWS}
      WHERE ${whereSql(filter)}
      GROUP BY v.country
      ORDER BY views DESC, v.country ASC NULLS LAST`;

    return rows.map((row) => ({
      country: row.country,
      views: Number(row.views),
    }));
  }

  async groupByProduct(
    filter: ProductViewFilter & PageWindow,
  ): Promise<ProductViewGroup[]> {
    const rows = await this.prisma.$queryRaw<
      {
        product_id: string | null;
        product_name: string;
        product_slug: string | null;
        views: bigint;
        visitors: bigint;
        duration: bigint;
        favorites: bigint;
        last_viewed_at: Date;
      }[]
    >`
      SELECT v.product_id AS product_id,
             coalesce(p.name, max(v.product_name)) AS product_name,
             p.slug AS product_slug,
             count(*) AS views,
             count(DISTINCT v.visitor_id) AS visitors,
             sum(v.duration_ms) AS duration,
             count(*) FILTER (WHERE v.favorited) AS favorites,
             max(v.started_at) AS last_viewed_at
      ${FROM_VIEWS}
      WHERE ${whereSql(filter)}
      GROUP BY ${PRODUCT_GROUP}
      ORDER BY views DESC, last_viewed_at DESC
      LIMIT ${filter.take} OFFSET ${filter.skip}`;

    return rows.map((row) => ({
      productId: row.product_id,
      productName: row.product_name,
      productSlug: row.product_slug,
      views: Number(row.views),
      visitors: Number(row.visitors),
      totalDurationMs: Number(row.duration),
      favorites: Number(row.favorites),
      lastViewedAt: row.last_viewed_at,
    }));
  }

  async countProducts(filter: ProductViewFilter): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ total: bigint }[]>`
      SELECT count(*) AS total FROM (
        SELECT 1 ${FROM_VIEWS}
        WHERE ${whereSql(filter)}
        GROUP BY ${PRODUCT_GROUP}
      ) AS grouped`;
    return Number(row.total);
  }

  async groupByVisitor(
    filter: ProductViewFilter & PageWindow,
  ): Promise<VisitorViewGroup[]> {
    const rows = await this.prisma.$queryRaw<
      {
        user_id: string | null;
        user_name: string | null;
        user_email: string | null;
        visitor_id: string | null;
        views: bigint;
        products: bigint;
        duration: bigint;
        favorites: bigint;
        last_viewed_at: Date;
      }[]
    >`
      SELECT v.user_id AS user_id,
             u.name AS user_name,
             u.email AS user_email,
             ${ANONYMOUS_VISITOR} AS visitor_id,
             count(*) AS views,
             count(DISTINCT coalesce(v.product_id, v.product_name)) AS products,
             sum(v.duration_ms) AS duration,
             count(*) FILTER (WHERE v.favorited) AS favorites,
             max(v.started_at) AS last_viewed_at
      ${FROM_VIEWS}
      WHERE ${whereSql(filter)}
      GROUP BY ${VISITOR_GROUP}
      ORDER BY views DESC, last_viewed_at DESC
      LIMIT ${filter.take} OFFSET ${filter.skip}`;

    return rows.map((row) => ({
      user:
        row.user_id && row.user_name && row.user_email
          ? { id: row.user_id, name: row.user_name, email: row.user_email }
          : null,
      visitorId: row.visitor_id,
      views: Number(row.views),
      products: Number(row.products),
      totalDurationMs: Number(row.duration),
      favorites: Number(row.favorites),
      lastViewedAt: row.last_viewed_at,
    }));
  }

  async countVisitors(filter: ProductViewFilter): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ total: bigint }[]>`
      SELECT count(*) AS total FROM (
        SELECT 1 ${FROM_VIEWS}
        WHERE ${whereSql(filter)}
        GROUP BY ${VISITOR_GROUP}
      ) AS grouped`;
    return Number(row.total);
  }

  async productWindows(
    filter: ProductViewFilter,
    windows: { start: Date; middle: Date; end: Date },
  ): Promise<ProductWindowCounts[]> {
    const middle = timestamp(windows.middle);
    const rows = await this.prisma.$queryRaw<
      {
        product_id: string | null;
        product_name: string;
        product_slug: string | null;
        recent: bigint;
        previous: bigint;
      }[]
    >`
      SELECT v.product_id AS product_id,
             coalesce(p.name, max(v.product_name)) AS product_name,
             p.slug AS product_slug,
             count(*) FILTER (WHERE v.started_at >= ${middle}) AS recent,
             count(*) FILTER (WHERE v.started_at < ${middle}) AS previous
      ${FROM_VIEWS}
      WHERE ${whereSql({ ...filter, from: windows.start, to: windows.end })}
      GROUP BY ${PRODUCT_GROUP}`;

    return rows.map((row) => ({
      productId: row.product_id,
      productName: row.product_name,
      productSlug: row.product_slug,
      recent: Number(row.recent),
      previous: Number(row.previous),
    }));
  }

  /**
   * The filter as a Prisma `where`, for the row list. `whereSql` below is the
   * same filter for the aggregate queries, and the two MUST stay equivalent:
   * the page shows a table and charts side by side and they have to describe
   * the same visits. `test/analytics.e2e-spec.ts` checks every filter through
   * both.
   */
  private where(filter: ProductViewFilter): Prisma.ProductViewWhereInput {
    const where: Prisma.ProductViewWhereInput = {};

    if (filter.productId) where.productId = filter.productId;
    if (filter.visitorId) where.visitorId = filter.visitorId;
    if (filter.favorited !== undefined) where.favorited = filter.favorited;
    if (filter.country) {
      where.country =
        filter.country === UNKNOWN_COUNTRY ? null : filter.country;
    }
    if (filter.from || filter.to) {
      where.startedAt = { gte: filter.from, lt: filter.to };
    }

    // `userId` and `visitorKind` both constrain the same column, so they are
    // combined rather than one overwriting the other.
    const conditions: Prisma.ProductViewWhereInput[] = [];
    if (filter.userId) conditions.push({ userId: filter.userId });
    if (filter.visitorKind === 'signed-in') {
      conditions.push({ userId: { not: null } });
    }
    if (filter.visitorKind === 'anonymous') {
      conditions.push({ userId: null });
    }

    const search = filter.search?.trim();
    if (search) {
      conditions.push({
        OR: [
          { productName: { contains: search, mode: 'insensitive' } },
          { ipAddress: { contains: search, mode: 'insensitive' } },
          { visitorId: { startsWith: search, mode: 'insensitive' } },
          {
            user: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        ],
      });
    }

    if (conditions.length > 0) where.AND = conditions;

    return where;
  }
}

// Every aggregate reads from the same three tables: the visit, who made it
// (for searching by name or email) and the product as it is now (for its slug
// and current name).
const FROM_VIEWS = Prisma.sql`
  FROM product_views v
  LEFT JOIN users u ON u.id = v.user_id
  LEFT JOIN products p ON p.id = v.product_id`;

// A live product is one group however many times it was renamed. A deleted
// one has no id left, so its name snapshot is all there is to group it by.
const PRODUCT_GROUP = Prisma.sql`
  v.product_id, p.name, p.slug,
  CASE WHEN v.product_id IS NULL THEN v.product_name END`;

// Null for a signed-in visit, so all of an account's browsers fall into one
// group; the browser id for an anonymous one.
const ANONYMOUS_VISITOR = Prisma.sql`CASE WHEN v.user_id IS NULL THEN v.visitor_id END`;
const VISITOR_GROUP = Prisma.sql`v.user_id, u.name, u.email, ${ANONYMOUS_VISITOR}`;

// `started_at` is a timestamp without time zone holding UTC. Sending the
// instant as that same UTC wall-clock text keeps the comparison independent
// of the database session's TimeZone setting.
function timestamp(instant: Date): Prisma.Sql {
  return Prisma.sql`${instant.toISOString().replace('Z', '')}::timestamp`;
}

/** The filter as SQL. Must stay equivalent to `where()` above. */
function whereSql(filter: ProductViewFilter): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];

  if (filter.productId) {
    conditions.push(Prisma.sql`v.product_id = ${filter.productId}`);
  }
  if (filter.userId) {
    conditions.push(Prisma.sql`v.user_id = ${filter.userId}`);
  }
  if (filter.visitorId) {
    conditions.push(Prisma.sql`v.visitor_id = ${filter.visitorId}`);
  }
  if (filter.favorited !== undefined) {
    conditions.push(Prisma.sql`v.favorited = ${filter.favorited}`);
  }
  if (filter.country === UNKNOWN_COUNTRY) {
    conditions.push(Prisma.sql`v.country IS NULL`);
  } else if (filter.country) {
    conditions.push(Prisma.sql`v.country = ${filter.country}`);
  }
  if (filter.from) {
    conditions.push(Prisma.sql`v.started_at >= ${timestamp(filter.from)}`);
  }
  if (filter.to) {
    conditions.push(Prisma.sql`v.started_at < ${timestamp(filter.to)}`);
  }
  if (filter.visitorKind === 'signed-in') {
    conditions.push(Prisma.sql`v.user_id IS NOT NULL`);
  }
  if (filter.visitorKind === 'anonymous') {
    conditions.push(Prisma.sql`v.user_id IS NULL`);
  }

  const search = filter.search?.trim();
  if (search) {
    // Like Prisma's `contains`, the term is not escaped, so `%` and `_` act
    // as wildcards in both builders alike.
    const anywhere = `%${search}%`;
    conditions.push(Prisma.sql`(
      v.product_name ILIKE ${anywhere}
      OR v.ip_address ILIKE ${anywhere}
      OR v.visitor_id ILIKE ${`${search}%`}
      OR u.name ILIKE ${anywhere}
      OR u.email ILIKE ${anywhere}
    )`);
  }

  return conditions.length > 0
    ? Prisma.join(conditions, ' AND ')
    : Prisma.sql`TRUE`;
}
