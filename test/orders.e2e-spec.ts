import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';

interface OrderItemResponseBody {
  productVariantId: string;
  unitPriceCents: number;
  quantity: number;
}

interface OrderResponseBody {
  id: string;
  status: string;
  currency: string;
  subtotalCents: number;
  items: OrderItemResponseBody[];
}

interface AuthResponseBody {
  accessToken: string;
}

describe('Orders (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken: string;
  let categoryId: string;
  let publishedVariantId: string;
  let draftVariantId: string;
  let lowStockVariantId: string;

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

    const email = `orders-e2e-${randomUUID()}@example.com`;
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'supersecret123', name: 'Orders E2E' })
      .expect(201);
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'supersecret123' })
      .expect(200);
    accessToken = (loginResponse.body as AuthResponseBody).accessToken;

    const category = await prisma.category.create({
      data: {
        name: 'Orders E2E Apparel',
        slug: `orders-e2e-apparel-${randomUUID()}`,
      },
    });
    categoryId = category.id;

    const publishedProduct = await prisma.product.create({
      data: {
        name: 'Orderable Tee',
        slug: `orderable-tee-${randomUUID()}`,
        basePriceCents: 2500,
        currency: 'USD',
        status: 'PUBLISHED',
        categories: { connect: { id: categoryId } },
        variants: {
          create: [
            {
              size: 'M',
              color: 'black',
              sku: `ORD-M-BLK-${randomUUID()}`,
              stock: 5,
            },
            {
              size: 'S',
              color: 'black',
              sku: `ORD-S-BLK-${randomUUID()}`,
              stock: 1,
            },
          ],
        },
      },
      include: { variants: true },
    });
    publishedVariantId = publishedProduct.variants[0].id;
    lowStockVariantId = publishedProduct.variants[1].id;

    const draftProduct = await prisma.product.create({
      data: {
        name: 'Unlisted Tee',
        slug: `unlisted-tee-${randomUUID()}`,
        basePriceCents: 2000,
        currency: 'USD',
        status: 'DRAFT',
        categories: { connect: { id: categoryId } },
        variants: {
          create: [
            {
              size: 'M',
              color: 'white',
              sku: `ORD-M-WHT-${randomUUID()}`,
              stock: 5,
            },
          ],
        },
      },
      include: { variants: true },
    });
    draftVariantId = draftProduct.variants[0].id;
  });

  afterAll(async () => {
    await prisma.order.deleteMany({
      where: { user: { email: { contains: 'orders-e2e-' } } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'orders-e2e-' } },
    });
    await prisma.product.deleteMany({
      where: { categories: { some: { id: categoryId } } },
    });
    await prisma.category.delete({ where: { id: categoryId } });
    await app.close();
  });

  it('rejects placing an order without a token', () => {
    return request(app.getHttpServer())
      .post('/orders')
      .send({ items: [{ productVariantId: publishedVariantId, quantity: 1 }] })
      .expect(401);
  });

  it('rejects an empty item list with 400', async () => {
    await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ items: [] })
      .expect(400);
  });

  it('rejects a variant belonging to a DRAFT product with 400', async () => {
    await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ items: [{ productVariantId: draftVariantId, quantity: 1 }] })
      .expect(400);
  });

  it('rejects a quantity that exceeds available stock with 400 and leaves stock untouched', async () => {
    await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ items: [{ productVariantId: lowStockVariantId, quantity: 5 }] })
      .expect(400);

    const variant = await prisma.productVariant.findUniqueOrThrow({
      where: { id: lowStockVariantId },
    });
    expect(variant.stock).toBe(1);
  });

  let placedOrderId: string;

  it('places an order, decrements stock, and computes the subtotal', async () => {
    const response = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ items: [{ productVariantId: publishedVariantId, quantity: 2 }] })
      .expect(201);

    const body = response.body as OrderResponseBody;
    expect(body.status).toBe('PENDING');
    expect(body.subtotalCents).toBe(5000);
    expect(body.items).toEqual([
      expect.objectContaining({
        productVariantId: publishedVariantId,
        unitPriceCents: 2500,
        quantity: 2,
      }),
    ]);
    placedOrderId = body.id;

    const variant = await prisma.productVariant.findUniqueOrThrow({
      where: { id: publishedVariantId },
    });
    expect(variant.stock).toBe(3);
  });

  it("lists the order in the requester's order history", async () => {
    const response = await request(app.getHttpServer())
      .get('/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as { items: OrderResponseBody[] };
    expect(body.items.some((order) => order.id === placedOrderId)).toBe(true);
  });

  it('fetches the order by id', async () => {
    const response = await request(app.getHttpServer())
      .get(`/orders/${placedOrderId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect((response.body as OrderResponseBody).id).toBe(placedOrderId);
  });

  it("returns 404 for another user's order", async () => {
    const otherEmail = `orders-e2e-other-${randomUUID()}@example.com`;
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: otherEmail,
        password: 'supersecret123',
        name: 'Other User',
      })
      .expect(201);
    const otherLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: otherEmail, password: 'supersecret123' })
      .expect(200);
    const otherToken = (otherLogin.body as AuthResponseBody).accessToken;

    await request(app.getHttpServer())
      .get(`/orders/${placedOrderId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });

  it('confirms payment via the stub pay endpoint', async () => {
    const response = await request(app.getHttpServer())
      .post(`/orders/${placedOrderId}/pay`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect((response.body as OrderResponseBody).status).toBe('PAID');
  });

  it('rejects paying an already-paid order with 400', async () => {
    await request(app.getHttpServer())
      .post(`/orders/${placedOrderId}/pay`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
  });
});
