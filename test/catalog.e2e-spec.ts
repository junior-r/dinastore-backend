import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';

interface ProductResponseBody {
  id: string;
  slug: string;
  status: string;
  totalStock: number;
  variants: {
    id: string;
    size: string;
    color: string;
    stock: number;
    sku: string;
  }[];
  images: { id: string; url: string; variantIds: string[] }[];
}

interface ProductListResponseBody {
  items: ProductResponseBody[];
  page: number;
  pageSize: number;
}

interface ValidationErrorBody {
  message: string[];
}

interface RegisterResponseBody {
  id: string;
}

interface LoginResponseBody {
  accessToken: string;
}

describe('Catalog (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let categoryId: string;
  let adminToken: string;
  const slug = `classic-tee-${randomUUID()}`;

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
    const category = await prisma.category.create({
      data: { name: 'E2E Apparel', slug: `e2e-apparel-${randomUUID()}` },
    });
    categoryId = category.id;

    // POST /catalog/products is now guarded (ADMIN/STAFF + products:manage)
    // -- promote a fresh user via Prisma (no self-service path exists),
    // same pattern used in admin-users.e2e-spec.ts.
    const email = `catalog-e2e-admin-${randomUUID()}@example.com`;
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'supersecret123', name: 'Catalog Admin' })
      .expect(201);
    await prisma.user.update({
      where: { id: (register.body as RegisterResponseBody).id },
      data: { role: 'ADMIN' },
    });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'supersecret123' })
      .expect(200);
    adminToken = (login.body as LoginResponseBody).accessToken;
  });

  afterAll(async () => {
    await prisma.product.deleteMany({
      where: { categories: { some: { id: categoryId } } },
    });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.user.deleteMany({
      where: { email: { contains: 'catalog-e2e-' } },
    });
    await app.close();
  });

  it('rejects an unauthenticated create with 401', () => {
    return request(app.getHttpServer())
      .post('/catalog/products')
      .send({
        name: 'X',
        slug: 'x',
        basePriceCents: 100,
        currency: 'USD',
        categoryIds: [categoryId],
      })
      .expect(401);
  });

  it('rejects an invalid payload with 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/catalog/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ slug: 'bad', basePriceCents: -5 })
      .expect(400);

    expect((response.body as ValidationErrorBody).message).toEqual(
      expect.arrayContaining([
        expect.stringContaining('basePriceCents must not be less than 0'),
      ]),
    );
  });

  it('creates a product as DRAFT', async () => {
    const response = await request(app.getHttpServer())
      .post('/catalog/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Classic Tee',
        slug,
        description: 'A classic t-shirt',
        basePriceCents: 2500,
        currency: 'USD',
        categoryIds: [categoryId],
        variants: [
          {
            size: 'M',
            color: 'black',
            sku: `TEE-M-BLK-${randomUUID()}`,
            stock: 10,
          },
        ],
      })
      .expect(201);

    expect(response.body).toMatchObject({
      slug,
      status: 'DRAFT',
      totalStock: 10,
    });
  });

  it('rejects a duplicate slug with 409', async () => {
    await request(app.getHttpServer())
      .post('/catalog/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Duplicate',
        slug,
        basePriceCents: 100,
        currency: 'USD',
        categoryIds: [categoryId],
      })
      .expect(409);
  });

  it('excludes DRAFT products from the default (PUBLISHED) listing and defaults page/pageSize', async () => {
    const response = await request(app.getHttpServer())
      .get('/catalog/products')
      .expect(200);
    const body = response.body as ProductListResponseBody;

    expect(body.items.some((item) => item.slug === slug)).toBe(false);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
  });

  it('rejects a categoryId that does not exist with 404 (Prisma connect target missing)', async () => {
    await request(app.getHttpServer())
      .post('/catalog/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Orphan',
        slug: `orphan-${randomUUID()}`,
        basePriceCents: 100,
        currency: 'USD',
        categoryIds: [randomUUID()],
      })
      .expect(404);
  });

  it('rejects duplicate size/color variants with 400 via the domain invariant', async () => {
    await request(app.getHttpServer())
      .post('/catalog/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Bad Variants',
        slug: `bad-variants-${randomUUID()}`,
        basePriceCents: 100,
        currency: 'USD',
        categoryIds: [categoryId],
        variants: [
          { size: 'M', color: 'black', sku: `DUP-1-${randomUUID()}`, stock: 1 },
          { size: 'M', color: 'black', sku: `DUP-2-${randomUUID()}`, stock: 1 },
        ],
      })
      .expect(400);
  });

  it('includes the product when filtering by status=DRAFT', async () => {
    const response = await request(app.getHttpServer())
      .get('/catalog/products')
      .query({ status: 'DRAFT', categoryIds: categoryId })
      .expect(200);

    expect(
      (response.body as ProductListResponseBody).items.some(
        (item) => item.slug === slug,
      ),
    ).toBe(true);
  });

  it('fetches the product by slug', async () => {
    const response = await request(app.getHttpServer())
      .get(`/catalog/products/${slug}`)
      .expect(200);

    expect((response.body as ProductResponseBody).slug).toBe(slug);
  });

  it('returns 404 for an unknown slug', () => {
    return request(app.getHttpServer())
      .get('/catalog/products/does-not-exist')
      .expect(404);
  });

  it('tags an image to specific variants via variantIndexes, and defaults an untagged image to every variant', async () => {
    const taggedSlug = `image-variants-${randomUUID()}`;
    const create = await request(app.getHttpServer())
      .post('/catalog/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Image Variants Tee',
        slug: taggedSlug,
        basePriceCents: 2000,
        currency: 'USD',
        categoryIds: [categoryId],
        variants: [
          {
            size: 'M',
            color: 'black',
            sku: `IMG-BLK-${randomUUID()}`,
            stock: 4,
          },
          {
            size: 'M',
            color: 'blue',
            sku: `IMG-BLU-${randomUUID()}`,
            stock: 3,
          },
        ],
        images: [
          {
            url: 'https://example.com/black.png',
            position: 0,
            variantIndexes: [0],
          },
          {
            url: 'https://example.com/blue.png',
            position: 1,
            variantIndexes: [1],
          },
          { url: 'https://example.com/all.png', position: 2 },
        ],
      })
      .expect(201);

    const created = create.body as ProductResponseBody;
    const blackVariantId = created.variants.find(
      (v) => v.color === 'black',
    )!.id;
    const blueVariantId = created.variants.find((v) => v.color === 'blue')!.id;

    const response = await request(app.getHttpServer())
      .get(`/catalog/products/${taggedSlug}`)
      .expect(200);
    const product = response.body as ProductResponseBody;

    expect(
      product.images.find((i) => i.url.includes('black'))?.variantIds,
    ).toEqual([blackVariantId]);
    expect(
      product.images.find((i) => i.url.includes('blue'))?.variantIds,
    ).toEqual([blueVariantId]);
    expect(
      product.images.find((i) => i.url.includes('all'))?.variantIds,
    ).toEqual([]);
  });

  it('rejects an image variantIndexes entry out of range with 400', async () => {
    await request(app.getHttpServer())
      .post('/catalog/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Bad Image Variant Index',
        slug: `bad-image-variant-${randomUUID()}`,
        basePriceCents: 100,
        currency: 'USD',
        categoryIds: [categoryId],
        variants: [
          {
            size: 'M',
            color: 'black',
            sku: `BADIDX-${randomUUID()}`,
            stock: 1,
          },
        ],
        images: [
          {
            url: 'https://example.com/tee.png',
            position: 0,
            variantIndexes: [5],
          },
        ],
      })
      .expect(400);
  });

  describe('PATCH /admin/catalog/products/:id/variants', () => {
    async function createProductWithVariant() {
      const response = await request(app.getHttpServer())
        .post('/catalog/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Variant Update Tee',
          slug: `variant-update-${randomUUID()}`,
          basePriceCents: 1500,
          currency: 'USD',
          categoryIds: [categoryId],
          variants: [
            {
              size: 'M',
              color: 'black',
              sku: `VUP-BLK-${randomUUID()}`,
              stock: 4,
            },
          ],
        })
        .expect(201);
      return response.body as ProductResponseBody;
    }

    it('updates stock on the existing variant and adds a new one', async () => {
      const product = await createProductWithVariant();
      const existingVariantId = product.variants[0].id;

      const response = await request(app.getHttpServer())
        .patch(`/admin/catalog/products/${product.id}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          variants: [
            { id: existingVariantId, stock: 1 },
            {
              size: 'M',
              color: 'blue',
              sku: `VUP-BLU-${randomUUID()}`,
              stock: 3,
            },
          ],
        })
        .expect(200);

      const updated = response.body as ProductResponseBody;
      expect(updated.variants).toHaveLength(2);
      expect(
        updated.variants.find((v) => v.id === existingVariantId)?.stock,
      ).toBe(1);
      expect(
        updated.variants.some((v) => v.color === 'blue' && v.stock === 3),
      ).toBe(true);
    });

    it('deletes a variant left out of the submitted list', async () => {
      const product = await createProductWithVariant();

      const response = await request(app.getHttpServer())
        .patch(`/admin/catalog/products/${product.id}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ variants: [] })
        .expect(200);

      expect((response.body as ProductResponseBody).variants).toEqual([]);
    });

    it('rejects a variant id that does not belong to this product with 400', async () => {
      const product = await createProductWithVariant();

      await request(app.getHttpServer())
        .patch(`/admin/catalog/products/${product.id}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ variants: [{ id: randomUUID(), stock: 1 }] })
        .expect(400);
    });

    it('rejects an unauthenticated request with 401', async () => {
      const product = await createProductWithVariant();
      await request(app.getHttpServer())
        .patch(`/admin/catalog/products/${product.id}/variants`)
        .send({ variants: [] })
        .expect(401);
    });
  });

  describe('PATCH /admin/catalog/products/:id/images', () => {
    async function createProductWithVariant() {
      const response = await request(app.getHttpServer())
        .post('/catalog/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Image Update Tee',
          slug: `image-update-${randomUUID()}`,
          basePriceCents: 1500,
          currency: 'USD',
          categoryIds: [categoryId],
          variants: [
            {
              size: 'M',
              color: 'black',
              sku: `IUP-BLK-${randomUUID()}`,
              stock: 4,
            },
          ],
        })
        .expect(201);
      return response.body as ProductResponseBody;
    }

    it('adds a new image tagged to an existing variant', async () => {
      const product = await createProductWithVariant();
      const variantId = product.variants[0].id;

      const response = await request(app.getHttpServer())
        .patch(`/admin/catalog/products/${product.id}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          images: [
            {
              url: 'https://example.com/black.png',
              position: 0,
              variantIds: [variantId],
            },
          ],
        })
        .expect(200);

      const updated = response.body as ProductResponseBody;
      expect(updated.images).toHaveLength(1);
      expect(updated.images[0].variantIds).toEqual([variantId]);
    });

    it('re-tags and removes images on a second call (full replace)', async () => {
      const product = await createProductWithVariant();
      const variantId = product.variants[0].id;

      const first = await request(app.getHttpServer())
        .patch(`/admin/catalog/products/${product.id}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          images: [
            {
              url: 'https://example.com/a.png',
              position: 0,
              variantIds: [variantId],
            },
            { url: 'https://example.com/b.png', position: 1 },
          ],
        })
        .expect(200);
      const imageAId = (first.body as ProductResponseBody).images.find((i) =>
        i.url.includes('a.png'),
      )!.id;

      const second = await request(app.getHttpServer())
        .patch(`/admin/catalog/products/${product.id}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          images: [
            {
              id: imageAId,
              url: 'https://example.com/a.png',
              position: 0,
              variantIds: [],
            },
          ],
        })
        .expect(200);

      const updated = second.body as ProductResponseBody;
      expect(updated.images).toHaveLength(1);
      expect(updated.images[0].id).toBe(imageAId);
      expect(updated.images[0].variantIds).toEqual([]);
    });

    it('rejects an image tagged to a variant id that does not belong to this product with 400', async () => {
      const product = await createProductWithVariant();

      await request(app.getHttpServer())
        .patch(`/admin/catalog/products/${product.id}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          images: [
            {
              url: 'https://example.com/x.png',
              position: 0,
              variantIds: [randomUUID()],
            },
          ],
        })
        .expect(400);
    });
  });
});
