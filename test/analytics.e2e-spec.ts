import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';

interface AuthResponseBody {
  accessToken: string;
  user: { id: string };
}

interface ProductViewBody {
  id: string;
  product: { id: string | null; name: string; slug: string | null };
  user: { id: string; name: string; email: string } | null;
  visitorId: string;
  ipAddress: string;
  country: string | null;
  durationMs: number;
  favorited: boolean;
}

interface ProductViewListBody {
  items: ProductViewBody[];
  total: number;
  page: number;
  pageSize: number;
}

const EMAIL_MARKER = 'analytics-e2e-';
const PASSWORD = 'supersecret123';

describe('Analytics: product views (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let categoryId: string;
  let productId: string;
  let productSlug: string;
  let customer: AuthResponseBody;
  let admin: AuthResponseBody;
  let staff: AuthResponseBody;

  // Every visitor id this file invents, so afterAll can remove exactly the
  // rows it created and nothing a developer's own browsing put there.
  const visitorIds: string[] = [];
  function newVisitor(): string {
    const id = randomUUID();
    visitorIds.push(id);
    return id;
  }

  async function registerAndLogin(label: string): Promise<AuthResponseBody> {
    const email = `${EMAIL_MARKER}${label}-${randomUUID()}@example.com`;
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: PASSWORD, name: `Analytics ${label}` })
      .expect(201);
    return login(email);
  }

  async function login(email: string): Promise<AuthResponseBody> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return response.body as AuthResponseBody;
  }

  function record(body: Record<string, unknown>, token?: string) {
    const call = request(app.getHttpServer()).post('/analytics/product-views');
    if (token) {
      void call.set('Authorization', `Bearer ${token}`);
    }
    return call.send(body);
  }

  function viewBody(overrides: Record<string, unknown> = {}) {
    return {
      viewId: randomUUID(),
      productId,
      visitorId: newVisitor(),
      durationMs: 0,
      favorited: false,
      ...overrides,
    };
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

    customer = await registerAndLogin('customer');

    // Roles live in the token, so each account is promoted and then logs in
    // again to get a token that carries the new role.
    const adminDraft = await registerAndLogin('admin');
    const adminRecord = await prisma.user.update({
      where: { id: adminDraft.user.id },
      data: { role: 'ADMIN' },
    });
    admin = await login(adminRecord.email);

    const staffDraft = await registerAndLogin('staff');
    const staffRecord = await prisma.user.update({
      where: { id: staffDraft.user.id },
      // Holds a catalog permission but NOT analytics:view.
      data: { role: 'STAFF', permissions: ['products:view'] },
    });
    staff = await login(staffRecord.email);

    const category = await prisma.category.create({
      data: {
        name: 'Analytics E2E',
        slug: `analytics-e2e-${randomUUID()}`,
      },
    });
    categoryId = category.id;

    productSlug = `analytics-e2e-tee-${randomUUID()}`;
    const product = await prisma.product.create({
      data: {
        name: 'Tracked Tee',
        slug: productSlug,
        basePriceCents: 2500,
        currency: 'USD',
        status: 'PUBLISHED',
        categories: { connect: { id: categoryId } },
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    await prisma.productView.deleteMany({
      where: { visitorId: { in: visitorIds } },
    });
    await prisma.product.deleteMany({
      where: { slug: { startsWith: 'analytics-e2e-' } },
    });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.user.deleteMany({
      where: { email: { contains: EMAIL_MARKER } },
    });
    await app.close();
  });

  describe('POST /analytics/product-views', () => {
    it('records a visit from someone who is not signed in', async () => {
      const body = viewBody({ durationMs: 1200 });

      await record(body).expect(204);

      const row = await prisma.productView.findUniqueOrThrow({
        where: { id: body.viewId },
      });
      expect(row.userId).toBeNull();
      expect(row.productId).toBe(productId);
      expect(row.productName).toBe('Tracked Tee');
      expect(row.visitorId).toBe(body.visitorId);
      expect(row.durationMs).toBe(1200);
      expect(row.favorited).toBe(false);
      // supertest connects over loopback: a real address, in no country.
      expect(row.ipAddress).toBe('127.0.0.1');
      expect(row.country).toBeNull();
    });

    it('ties the visit to the account when a token is sent', async () => {
      const body = viewBody();

      await record(body, customer.accessToken).expect(204);

      const row = await prisma.productView.findUniqueOrThrow({
        where: { id: body.viewId },
      });
      expect(row.userId).toBe(customer.user.id);
    });

    it('still records the visit when the token is invalid', async () => {
      // A stale token must not cost the data point: the visit is stored as
      // anonymous instead of being rejected.
      const body = viewBody();

      await record(body, 'not-a-real-token').expect(204);

      const row = await prisma.productView.findUniqueOrThrow({
        where: { id: body.viewId },
      });
      expect(row.userId).toBeNull();
    });

    it('ignores any IP, country or user the caller tries to supply', async () => {
      const body = viewBody({
        ipAddress: '8.8.8.8',
        country: 'US',
        userId: admin.user.id,
      });

      await request(app.getHttpServer())
        .post('/analytics/product-views')
        // With no trusted proxy configured, these are just text the caller
        // typed, and must not be believed.
        .set('X-Forwarded-For', '8.8.8.8')
        .set('CF-IPCountry', 'US')
        .send(body)
        .expect(204);

      const row = await prisma.productView.findUniqueOrThrow({
        where: { id: body.viewId },
      });
      expect(row.ipAddress).toBe('127.0.0.1');
      expect(row.country).toBeNull();
      expect(row.userId).toBeNull();
    });

    it('tops the same row up as the visit goes on', async () => {
      const body = viewBody({ durationMs: 0 });
      await record(body).expect(204);

      await record({ ...body, durationMs: 15_000 }).expect(204);
      await record({ ...body, durationMs: 31_000, favorited: true }).expect(
        204,
      );

      const rows = await prisma.productView.findMany({
        where: { visitorId: body.visitorId },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].durationMs).toBe(31_000);
      expect(rows[0].favorited).toBe(true);
    });

    it('does not let a late report shrink the recorded time', async () => {
      const body = viewBody({ durationMs: 40_000 });
      await record(body).expect(204);

      await record({ ...body, durationMs: 9000 }).expect(204);

      const row = await prisma.productView.findUniqueOrThrow({
        where: { id: body.viewId },
      });
      expect(row.durationMs).toBe(40_000);
    });

    it('records the product being removed from favorites again', async () => {
      const body = viewBody({ favorited: true });
      await record(body).expect(204);

      await record({ ...body, favorited: false }).expect(204);

      const row = await prisma.productView.findUniqueOrThrow({
        where: { id: body.viewId },
      });
      expect(row.favorited).toBe(false);
    });

    it('attaches the account when a visitor signs in mid-visit', async () => {
      const body = viewBody();
      await record(body).expect(204);

      await record({ ...body, durationMs: 5000 }, customer.accessToken).expect(
        204,
      );

      const row = await prisma.productView.findUniqueOrThrow({
        where: { id: body.viewId },
      });
      expect(row.userId).toBe(customer.user.id);
    });

    it('does not let another browser write to an existing view', async () => {
      const body = viewBody({ durationMs: 2000 });
      await record(body).expect(204);

      await record({
        ...body,
        visitorId: newVisitor(),
        durationMs: 900_000,
      }).expect(404);

      const row = await prisma.productView.findUniqueOrThrow({
        where: { id: body.viewId },
      });
      expect(row.durationMs).toBe(2000);
    });

    it('returns 404 for a product that does not exist', async () => {
      const body = viewBody({ productId: randomUUID() });

      await record(body).expect(404);

      expect(
        await prisma.productView.findUnique({ where: { id: body.viewId } }),
      ).toBeNull();
    });

    it.each([
      ['a missing view id', { viewId: undefined }],
      ['a view id that is not a UUID', { viewId: 'abc' }],
      ['a negative duration', { durationMs: -1 }],
      ['a fractional duration', { durationMs: 1.5 }],
      ['a non-boolean favorite flag', { favorited: 'yes' }],
    ])('rejects %s', async (_label, overrides) => {
      await record(viewBody(overrides)).expect(400);
    });

    it('keeps the history when the product is later deleted', async () => {
      const doomed = await prisma.product.create({
        data: {
          name: 'Discontinued Tee',
          slug: `analytics-e2e-doomed-${randomUUID()}`,
          basePriceCents: 1000,
          currency: 'USD',
          status: 'PUBLISHED',
          categories: { connect: { id: categoryId } },
        },
      });
      const body = viewBody({ productId: doomed.id, durationMs: 7000 });
      await record(body).expect(204);

      await prisma.product.delete({ where: { id: doomed.id } });

      const row = await prisma.productView.findUniqueOrThrow({
        where: { id: body.viewId },
      });
      expect(row.productId).toBeNull();
      expect(row.productName).toBe('Discontinued Tee');
      expect(row.durationMs).toBe(7000);
    });
  });

  describe('GET /admin/analytics/product-views', () => {
    function list(token?: string, query = '') {
      const call = request(app.getHttpServer()).get(
        `/admin/analytics/product-views${query}`,
      );
      if (token) {
        void call.set('Authorization', `Bearer ${token}`);
      }
      return call;
    }

    it('rejects a request with no token', async () => {
      await list().expect(401);
    });

    it('rejects a customer', async () => {
      await list(customer.accessToken).expect(403);
    });

    it('rejects staff who were not granted analytics:view', async () => {
      // Holding products:view is not enough: this data includes visitor IPs.
      await list(staff.accessToken).expect(403);
    });

    it('lets staff in once analytics:view is granted', async () => {
      await prisma.user.update({
        where: { id: staff.user.id },
        data: { permissions: ['products:view', 'analytics:view'] },
      });

      // No re-login: PermissionsGuard reads permissions fresh on each request.
      await list(staff.accessToken).expect(200);
    });

    it('shows an admin the history, with who and what each visit was', async () => {
      const signedIn = viewBody({ durationMs: 12_000, favorited: true });
      await record(signedIn, customer.accessToken).expect(204);
      const anonymous = viewBody({ durationMs: 3000 });
      await record(anonymous).expect(204);

      const response = await list(
        admin.accessToken,
        `?productId=${productId}&pageSize=100`,
      ).expect(200);
      const body = response.body as ProductViewListBody;

      const signedInRow = body.items.find(
        (item) => item.id === signedIn.viewId,
      );
      expect(signedInRow).toMatchObject({
        product: { id: productId, name: 'Tracked Tee', slug: productSlug },
        user: { id: customer.user.id, name: 'Analytics customer' },
        visitorId: signedIn.visitorId,
        ipAddress: '127.0.0.1',
        country: null,
        durationMs: 12_000,
        favorited: true,
      });

      const anonymousRow = body.items.find(
        (item) => item.id === anonymous.viewId,
      );
      expect(anonymousRow?.user).toBeNull();
      expect(anonymousRow?.durationMs).toBe(3000);
    });

    it('lists the newest visit first', async () => {
      const older = viewBody();
      await record(older).expect(204);
      const newer = viewBody();
      await record(newer).expect(204);

      const response = await list(
        admin.accessToken,
        `?productId=${productId}&pageSize=100`,
      ).expect(200);
      const ids = (response.body as ProductViewListBody).items.map(
        (item) => item.id,
      );

      expect(ids.indexOf(newer.viewId)).toBeLessThan(ids.indexOf(older.viewId));
    });

    it('filters by product and pages the result', async () => {
      const response = await list(
        admin.accessToken,
        `?productId=${productId}&page=1&pageSize=2`,
      ).expect(200);
      const body = response.body as ProductViewListBody;

      expect(body.items).toHaveLength(2);
      expect(body.pageSize).toBe(2);
      expect(body.total).toBeGreaterThan(2);
      expect(body.items.every((item) => item.product.id === productId)).toBe(
        true,
      );
    });

    it('rejects a product filter that is not a UUID', async () => {
      await list(admin.accessToken, '?productId=nope').expect(400);
    });
  });
});
