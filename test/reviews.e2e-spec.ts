import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';

interface AuthResponseBody {
  accessToken: string;
}

interface ReviewResponseBody {
  id: string;
  productId: string;
  rating: number;
  body: string | null;
  author?: { id: string; name: string; avatarUrl: string | null };
}

interface ReviewListResponseBody {
  items: ReviewResponseBody[];
  total: number;
  summary: {
    average: number | null;
    count: number;
    distribution: Record<string, number>;
  };
  viewerReview: ReviewResponseBody | null;
}

describe('Reviews (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessTokenA: string;
  let accessTokenB: string;
  let categoryId: string;
  let productId: string;

  async function registerAndLogin(label: string): Promise<string> {
    const email = `reviews-e2e-${label}-${randomUUID()}@example.com`;
    // Throwaway account, so the password is generated per run instead of
    // written here as a literal.
    const password = randomUUID();
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, name: `Reviewer ${label}` })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return (login.body as AuthResponseBody).accessToken;
  }

  function rate(token: string, payload: object) {
    return request(app.getHttpServer())
      .put(`/catalog/products/${productId}/reviews/mine`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
  }

  async function list(token?: string): Promise<ReviewListResponseBody> {
    const req = request(app.getHttpServer()).get(
      `/catalog/products/${productId}/reviews`,
    );
    if (token) {
      void req.set('Authorization', `Bearer ${token}`);
    }
    const response = await req.expect(200);
    return response.body as ReviewListResponseBody;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    accessTokenA = await registerAndLogin('a');
    accessTokenB = await registerAndLogin('b');

    const category = await prisma.category.create({
      data: {
        name: 'Reviews E2E Apparel',
        slug: `reviews-e2e-apparel-${randomUUID()}`,
      },
    });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        name: 'Rateable Tee',
        slug: `rateable-tee-${randomUUID()}`,
        basePriceCents: 2500,
        currency: 'USD',
        status: 'PUBLISHED',
        categories: { connect: { id: categoryId } },
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    await prisma.productReview.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.user.deleteMany({
      where: { email: { contains: 'reviews-e2e-' } },
    });
    await app.close();
  });

  it('starts with an empty summary', async () => {
    const body = await list();

    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.summary).toEqual({
      average: null,
      count: 0,
      distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    });
    expect(body.viewerReview).toBeNull();
  });

  it('rejects rating without a token', () => {
    return request(app.getHttpServer())
      .put(`/catalog/products/${productId}/reviews/mine`)
      .send({ rating: 5 })
      .expect(401);
  });

  it('returns 404 when rating a product that does not exist', () => {
    return request(app.getHttpServer())
      .put(`/catalog/products/${randomUUID()}/reviews/mine`)
      .set('Authorization', `Bearer ${accessTokenA}`)
      .send({ rating: 5 })
      .expect(404);
  });

  it.each([0, 6, 3.5, 'five'])('rejects a rating of %p', (rating) => {
    return rate(accessTokenA, { rating }).expect(400);
  });

  it('rejects a comment that fails moderation and stores nothing', async () => {
    await rate(accessTokenA, {
      rating: 1,
      body: 'This product is shit',
    }).expect(400);

    expect((await list()).summary.count).toBe(0);
  });

  it('accepts a rating without a comment', async () => {
    const response = await rate(accessTokenA, { rating: 4 }).expect(200);

    expect(response.body).toMatchObject({ rating: 4, body: null, productId });

    const body = await list(accessTokenA);
    expect(body.summary).toMatchObject({ average: 4, count: 1 });
    // Counted in the summary, but a bare rating has nothing to list.
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.viewerReview).toMatchObject({ rating: 4, body: null });
  });

  it('accepts a rating with a comment from another user', async () => {
    await rate(accessTokenB, { rating: 5, body: 'Fits perfectly' }).expect(200);

    const body = await list();
    expect(body.summary).toMatchObject({ average: 4.5, count: 2 });
    expect(body.summary.distribution).toMatchObject({ '4': 1, '5': 1 });
    expect(body.total).toBe(1);
    expect(body.items[0]).toMatchObject({ rating: 5, body: 'Fits perfectly' });
    expect(body.items[0].author?.name).toBe('Reviewer b');
    // Anonymous reader: no review of their own.
    expect(body.viewerReview).toBeNull();
  });

  it('replaces the earlier rating instead of adding a second one', async () => {
    const first = (await list(accessTokenA)).viewerReview;

    const response = await rate(accessTokenA, {
      rating: 2,
      body: 'Shrank in the wash',
    }).expect(200);
    expect((response.body as ReviewResponseBody).id).toBe(first?.id);

    const body = await list(accessTokenA);
    expect(body.summary).toMatchObject({ average: 3.5, count: 2 });
    expect(body.total).toBe(2);
    expect(body.viewerReview).toMatchObject({
      rating: 2,
      body: 'Shrank in the wash',
    });
    expect(await prisma.productReview.count({ where: { productId } })).toBe(2);
  });

  it('drops the comment when the rating is sent again without one', async () => {
    await rate(accessTokenA, { rating: 2, body: '' }).expect(200);

    const body = await list(accessTokenA);
    expect(body.viewerReview).toMatchObject({ rating: 2, body: null });
    expect(body.total).toBe(1);
  });

  it('survives concurrent first ratings from the same user', async () => {
    await prisma.productReview.deleteMany({ where: { productId } });

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => rate(accessTokenA, { rating: 3 })),
    );

    expect(responses.map((response) => response.status)).toEqual(
      Array.from({ length: 5 }, () => 200),
    );
    expect(await prisma.productReview.count({ where: { productId } })).toBe(1);
  });

  it('rejects deleting without a token', () => {
    return request(app.getHttpServer())
      .delete(`/catalog/products/${productId}/reviews/mine`)
      .expect(401);
  });

  it("deletes only the caller's review, and is idempotent", async () => {
    await rate(accessTokenB, { rating: 5 }).expect(200);

    const remove = () =>
      request(app.getHttpServer())
        .delete(`/catalog/products/${productId}/reviews/mine`)
        .set('Authorization', `Bearer ${accessTokenA}`);

    await remove().expect(204);
    await remove().expect(204);

    const body = await list(accessTokenA);
    expect(body.viewerReview).toBeNull();
    expect(body.summary).toMatchObject({ average: 5, count: 1 });
  });
});
