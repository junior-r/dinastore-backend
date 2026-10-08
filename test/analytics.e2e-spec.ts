import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { Workbook } from 'exceljs';
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

interface GroupListBody<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

interface ProductGroupBody {
  productId: string | null;
  productName: string;
  views: number;
  visitors: number;
  favorites: number;
  totalDurationMs: number;
}

interface VisitorGroupBody {
  user: { id: string; name: string; email: string } | null;
  visitorId: string | null;
  views: number;
  products: number;
  favorites: number;
}

interface InsightsBody {
  totals: {
    views: number;
    visitors: number;
    products: number;
    favorites: number;
    totalDurationMs: number;
    avgDurationMs: number;
    favoriteRate: number;
  };
  daily: { day: string; views: number }[];
  countries: { country: string | null; views: number }[];
  topProducts: ProductGroupBody[];
  forecast: {
    status: 'ok' | 'insufficient';
    days?: { day: string; expected: number; low: number; high: number }[];
    expectedTotal?: number;
    daysNeeded?: number;
  };
  movers: { productId: string | null; recent: number; previous: number }[];
}

const EMAIL_MARKER = 'analytics-e2e-';
// Throwaway accounts, so the password is generated per run instead of
// written here as a literal.
const PASSWORD = randomUUID();

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

  describe('filters, grouped views, insights and export', () => {
    const DAY_MS = 86_400_000;
    const HISTORY_DAYS = 10;
    const TEST_IP = '203.0.113.9';

    let insightProductId: string;
    let regularVisitor: string;
    let signedInVisitor: string;
    let foreignVisitor: string;
    const now = new Date();

    function get(path: string, query = '', token = admin.accessToken) {
      return request(app.getHttpServer())
        .get(`/admin/analytics/product-views${path}${query}`)
        .set('Authorization', `Bearer ${token}`);
    }

    // Every request in this block is scoped to a product only this block
    // writes to, so the counts are exact whatever else is in the database.
    const scoped = (query = '') =>
      `?productId=${insightProductId}${query ? `&${query}` : ''}`;

    beforeAll(async () => {
      const product = await prisma.product.create({
        data: {
          name: 'Insight Hoodie',
          slug: `analytics-e2e-hoodie-${randomUUID()}`,
          basePriceCents: 4000,
          currency: 'USD',
          status: 'PUBLISHED',
          categories: { connect: { id: categoryId } },
        },
      });
      insightProductId = product.id;
      regularVisitor = newVisitor();
      signedInVisitor = newVisitor();
      foreignVisitor = newVisitor();

      const base = {
        productId: insightProductId,
        productName: product.name,
        ipAddress: '198.51.100.1',
      };

      await prisma.productView.createMany({
        data: [
          // One anonymous visit a day for the ten days before today.
          ...Array.from({ length: HISTORY_DAYS }, (_, index) => ({
            ...base,
            id: randomUUID(),
            visitorId: regularVisitor,
            country: 'VE',
            durationMs: 10_000,
            startedAt: new Date(now.getTime() - (index + 1) * DAY_MS),
          })),
          // Two signed-in visits just now, product saved, address unplaced.
          ...Array.from({ length: 2 }, () => ({
            ...base,
            id: randomUUID(),
            visitorId: signedInVisitor,
            userId: customer.user.id,
            country: null,
            durationMs: 20_000,
            favorited: true,
            startedAt: new Date(now.getTime() - 60_000),
          })),
          {
            ...base,
            id: randomUUID(),
            visitorId: foreignVisitor,
            ipAddress: TEST_IP,
            country: 'US',
            durationMs: 5_000,
            startedAt: new Date(now.getTime() - 60_000),
          },
        ],
      });
    });

    const anHourAgo = () =>
      encodeURIComponent(new Date(now.getTime() - 3_600_000).toISOString());

    // The row list is filtered through a Prisma `where` and the aggregates
    // through hand-written SQL. Each case goes through both and has to agree.
    it.each([
      ['no extra filter', () => '', 13],
      ['signed-in visitors', () => 'visitor=signed-in', 2],
      ['anonymous visitors', () => 'visitor=anonymous', 11],
      ['saved as favorite', () => 'favorited=true', 2],
      ['not saved', () => 'favorited=false', 11],
      ['one country', () => 'country=VE', 10],
      ['another country', () => 'country=US', 1],
      ['unplaced addresses', () => 'country=unknown', 2],
      ['search by IP', () => `search=${TEST_IP}`, 1],
      ['search by product name, any case', () => 'search=insight%20HOOD', 13],
      ['search by visitor email', () => `search=${EMAIL_MARKER}customer`, 2],
      ['search by visitor name', () => 'search=Analytics%20customer', 2],
      [
        'search by the start of a browser id',
        () => `search=${foreignVisitor.slice(0, 13)}`,
        1,
      ],
      ['one account', () => `userId=${customer.user.id}`, 2],
      ['one browser', () => `visitorId=${regularVisitor}`, 10],
      ['from a start time', () => `from=${anHourAgo()}`, 3],
      ['up to an end time', () => `to=${anHourAgo()}`, 10],
      ['two filters together', () => 'visitor=anonymous&country=US', 1],
      ['filters that exclude everything', () => 'favorited=true&country=VE', 0],
    ])(
      '%s: the list and the aggregates agree',
      async (_label, query, expected) => {
        const [listed, insights] = await Promise.all([
          get('', scoped(query())).expect(200),
          get('/insights', scoped(query())).expect(200),
        ]);

        expect((listed.body as ProductViewListBody).total).toBe(expected);
        expect((insights.body as InsightsBody).totals.views).toBe(expected);
      },
    );

    it.each([
      'country=venezuela',
      'favorited=yes',
      'visitor=everyone',
      'from=yesterday',
      'userId=nope',
    ])('rejects the malformed filter %s', async (query) => {
      await get('', `?${query}`).expect(400);
      await get('/insights', `?${query}`).expect(400);
    });

    it('sums the history up per product', async () => {
      const response = await get('/by-product', scoped()).expect(200);
      const body = response.body as GroupListBody<ProductGroupBody>;

      expect(body.total).toBe(1);
      expect(body.items[0]).toMatchObject({
        productId: insightProductId,
        productName: 'Insight Hoodie',
        views: 13,
        visitors: 3,
        favorites: 2,
        totalDurationMs: 145_000,
      });
    });

    it('sums the history up per person, an account being one person', async () => {
      const response = await get('/by-visitor', scoped()).expect(200);
      const body = response.body as GroupListBody<VisitorGroupBody>;

      expect(body.total).toBe(3);
      // Most views first.
      expect(body.items[0]).toMatchObject({
        user: null,
        visitorId: regularVisitor,
        views: 10,
        products: 1,
      });
      const account = body.items.find((item) => item.user !== null);
      expect(account).toMatchObject({
        user: { id: customer.user.id },
        // An account is not tied to one browser.
        visitorId: null,
        views: 2,
        favorites: 2,
      });
    });

    it('pages the grouped lists', async () => {
      const response = await get(
        '/by-visitor',
        scoped('pageSize=2&page=2'),
      ).expect(200);
      const body = response.body as GroupListBody<VisitorGroupBody>;

      expect(body.items).toHaveLength(1);
      expect(body).toMatchObject({ total: 3, page: 2, pageSize: 2 });
    });

    it('returns totals, a zero-filled daily series, countries and top products', async () => {
      const response = await get('/insights', scoped()).expect(200);
      const body = response.body as InsightsBody;

      expect(body.totals).toMatchObject({
        views: 13,
        visitors: 3,
        products: 1,
        favorites: 2,
        totalDurationMs: 145_000,
        avgDurationMs: 11_154,
      });
      expect(body.totals.favoriteRate).toBeCloseTo(2 / 13);

      expect(body.daily).toHaveLength(30);
      expect(body.daily.reduce((sum, day) => sum + day.views, 0)).toBe(13);
      // The last entry is today, with the three visits made "just now".
      expect(body.daily[body.daily.length - 1].views).toBeGreaterThanOrEqual(2);

      expect(body.countries).toEqual([
        { country: 'VE', views: 10 },
        { country: null, views: 2 },
        { country: 'US', views: 1 },
      ]);
      expect(body.topProducts).toHaveLength(1);
      expect(body.topProducts[0]).toMatchObject({ views: 13 });
    });

    it('forecasts the next seven days once there is a week of history', async () => {
      const response = await get('/insights', scoped()).expect(200);
      const { forecast, movers } = response.body as InsightsBody;

      expect(forecast.status).toBe('ok');
      expect(forecast.days).toHaveLength(7);
      // One view a day, every day: the forecast is one view a day.
      expect(forecast.days?.every((day) => day.expected === 1)).toBe(true);
      expect(forecast.expectedTotal).toBe(7);

      expect(movers).toHaveLength(1);
      expect(movers[0]).toMatchObject({ productId: insightProductId });
      expect(movers[0].recent).toBeGreaterThan(0);
    });

    it('says there is not enough history instead of guessing', async () => {
      // Only the signed-in visits, which all happened today.
      const response = await get(
        '/insights',
        scoped('visitor=signed-in'),
      ).expect(200);

      expect((response.body as InsightsBody).forecast).toMatchObject({
        status: 'insufficient',
        daysNeeded: 7,
      });
    });

    it('applies the same permission to every route', async () => {
      for (const path of [
        '/by-product',
        '/by-visitor',
        '/insights',
        '/export',
      ]) {
        // `staff` was granted analytics:view by an earlier test in this file,
        // so the customer and the tokenless request are the ones refused.
        await get(path, '', customer.accessToken).expect(403);
        await request(app.getHttpServer())
          .get(`/admin/analytics/product-views${path}`)
          .expect(401);
        await get(path, scoped(), staff.accessToken).expect(200);
      }
    });

    it('exports the filtered history as a spreadsheet', async () => {
      const response = await get('/export', scoped('lang=es'))
        .responseType('blob')
        .expect(200)
        .expect('Content-Type', /spreadsheetml\.sheet/);

      const workbook = new Workbook();
      await workbook.xlsx.load(response.body as Buffer);

      expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
        'Visitas',
        'Por producto',
        'Por visitante',
        'Diario',
      ]);

      // Header row plus one row per visit.
      const visits = workbook.getWorksheet('Visitas');
      expect(visits?.rowCount).toBe(14);
      expect(visits?.getRow(1).getCell(2).value).toBe('Producto');
      expect(visits?.getRow(2).getCell(2).value).toBe('Insight Hoodie');

      expect(
        workbook.getWorksheet('Por producto')?.getRow(2).getCell(2).value,
      ).toBe(13);
      expect(workbook.getWorksheet('Por visitante')?.rowCount).toBe(4);
      // Header, 30 recorded days and 7 forecast days.
      expect(workbook.getWorksheet('Diario')?.rowCount).toBe(38);
    });

    it('exports only what the filters match, in the requested language', async () => {
      const response = await get('/export', scoped('country=US'))
        .responseType('blob')
        .expect(200);

      const workbook = new Workbook();
      await workbook.xlsx.load(response.body as Buffer);

      const visits = workbook.getWorksheet('Visits');
      expect(visits?.rowCount).toBe(2);
      expect(visits?.getRow(2).getCell(7).value).toBe(TEST_IP);
    });
  });
});
