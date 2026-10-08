import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';

interface UserResponseBody {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthResponseBody {
  accessToken: string;
  user: UserResponseBody;
}

interface ValidationErrorBody {
  message: string[];
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const email = `jane-${randomUUID()}@example.com`;
  const password = 'supersecret123';

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
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('rejects a weak password with 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'short', name: 'Jane Doe' })
      .expect(400);

    expect((response.body as ValidationErrorBody).message).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'password must be longer than or equal to 8 characters',
        ),
      ]),
    );
  });

  it('registers a new user without leaking the password hash', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, name: 'Jane Doe' })
      .expect(201);

    const body = response.body as UserResponseBody;
    expect(body.email).toBe(email);
    expect(body).not.toHaveProperty('passwordHash');
    expect(body).not.toHaveProperty('password');
  });

  it('rejects a duplicate email with 409', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, name: 'Duplicate' })
      .expect(409);
  });

  it('rejects an invalid login with 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);
  });

  it('logs in and returns a bearer token', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    const body = response.body as AuthResponseBody;
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.user.email).toBe(email);
  });

  it('rejects /auth/me without a token', () => {
    return request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('rejects /auth/me with a garbage token', () => {
    return request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer garbage.token.here')
      .expect(401);
  });

  it('returns the authenticated user profile from /auth/me', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    const { accessToken } = loginResponse.body as AuthResponseBody;

    const meResponse = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect((meResponse.body as UserResponseBody).email).toBe(email);
  });
});
