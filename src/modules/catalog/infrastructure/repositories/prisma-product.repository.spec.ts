import {
  Product,
  ProductStatus,
} from '@/modules/catalog/domain/entities/product.entity';
import type { PrismaService } from '@/shared/infrastructure/prisma/prisma.service';
import { PrismaProductRepository } from './prisma-product.repository';

function makePrismaMock() {
  const tx = {
    productVariant: { deleteMany: jest.fn(), upsert: jest.fn() },
    productImage: { deleteMany: jest.fn(), upsert: jest.fn() },
    product: { findUniqueOrThrow: jest.fn() },
  };
  return {
    product: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    // The callback's parameter is named `client`, not `tx`: named `tx` it
    // shadowed the outer `tx` inside its own type annotation, which is a
    // compile error (TS2502) that kept `tsc --noEmit` red for the project.
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
    tx,
  };
}

const rawRecord = {
  id: 'product-1',
  name: 'Classic Tee',
  slug: 'classic-tee',
  description: null,
  basePriceCents: 2500,
  currency: 'USD',
  status: ProductStatus.PUBLISHED,
  categories: [{ id: 'category-1', name: 'Apparel', slug: 'apparel' }],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  variants: [
    {
      id: 'variant-1',
      size: 'M',
      color: 'black',
      sku: 'TEE-M-BLK',
      stock: 10,
      priceCents: null,
    },
  ],
  images: [
    {
      id: 'image-1',
      url: 'https://example.com/tee.png',
      altText: null,
      position: 0,
      variants: [{ id: 'variant-1' }],
    },
  ],
};

