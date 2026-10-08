import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';
import { resolveLocalStorageDir } from '../src/shared/infrastructure/storage/local-disk-file-storage';

interface AuthResponseBody {
  accessToken: string;
}

interface CommentResponseBody {
  id: string;
  productId: string;
  body: string;
  parentId: string | null;
  depth: number;
  likeCount: number;
  likedByViewer: boolean;
  hasImage: boolean;
  image?: {
    url: string;
    thumbnailUrl: string;
    width: number;
    height: number;
  } | null;
  author?: { id: string; name: string; avatarUrl: string | null };
}

interface CommentListResponseBody {
  items: CommentResponseBody[];
  total: number;
  rootTotal: number;
}

interface LikeResponseBody {
  commentId: string;
  liked: boolean;
  likeCount: number;
}

describe('Comments (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessTokenA: string;
  let accessTokenB: string;
  let categoryId: string;
  let productId: string;

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

    const emailA = `comments-e2e-a-${randomUUID()}@example.com`;
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: emailA, password: 'supersecret123', name: 'Commenter A' })
      .expect(201);
    const loginA = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: emailA, password: 'supersecret123' })
      .expect(200);
    accessTokenA = (loginA.body as AuthResponseBody).accessToken;

    const emailB = `comments-e2e-b-${randomUUID()}@example.com`;
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: emailB, password: 'supersecret123', name: 'Commenter B' })
      .expect(201);
    const loginB = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: emailB, password: 'supersecret123' })
      .expect(200);
    accessTokenB = (loginB.body as AuthResponseBody).accessToken;

    const category = await prisma.category.create({
      data: {
        name: 'Comments E2E Apparel',
        slug: `comments-e2e-apparel-${randomUUID()}`,
      },
    });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        name: 'Commentable Tee',
        slug: `commentable-tee-${randomUUID()}`,
        basePriceCents: 2500,
        currency: 'USD',
        status: 'PUBLISHED',
        categories: { connect: { id: categoryId } },
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    await prisma.comment.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.user.deleteMany({
      where: { email: { contains: 'comments-e2e-' } },
    });
    await app.close();
  });

  it('rejects posting a comment without a token', () => {
    return request(app.getHttpServer())
      .post(`/catalog/products/${productId}/comments`)
      .send({ body: 'hello' })
      .expect(401);
  });

  it('returns 404 when posting to a product that does not exist', () => {
    return request(app.getHttpServer())
      .post(`/catalog/products/${randomUUID()}/comments`)
      .set('Authorization', `Bearer ${accessTokenA}`)
      .send({ body: 'hello' })
      .expect(404);
  });

  it('rejects a comment body that fails moderation', async () => {
    await request(app.getHttpServer())
      .post(`/catalog/products/${productId}/comments`)
      .set('Authorization', `Bearer ${accessTokenA}`)
      .send({ body: 'This product is shit' })
      .expect(400);

    const list = await request(app.getHttpServer())
      .get(`/catalog/products/${productId}/comments`)
      .expect(200);
    expect((list.body as CommentListResponseBody).total).toBe(0);
  });

  let commentId: string;

  it('lets a logged-in user post a comment', async () => {
    const response = await request(app.getHttpServer())
      .post(`/catalog/products/${productId}/comments`)
      .set('Authorization', `Bearer ${accessTokenA}`)
      .send({ body: 'Great fit and quality!' })
      .expect(201);

    const body = response.body as CommentResponseBody;
    expect(body.productId).toBe(productId);
    expect(body.body).toBe('Great fit and quality!');
    commentId = body.id;
  });

  it('lists comments publicly (no token required), newest first, with author info', async () => {
    const response = await request(app.getHttpServer())
      .get(`/catalog/products/${productId}/comments`)
      .expect(200);

    const body = response.body as CommentListResponseBody;
    expect(body.total).toBe(1);
    expect(body.items[0].id).toBe(commentId);
    expect(body.items[0].author?.name).toBe('Commenter A');
  });

  it('rejects deleting a comment that belongs to another user with 404', () => {
    return request(app.getHttpServer())
      .delete(`/catalog/products/${productId}/comments/${commentId}`)
      .set('Authorization', `Bearer ${accessTokenB}`)
      .expect(404);
  });

  it('lets the author delete their own comment', async () => {
    await request(app.getHttpServer())
      .delete(`/catalog/products/${productId}/comments/${commentId}`)
      .set('Authorization', `Bearer ${accessTokenA}`)
      .expect(204);

    const response = await request(app.getHttpServer())
      .get(`/catalog/products/${productId}/comments`)
      .expect(200);
    expect((response.body as CommentListResponseBody).total).toBe(0);
  });
  describe('replies', () => {
    let rootId: string;
    let level2Id: string;
    let level3Id: string;

    const post = (body: string, parentId?: string) =>
      request(app.getHttpServer())
        .post(`/catalog/products/${productId}/comments`)
        .set('Authorization', `Bearer ${accessTokenA}`)
        .send(parentId ? { body, parentId } : { body })
        .expect(201);

    afterAll(async () => {
      await prisma.comment.deleteMany({ where: { productId } });
    });

    it('nests replies one level per reply, up to depth 3', async () => {
      const root = (await post('Root comment')).body as CommentResponseBody;
      rootId = root.id;
      const level2 = (await post('Second level', rootId))
        .body as CommentResponseBody;
      const level3 = (await post('Third level', level2.id))
        .body as CommentResponseBody;
      level2Id = level2.id;
      level3Id = level3.id;

      expect(root).toMatchObject({ parentId: null, depth: 1 });
      expect(level2).toMatchObject({ parentId: rootId, depth: 2 });
      expect(level3).toMatchObject({ parentId: level2Id, depth: 3 });
    });

    it('flattens a reply to a depth-3 comment alongside it instead of deeper', async () => {
      const response = await post('Fourth attempt', level3Id);
      const body = response.body as CommentResponseBody;

      expect(body.depth).toBe(3);
      expect(body.parentId).toBe(level2Id);
    });

    it('returns each root immediately followed by its own subtree', async () => {
      const response = await request(app.getHttpServer())
        .get(`/catalog/products/${productId}/comments`)
        .expect(200);

      const body = response.body as CommentListResponseBody;
      // 1 root + 1 second-level + 2 flattened third-level.
      expect(body.total).toBe(4);
      expect(body.rootTotal).toBe(1);
      expect(body.items.map((item) => item.depth)).toEqual([1, 2, 3, 3]);
      expect(body.items[0].id).toBe(rootId);
    });

    it('404s when replying to a comment that does not exist', () => {
      return request(app.getHttpServer())
        .post(`/catalog/products/${productId}/comments`)
        .set('Authorization', `Bearer ${accessTokenA}`)
        .send({ body: 'orphan', parentId: randomUUID() })
        .expect(404);
    });

    it('rejects a parentId that is not a uuid', () => {
      return request(app.getHttpServer())
        .post(`/catalog/products/${productId}/comments`)
        .set('Authorization', `Bearer ${accessTokenA}`)
        .send({ body: 'bad parent', parentId: 'not-a-uuid' })
        .expect(400);
    });

    it('deletes a whole subtree along with its root', async () => {
      await request(app.getHttpServer())
        .delete(`/catalog/products/${productId}/comments/${rootId}`)
        .set('Authorization', `Bearer ${accessTokenA}`)
        .expect(204);

      const response = await request(app.getHttpServer())
        .get(`/catalog/products/${productId}/comments`)
        .expect(200);
      expect((response.body as CommentListResponseBody).total).toBe(0);
    });
  });

  describe('likes', () => {
    let likedId: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post(`/catalog/products/${productId}/comments`)
        .set('Authorization', `Bearer ${accessTokenA}`)
        .send({ body: 'Likeable comment' })
        .expect(201);
      likedId = (response.body as CommentResponseBody).id;
    });

    afterAll(async () => {
      await prisma.comment.deleteMany({ where: { productId } });
    });

    const like = (token: string) =>
      request(app.getHttpServer())
        .post(`/catalog/products/${productId}/comments/${likedId}/likes`)
        .set('Authorization', `Bearer ${token}`);

    const unlike = (token: string) =>
      request(app.getHttpServer())
        .delete(`/catalog/products/${productId}/comments/${likedId}/likes`)
        .set('Authorization', `Bearer ${token}`);

    it('rejects liking without a token', () => {
      return request(app.getHttpServer())
        .post(`/catalog/products/${productId}/comments/${likedId}/likes`)
        .expect(401);
    });

    it('starts at zero likes, unliked', async () => {
      const response = await request(app.getHttpServer())
        .get(`/catalog/products/${productId}/comments`)
        .expect(200);

      const item = (response.body as CommentListResponseBody).items[0];
      expect(item).toMatchObject({ likeCount: 0, likedByViewer: false });
    });

    it('counts a like and is idempotent on a repeat', async () => {
      const first = await like(accessTokenB).expect(200);
      expect(first.body as LikeResponseBody).toMatchObject({
        liked: true,
        likeCount: 1,
      });

      const second = await like(accessTokenB).expect(200);
      expect((second.body as LikeResponseBody).likeCount).toBe(1);
    });

    it('counts a second user separately', async () => {
      const response = await like(accessTokenA).expect(200);
      expect((response.body as LikeResponseBody).likeCount).toBe(2);
    });

    it('reports likedByViewer per reader, and counts publicly', async () => {
      const asB = await request(app.getHttpServer())
        .get(`/catalog/products/${productId}/comments`)
        .set('Authorization', `Bearer ${accessTokenB}`)
        .expect(200);
      expect((asB.body as CommentListResponseBody).items[0]).toMatchObject({
        likeCount: 2,
        likedByViewer: true,
      });

      const anonymous = await request(app.getHttpServer())
        .get(`/catalog/products/${productId}/comments`)
        .expect(200);
      expect(
        (anonymous.body as CommentListResponseBody).items[0],
      ).toMatchObject({ likeCount: 2, likedByViewer: false });
    });

    it('ignores a malformed token on the public list instead of 401ing', async () => {
      const response = await request(app.getHttpServer())
        .get(`/catalog/products/${productId}/comments`)
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(200);

      expect((response.body as CommentListResponseBody).items[0]).toMatchObject(
        { likeCount: 2, likedByViewer: false },
      );
    });

    it('removes a like and is idempotent on a repeat', async () => {
      const first = await unlike(accessTokenB).expect(200);
      expect(first.body as LikeResponseBody).toMatchObject({
        liked: false,
        likeCount: 1,
      });

      const second = await unlike(accessTokenB).expect(200);
      expect((second.body as LikeResponseBody).likeCount).toBe(1);
    });

    // Regression: Prisma's upsert is a read-then-write, so concurrent likes
    // of the same comment used to race and surface a P2002 as a 409 to
    // whichever request lost. Found by clicking the heart rapidly in the UI.
    it('survives concurrent likes of the same comment from the same user', async () => {
      await unlike(accessTokenA).expect(200);
      await unlike(accessTokenB).expect(200);

      const responses = await Promise.all(
        Array.from({ length: 8 }, () => like(accessTokenA)),
      );

      for (const response of responses) {
        expect(response.status).toBe(200);
      }
      expect(
        (responses[responses.length - 1].body as LikeResponseBody).likeCount,
      ).toBe(1);

      await unlike(accessTokenA).expect(200);
    });

    it('survives concurrent unlikes', async () => {
      await like(accessTokenA).expect(200);

      const responses = await Promise.all(
        Array.from({ length: 8 }, () => unlike(accessTokenA)),
      );

      for (const response of responses) {
        expect(response.status).toBe(200);
      }
      expect(
        (responses[responses.length - 1].body as LikeResponseBody).likeCount,
      ).toBe(0);
    });

    it('404s when liking a comment that does not exist', () => {
      return request(app.getHttpServer())
        .post(`/catalog/products/${productId}/comments/${randomUUID()}/likes`)
        .set('Authorization', `Bearer ${accessTokenA}`)
        .expect(404);
    });
  });

  describe('image attachment', () => {
    const endpoint = () => `/catalog/products/${productId}/comments`;
    let photo: Buffer;

    // Maps a public URL back to where the local storage driver (the default,
    // and what this suite runs against) put the file.
    const storedPath = (url: string) =>
      join(
        resolveLocalStorageDir(),
        ...new URL(url).pathname.split('/').slice(2),
      );

    const list = async () =>
      (
        await request(app.getHttpServer())
          .get(endpoint())
          .set('Authorization', `Bearer ${accessTokenA}`)
          .expect(200)
      ).body as CommentListResponseBody;

    beforeAll(async () => {
      photo = await sharp({
        create: {
          width: 2000,
          height: 1000,
          channels: 3,
          background: { r: 30, g: 120, b: 200 },
        },
      })
        .png()
        .toBuffer();
    });

    afterAll(async () => {
      // Through the API rather than Prisma so the stored files go too.
      for (const item of (await list()).items.filter((i) => !i.parentId)) {
        await request(app.getHttpServer())
          .delete(`${endpoint()}/${item.id}`)
          .set('Authorization', `Bearer ${accessTokenA}`);
      }
      await prisma.comment.deleteMany({ where: { productId } });
    });

    it('rejects an image upload without a token', () => {
      return request(app.getHttpServer())
        .post(endpoint())
        .field('body', 'hello')
        .attach('image', photo, 'photo.png')
        .expect(401);
    });

    it('keeps a text-only comment free of any image', async () => {
      const response = await request(app.getHttpServer())
        .post(endpoint())
        .set('Authorization', `Bearer ${accessTokenA}`)
        .send({ body: 'Just words' })
        .expect(201);
      expect((response.body as CommentResponseBody).hasImage).toBe(false);

      const items = (await list()).items;
      expect(items[0]).toMatchObject({ image: null, hasImage: false });
    });

    let withImageId: string;
    let image: NonNullable<CommentResponseBody['image']>;

    it('stores one optimized image with a multipart comment', async () => {
      const response = await request(app.getHttpServer())
        .post(endpoint())
        .set('Authorization', `Bearer ${accessTokenA}`)
        .field('body', 'Here is how it looks on me')
        .attach('image', photo, 'photo.png')
        .expect(201);

      const created = response.body as CommentResponseBody;
      expect(created.body).toBe('Here is how it looks on me');
      expect(created.hasImage).toBe(true);
      withImageId = created.id;

      const item = (await list()).items.find((i) => i.id === withImageId);
      expect(item?.image?.url).toMatch(
        /\/uploads\/comments\/[0-9a-f-]{36}\.webp$/,
      );
      expect(item?.image?.thumbnailUrl).toMatch(
        /\/uploads\/comments\/[0-9a-f-]{36}-thumb\.webp$/,
      );
      // 2000x1000 scaled to fit the 1600 box.
      expect(item?.image).toMatchObject({ width: 1600, height: 800 });
      image = item!.image!;

      // What is on disk is the re-encoded WebP, not the PNG that was sent.
      // Read into memory first: handing sharp a path keeps the file open,
      // which on Windows would block the delete tested further down.
      const full = await sharp(readFileSync(storedPath(image.url))).metadata();
      expect(full).toMatchObject({ format: 'webp', width: 1600, height: 800 });
      const thumbnail = await sharp(
        readFileSync(storedPath(image.thumbnailUrl)),
      ).metadata();
      expect(thumbnail).toMatchObject({
        format: 'webp',
        width: 480,
        height: 240,
      });
    });

    it('accepts an image on a reply as well', async () => {
      const response = await request(app.getHttpServer())
        .post(endpoint())
        .set('Authorization', `Bearer ${accessTokenB}`)
        .field('body', 'Mine looks the same')
        .field('parentId', withImageId)
        .attach('image', photo, 'photo.png')
        .expect(201);

      expect(response.body as CommentResponseBody).toMatchObject({
        parentId: withImageId,
        depth: 2,
        hasImage: true,
      });
    });

    it('rejects a second image on the same comment', async () => {
      const before = (await list()).total;

      await request(app.getHttpServer())
        .post(endpoint())
        .set('Authorization', `Bearer ${accessTokenA}`)
        .field('body', 'Two pictures')
        .attach('image', photo, 'one.png')
        .attach('image', photo, 'two.png')
        .expect(400);

      expect((await list()).total).toBe(before);
    });

    it('rejects a file that only claims to be an image', async () => {
      const before = (await list()).total;

      await request(app.getHttpServer())
        .post(endpoint())
        .set('Authorization', `Bearer ${accessTokenA}`)
        .field('body', 'Totally a picture')
        .attach('image', Buffer.from('#!/bin/sh\necho nope\n'), {
          filename: 'photo.png',
          contentType: 'image/png',
        })
        .expect(400);

      expect((await list()).total).toBe(before);
    });

    it('rejects an image over the size limit', () => {
      return request(app.getHttpServer())
        .post(endpoint())
        .set('Authorization', `Bearer ${accessTokenA}`)
        .field('body', 'Huge')
        .attach('image', Buffer.alloc(8 * 1024 * 1024 + 1), 'huge.png')
        .expect(413);
    });

    it('still validates the text fields of a multipart comment', () => {
      return request(app.getHttpServer())
        .post(endpoint())
        .set('Authorization', `Bearer ${accessTokenA}`)
        .attach('image', photo, 'photo.png')
        .expect(400);
    });

    it('stores nothing when the text fails moderation', async () => {
      const dir = join(resolveLocalStorageDir(), 'comments');
      const before = readdirSync(dir).length;

      await request(app.getHttpServer())
        .post(endpoint())
        .set('Authorization', `Bearer ${accessTokenA}`)
        .field('body', 'This product is shit')
        .attach('image', photo, 'photo.png')
        .expect(400);

      expect(readdirSync(dir).length).toBe(before);
    });

    it('removes the files of a deleted comment and of the replies deleted with it', async () => {
      const reply = (await list()).items.find(
        (i) => i.parentId === withImageId,
      );
      const paths = [
        storedPath(image.url),
        storedPath(image.thumbnailUrl),
        storedPath(reply!.image!.url),
        storedPath(reply!.image!.thumbnailUrl),
      ];
      expect(paths.every((path) => existsSync(path))).toBe(true);

      await request(app.getHttpServer())
        .delete(`${endpoint()}/${withImageId}`)
        .set('Authorization', `Bearer ${accessTokenA}`)
        .expect(204);

      expect(paths.some((path) => existsSync(path))).toBe(false);
    });
  });
});
