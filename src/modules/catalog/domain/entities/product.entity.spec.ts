import { DomainError } from '@/shared/domain/domain-error';
import { Product, ProductStatus } from './product.entity';

describe('Product entity', () => {
  const validProps = {
    name: 'Classic Tee',
    slug: 'classic-tee',
    description: 'A classic t-shirt',
    basePriceCents: 2500,
    currency: 'USD',
    categoryIds: ['category-1'],
  };

  describe('create', () => {
    it('creates a product in DRAFT status with a generated id', () => {
      const product = Product.create(validProps);

      expect(product.id).toEqual(expect.any(String));
      expect(product.status).toBe(ProductStatus.DRAFT);
      expect(product.isPublished()).toBe(false);
      expect(product.name).toBe(validProps.name);
      expect(product.images).toEqual([]);
    });

    it('generates an id for each variant', () => {
      const product = Product.create({
        ...validProps,
        variants: [
          {
            size: 'M',
            color: 'black',
            sku: 'TEE-M-BLK',
            stock: 10,
            priceCents: null,
          },
          {
            size: 'L',
            color: 'black',
            sku: 'TEE-L-BLK',
            stock: 5,
            priceCents: null,
          },
        ],
      });

      expect(product.variants).toHaveLength(2);
      expect(product.variants[0].id).toEqual(expect.any(String));
      expect(product.variants[0].id).not.toBe(product.variants[1].id);
    });

    it('defaults to an empty variants list', () => {
      const product = Product.create(validProps);
      expect(product.variants).toEqual([]);
    });

    it('rejects a negative base price', () => {
      expect(() =>
        Product.create({ ...validProps, basePriceCents: -1 }),
      ).toThrow(DomainError);
      expect(() =>
        Product.create({ ...validProps, basePriceCents: -1 }),
      ).toThrow('basePriceCents cannot be negative');
    });

    it('rejects an empty name', () => {
      expect(() => Product.create({ ...validProps, name: '   ' })).toThrow(
        'Product name cannot be empty',
      );
    });

    it('rejects an empty categoryIds list', () => {
      expect(() => Product.create({ ...validProps, categoryIds: [] })).toThrow(
        'Product must have at least one category',
      );
    });

    it('rejects a variant with a blank sku, size, or color', () => {
      expect(() =>
        Product.create({
          ...validProps,
          variants: [
            {
              size: '  ',
              color: 'black',
              sku: 'TEE-M-BLK',
              stock: 10,
              priceCents: null,
            },
          ],
        }),
      ).toThrow(DomainError);
    });

    it('rejects a variant with negative stock', () => {
      expect(() =>
        Product.create({
          ...validProps,
          variants: [
            {
              size: 'M',
              color: 'black',
              sku: 'TEE-M-BLK',
              stock: -1,
              priceCents: null,
            },
          ],
        }),
      ).toThrow('Variant stock cannot be negative');
    });

    it('rejects a variant with a negative priceCents override', () => {
      expect(() =>
        Product.create({
          ...validProps,
          variants: [
            {
              size: 'M',
              color: 'black',
              sku: 'TEE-M-BLK',
              stock: 10,
              priceCents: -1,
            },
          ],
        }),
      ).toThrow('Variant priceCents cannot be negative');
    });

    it('defaults an image to applying to every variant when no variantIndexes are given', () => {
      const product = Product.create({
        ...validProps,
        variants: [
          {
            size: 'M',
            color: 'black',
            sku: 'TEE-M-BLK',
            stock: 10,
            priceCents: null,
          },
        ],
        images: [
          { url: 'https://example.com/tee.png', altText: null, position: 0 },
        ],
      });

      expect(product.images[0].variantIds).toEqual([]);
    });

    it('resolves an image variantIndexes entry to the generated id of that variant', () => {
      const product = Product.create({
        ...validProps,
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
          {
            url: 'https://example.com/blue.png',
            altText: null,
            position: 1,
            variantIndexes: [1],
          },
        ],
      });

      expect(product.images[0].variantIds).toEqual([product.variants[0].id]);
      expect(product.images[1].variantIds).toEqual([product.variants[1].id]);
    });

    it('rejects an image variantIndexes entry that is out of range', () => {
      expect(() =>
        Product.create({
          ...validProps,
          variants: [
            {
              size: 'M',
              color: 'black',
              sku: 'TEE-M-BLK',
              stock: 10,
              priceCents: null,
            },
          ],
          images: [
            {
              url: 'https://example.com/tee.png',
              altText: null,
              position: 0,
              variantIndexes: [1],
            },
          ],
        }),
      ).toThrow('Image variant index 1 is out of range');
    });

    it('rejects duplicate size/color combinations across variants', () => {
      expect(() =>
        Product.create({
          ...validProps,
          variants: [
            {
              size: 'M',
              color: 'black',
              sku: 'TEE-M-BLK-1',
              stock: 10,
              priceCents: null,
            },
            {
              size: 'M',
              color: 'black',
              sku: 'TEE-M-BLK-2',
              stock: 5,
              priceCents: null,
            },
          ],
        }),
      ).toThrow('Variants must have a unique size/color combination');
    });
  });

  describe('update', () => {
    it('updates name/description/price/currency/categoryIds without touching variants', () => {
      const product = Product.create({
        ...validProps,
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
      const originalVariantId = product.variants[0].id;

      const updated = product.update({
        name: 'Deluxe Tee',
        description: 'Now with a pocket',
        basePriceCents: 3000,
        currency: 'EUR',
        categoryIds: ['category-2'],
      });

      expect(updated.name).toBe('Deluxe Tee');
      expect(updated.basePriceCents).toBe(3000);
      expect(updated.categoryIds).toEqual(['category-2']);
      expect(updated.variants).toHaveLength(1);
      expect(updated.variants[0].id).toBe(originalVariantId);
    });

    it('rejects an empty categoryIds list', () => {
      const product = Product.create(validProps);
      expect(() =>
        product.update({
          name: 'X',
          description: null,
          basePriceCents: 100,
          currency: 'USD',
          categoryIds: [],
        }),
      ).toThrow('Product must have at least one category');
    });

    it('rejects a negative basePriceCents', () => {
      const product = Product.create(validProps);
      expect(() =>
        product.update({
          name: 'X',
          description: null,
          basePriceCents: -1,
          currency: 'USD',
          categoryIds: ['category-1'],
        }),
      ).toThrow('basePriceCents cannot be negative');
    });
  });

  describe('updateVariants', () => {
    function productWithOneVariant() {
      return Product.create({
        ...validProps,
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
    }

    it('updates stock/priceCents on an existing variant, keeping its id and size/color/sku', () => {
      const product = productWithOneVariant();
      const originalId = product.variants[0].id;

      const updated = product.updateVariants([
        { id: originalId, stock: 2, priceCents: 500 },
      ]);

      expect(updated.variants).toHaveLength(1);
      expect(updated.variants[0]).toEqual({
        id: originalId,
        size: 'M',
        color: 'black',
        sku: 'TEE-M-BLK',
        stock: 2,
        priceCents: 500,
      });
    });

    it('creates a new variant (no id) alongside an existing one', () => {
      const product = productWithOneVariant();
      const originalId = product.variants[0].id;

      const updated = product.updateVariants([
        { id: originalId, stock: 10, priceCents: null },
        {
          size: 'M',
          color: 'blue',
          sku: 'TEE-M-BLU',
          stock: 4,
          priceCents: null,
        },
      ]);

      expect(updated.variants).toHaveLength(2);
      const newVariant = updated.variants.find((v) => v.color === 'blue');
      expect(newVariant?.id).toEqual(expect.any(String));
      expect(newVariant?.id).not.toBe(originalId);
    });

    it('deletes an existing variant left out of the submitted list', () => {
      const product = productWithOneVariant();
      const updated = product.updateVariants([]);
      expect(updated.variants).toEqual([]);
    });

    it('rejects an id that does not belong to this product', () => {
      const product = productWithOneVariant();
      expect(() =>
        product.updateVariants([
          { id: 'bogus-id', stock: 1, priceCents: null },
        ]),
      ).toThrow('not found on this product');
    });

    it('rejects negative stock on an existing variant', () => {
      const product = productWithOneVariant();
      const originalId = product.variants[0].id;
      expect(() =>
        product.updateVariants([
          { id: originalId, stock: -1, priceCents: null },
        ]),
      ).toThrow('Variant stock cannot be negative');
    });

    it('rejects a blank size/color/sku on a new variant', () => {
      const product = productWithOneVariant();
      expect(() =>
        product.updateVariants([
          { size: '  ', color: 'blue', sku: 'X', stock: 1, priceCents: null },
        ]),
      ).toThrow('Variant sku, size and color cannot be empty');
    });

    it('rejects a duplicate size/color combination across the resolved list', () => {
      const product = productWithOneVariant();
      const originalId = product.variants[0].id;
      expect(() =>
        product.updateVariants([
          { id: originalId, stock: 10, priceCents: null },
          {
            size: 'M',
            color: 'black',
            sku: 'TEE-M-BLK-2',
            stock: 1,
            priceCents: null,
          },
        ]),
      ).toThrow('Variants must have a unique size/color combination');
    });
  });

  describe('updateImages', () => {
    function productWithOneVariant() {
      return Product.create({
        ...validProps,
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
    }

    it('adds a new image tagged to an existing variant', () => {
      const product = productWithOneVariant();
      const variantId = product.variants[0].id;

      const updated = product.updateImages([
        {
          url: 'https://example.com/black.png',
          altText: null,
          position: 0,
          variantIds: [variantId],
        },
      ]);

      expect(updated.images).toHaveLength(1);
      expect(updated.images[0].variantIds).toEqual([variantId]);
      expect(updated.images[0].id).toEqual(expect.any(String));
    });

    it('keeps an existing image id when re-submitted with the same id', () => {
      const product = productWithOneVariant().updateImages([
        {
          url: 'https://example.com/a.png',
          altText: null,
          position: 0,
          variantIds: [],
        },
      ]);
      const existingId = product.images[0].id;

      const updated = product.updateImages([
        {
          id: existingId,
          url: 'https://example.com/a.png',
          altText: 'Front',
          position: 0,
          variantIds: [],
        },
      ]);

      expect(updated.images[0].id).toBe(existingId);
      expect(updated.images[0].altText).toBe('Front');
    });

    it('deletes an existing image left out of the submitted list', () => {
      const product = productWithOneVariant().updateImages([
        {
          url: 'https://example.com/a.png',
          altText: null,
          position: 0,
          variantIds: [],
        },
      ]);
      const updated = product.updateImages([]);
      expect(updated.images).toEqual([]);
    });

    it('rejects an image tagged to a variant id that does not belong to this product', () => {
      const product = productWithOneVariant();
      expect(() =>
        product.updateImages([
          {
            url: 'https://example.com/a.png',
            altText: null,
            position: 0,
            variantIds: ['bogus'],
          },
        ]),
      ).toThrow("doesn't exist on this product");
    });
  });

  describe('changeStatus', () => {
    it('returns a product with the new status', () => {
      const product = Product.create(validProps);
      const published = product.changeStatus(ProductStatus.PUBLISHED);
      expect(published.status).toBe(ProductStatus.PUBLISHED);
      expect(published.isPublished()).toBe(true);
      expect(product.status).toBe(ProductStatus.DRAFT); // original untouched
    });
  });

  describe('totalStock', () => {
    it('sums stock across all variants', () => {
      const product = Product.create({
        ...validProps,
        variants: [
          {
            size: 'M',
            color: 'black',
            sku: 'TEE-M-BLK',
            stock: 10,
            priceCents: null,
          },
          {
            size: 'L',
            color: 'black',
            sku: 'TEE-L-BLK',
            stock: 5,
            priceCents: null,
          },
        ],
      });

      expect(product.totalStock()).toBe(15);
    });

    it('returns 0 when there are no variants', () => {
      const product = Product.create(validProps);
      expect(product.totalStock()).toBe(0);
    });
  });

  describe('fromPersistence / toPersistenceProps', () => {
    it('round-trips props without mutation', () => {
      const props = {
        id: 'product-1',
        name: 'Classic Tee',
        slug: 'classic-tee',
        description: null,
        basePriceCents: 2500,
        currency: 'USD',
        status: ProductStatus.PUBLISHED,
        categoryIds: ['category-1'],
        variants: [],
        images: [],
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      };

      const product = Product.fromPersistence(props);

      expect(product.toPersistenceProps()).toEqual(props);
      expect(product.isPublished()).toBe(true);
    });
  });
});