describe('PrismaProductRepository', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let repository: PrismaProductRepository;

  beforeEach(() => {
    prisma = makePrismaMock();
    repository = new PrismaProductRepository(
      prisma as unknown as PrismaService,
    );
  });

  it('maps Prisma records to Product domain entities in findMany', async () => {
    prisma.product.findMany.mockResolvedValue([rawRecord]);

    const [product] = await repository.findMany({
      categoryIds: ['category-1'],
      skip: 0,
      take: 20,
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          categories: { some: { id: { in: ['category-1'] } } },
          status: undefined,
        },
        skip: 0,
        take: 20,
      }),
    );
    expect(product).toBeInstanceOf(Product);
    expect(product.id).toBe('product-1');
    expect(product.variants).toEqual(rawRecord.variants);
    expect(product.images).toEqual([
      {
        id: 'image-1',
        url: 'https://example.com/tee.png',
        altText: null,
        position: 0,
        variantIds: ['variant-1'],
      },
    ]);
  });

  it('builds a case-insensitive OR filter across name/description when searching', async () => {
    prisma.product.findMany.mockResolvedValue([rawRecord]);

    await repository.findMany({ search: 'hoodie' });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: 'hoodie', mode: 'insensitive' } },
            { description: { contains: 'hoodie', mode: 'insensitive' } },
          ],
        }),
      }),
    );

    await repository.count({ search: 'hoodie' });

    expect(prisma.product.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: 'hoodie', mode: 'insensitive' } },
            { description: { contains: 'hoodie', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('throws if Prisma returns a status that is not a known ProductStatus', async () => {
    prisma.product.findMany.mockResolvedValue([
      { ...rawRecord, status: 'SOME_FUTURE_STATUS' },
    ]);

    await expect(repository.findMany({})).rejects.toThrow(
      /Unknown product status/,
    );
  });

  it('returns null from findBySlug when no record exists', async () => {
    prisma.product.findUnique.mockResolvedValue(null);

    const product = await repository.findBySlug('missing');

    expect(product).toBeNull();
  });

  it('returns a mapped Product from findBySlug when a record exists', async () => {
    prisma.product.findUnique.mockResolvedValue(rawRecord);

    const product = await repository.findBySlug('classic-tee');

    expect(product).toBeInstanceOf(Product);
    expect(product?.slug).toBe('classic-tee');
  });

  it('slugExists returns true only when a record is found', async () => {
    prisma.product.findUnique.mockResolvedValueOnce({ id: 'product-1' });
    await expect(repository.slugExists('classic-tee')).resolves.toBe(true);

    prisma.product.findUnique.mockResolvedValueOnce(null);
    await expect(repository.slugExists('missing')).resolves.toBe(false);
  });

  it('create() inserts the product with its variants, returning the mapped domain entity', async () => {
    const product = Product.create({
      name: 'Classic Tee',
      slug: 'classic-tee',
      description: null,
      basePriceCents: 2500,
      currency: 'USD',
      categoryIds: ['category-1'],
      variants: [
        {
          size: 'M',
          color: 'black',
          sku: 'TEE-M-BLK',
          stock: 10,
          priceCents: null,
        },
      ],
    });

    let createArgs:
      | {
          data: {
            id: string;
            name: string;
            variants: { create: { sku: string }[] };
          };
        }
      | undefined;
    prisma.product.create.mockImplementation((args: typeof createArgs) => {
      createArgs = args;
      return Promise.resolve({
        ...rawRecord,
        id: product.id,
        status: ProductStatus.DRAFT,
      });
    });

    const result = await repository.create(product);

    expect(createArgs?.data.id).toBe(product.id);
    expect(createArgs?.data.name).toBe('Classic Tee');
    expect(createArgs?.data.variants.create[0].sku).toBe('TEE-M-BLK');
    expect(result).toBeInstanceOf(Product);
  });

  it('create() connects a tagged image to its variants, and leaves an untagged image unconnected', async () => {
    const product = Product.create({
      name: 'Classic Tee',
      slug: 'classic-tee',
      description: null,
      basePriceCents: 2500,
      currency: 'USD',
      categoryIds: ['category-1'],
      variants: [
        {
          size: 'M',
          color: 'black',
          sku: 'TEE-M-BLK',
          stock: 10,
          priceCents: null,
        },
        {
          size: 'M',
          color: 'blue',
          sku: 'TEE-M-BLU',
          stock: 4,
          priceCents: null,
        },
      ],
      images: [
        {
          url: 'https://example.com/black.png',
          altText: null,
          position: 0,
          variantIndexes: [0],
        },
        { url: 'https://example.com/all.png', altText: null, position: 1 },
      ],
    });

    let createArgs:
      | {
          data: {
            images: {
              create: { variants?: { connect: { id: string }[] } }[];
            };
          };
        }
      | undefined;
    prisma.product.create.mockImplementation((args: typeof createArgs) => {
      createArgs = args;
      return Promise.resolve({
        ...rawRecord,
        id: product.id,
        status: ProductStatus.DRAFT,
      });
    });

    await repository.create(product);

    const [blackImage, untaggedImage] = createArgs!.data.images.create;
    expect(blackImage.variants?.connect).toEqual([
      { id: product.variants[0].id },
    ]);
    expect(untaggedImage.variants).toBeUndefined();
  });

  describe('updateVariants', () => {
    it('deletes variants left out of the list, then upserts the kept/created ones', async () => {
      prisma.tx.product.findUniqueOrThrow.mockResolvedValue(rawRecord);

      const result = await repository.updateVariants('product-1', [
        {
          id: 'variant-1',
          size: 'M',
          color: 'black',
          sku: 'TEE-M-BLK',
          stock: 3,
          priceCents: null,
        },
      ]);

      expect(prisma.tx.productVariant.deleteMany).toHaveBeenCalledWith({
        where: { productId: 'product-1', id: { notIn: ['variant-1'] } },
      });
      expect(prisma.tx.productVariant.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'variant-1' },
          update: expect.objectContaining({ stock: 3 }),
        }),
      );
      expect(result).toBeInstanceOf(Product);
    });

    it('deletes every variant when given an empty list', async () => {
      prisma.tx.product.findUniqueOrThrow.mockResolvedValue({
        ...rawRecord,
        variants: [],
      });

      await repository.updateVariants('product-1', []);

      expect(prisma.tx.productVariant.deleteMany).toHaveBeenCalledWith({
        where: { productId: 'product-1', id: { notIn: [] } },
      });
      expect(prisma.tx.productVariant.upsert).not.toHaveBeenCalled();
    });
  });

  describe('updateImages', () => {
    it('deletes images left out of the list, then upserts the kept/created ones with their variant tags', async () => {
      prisma.tx.product.findUniqueOrThrow.mockResolvedValue(rawRecord);

      await repository.updateImages('product-1', [
        {
          id: 'image-1',
          url: 'https://example.com/tee.png',
          altText: null,
          position: 0,
          variantIds: ['variant-1'],
        },
      ]);

      expect(prisma.tx.productImage.deleteMany).toHaveBeenCalledWith({
        where: { productId: 'product-1', id: { notIn: ['image-1'] } },
      });
      expect(prisma.tx.productImage.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'image-1' },
          update: expect.objectContaining({
            variants: { set: [{ id: 'variant-1' }] },
          }),
        }),
      );
    });
  });
});
