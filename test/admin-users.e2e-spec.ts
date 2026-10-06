import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';

interface RegisterResponseBody {
  id: string;
}

interface LoginResponseBody {
  accessToken: string;
}

interface UserListResponseBody {
  items: { id: string; role: string }[];
  total: number;
}

interface UserDetailResponseBody {
  id: string;
  role: string;
  isActive: boolean;
  hasPassword: boolean;
  oauthAccounts: unknown[];
}

describe('Admin Users (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let adminId: string;
  let adminToken: string;
  let staffId: string;
  let staffToken: string;
  let customerId: string;
  let customerToken: string;

  async function register(
    prefix: string,
  ): Promise<{ id: string; email: string }> {
    const email = `admin-e2e-${prefix}-${randomUUID()}@example.com`;
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'supersecret123', name: prefix })
      .expect(201);
    return { id: (response.body as RegisterResponseBody).id, email };
  }

  async function login(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'supersecret123' })
      .expect(200);
    return (response.body as LoginResponseBody).accessToken;
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

    const admin = await register('admin');
    const staff = await register('staff');
    const customer = await register('customer');
    adminId = admin.id;
    staffId = staff.id;
    customerId = customer.id;

    // No self-service path to become ADMIN/STAFF -- promoted directly via
    // Prisma, same pattern already used elsewhere in this repo for
    // hand-seeding data that has no creation endpoint yet.
    await prisma.user.update({
      where: { id: adminId },
      data: { role: 'ADMIN' },
    });
    await prisma.user.update({
      where: { id: staffId },
      data: { role: 'STAFF', permissions: ['users:view'] },
    });

    // Re-login *after* promotion so each token's `role` claim (baked in at
    // sign time) reflects the new role -- RolesGuard reads it straight off
    // the JWT, not a fresh DB lookup.
    adminToken = await login(admin.email);
    staffToken = await login(staff.email);
    customerToken = await login(customer.email);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'admin-e2e-' } },
    });
    await app.close();
  });

  describe('role gate', () => {
    it('blocks a CUSTOMER from any /admin/users route', () => {
      return request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    it('blocks an unauthenticated request', () => {
      return request(app.getHttpServer()).get('/admin/users').expect(401);
    });
  });

  describe('permission gate', () => {
    it('allows STAFF with users:view to list users', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect((response.body as UserListResponseBody).total).toBeGreaterThan(0);
    });

    it('allows ADMIN to list users without any permission grant', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect((response.body as UserListResponseBody).total).toBeGreaterThan(0);
    });

    it('blocks STAFF from a route requiring a permission they lack', () => {
      // staff only has users:view, not users:manage
      return request(app.getHttpServer())
        .patch(`/admin/users/${customerId}/deactivate`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
    });
  });

  describe('role/permission changes are ADMIN-only, even with users:manage', () => {
    it('blocks STAFF (even with users:manage) from changing a role', async () => {
      // Granting users:manage must not be enough -- role changes require
      // @Roles(ADMIN) specifically, which reads straight off the existing
      // token's `role` claim (still STAFF), so no re-login is needed here.
      await prisma.user.update({
        where: { id: staffId },
        data: { permissions: ['users:view', 'users:manage'] },
      });

      await request(app.getHttpServer())
        .patch(`/admin/users/${customerId}/role`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ role: 'STAFF' })
        .expect(403);

      // restore for later tests
      await prisma.user.update({
        where: { id: staffId },
        data: { permissions: ['users:view'] },
      });
    });

    it('allows ADMIN to change a role', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/admin/users/${customerId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'STAFF' })
        .expect(200);

      expect(response.body).toMatchObject({ role: 'STAFF' });

      // restore
      await prisma.user.update({
        where: { id: customerId },
        data: { role: 'CUSTOMER' },
      });
    });

    it('rejects an admin changing their own role (400)', () => {
      return request(app.getHttpServer())
        .patch(`/admin/users/${adminId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'CUSTOMER' })
        .expect(400);
    });
  });

  describe('deactivate / activate', () => {
    it('deactivating blocks the next login attempt', async () => {
      const target = await register('deactivate-target');

      await request(app.getHttpServer())
        .patch(`/admin/users/${target.id}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: target.email, password: 'supersecret123' })
        .expect(401);

      await request(app.getHttpServer())
        .patch(`/admin/users/${target.id}/activate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: target.email, password: 'supersecret123' })
        .expect(200);
    });

    it('rejects an admin deactivating their own account (400)', () => {
      return request(app.getHttpServer())
        .patch(`/admin/users/${adminId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('deactivating a STAFF user immediately blocks their admin access, even with a still-valid token', async () => {
      // staffToken is still unexpired -- PermissionsGuard re-checks isActive
      // from the DB on every admin route, unlike the rest of the site.
      await prisma.user.update({
        where: { id: staffId },
        data: { isActive: false },
      });

      await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(401);

      await prisma.user.update({
        where: { id: staffId },
        data: { isActive: true },
      });
    });
  });

  describe('user detail', () => {
    it('returns the user detail with oauthAccounts and hasPassword', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/users/${customerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as UserDetailResponseBody;
      expect(body.id).toBe(customerId);
      expect(body.hasPassword).toBe(true);
      expect(body.oauthAccounts).toEqual([]);
    });

    it('returns 404 for an unknown user id', () => {
      return request(app.getHttpServer())
        .get(`/admin/users/${randomUUID()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
});
