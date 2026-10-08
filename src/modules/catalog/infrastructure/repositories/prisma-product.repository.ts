import { Injectable } from '@nestjs/common';
import type { Prisma } from '@generated/prisma/client';
import { PrismaService } from '@/shared/infrastructure/prisma/prisma.service';
import {
  Product,
  ProductImageProps,
  ProductStatus,
  ProductVariantProps,
} from '@/modules/catalog/domain/entities/product.entity';
import {
  FindProductsParams,
  ProductRepository,
} from '@/modules/catalog/domain/repositories/product.repository';

function toDomainStatus(status: string): ProductStatus {
  switch (status) {
    case 'DRAFT':
      return ProductStatus.DRAFT;
    case 'PUBLISHED':
      return ProductStatus.PUBLISHED;
    case 'ARCHIVED':
      return ProductStatus.ARCHIVED;
    default:
      throw new Error(`Unknown product status from persistence: "${status}"`);
  }
}

const productInclude = {
  variants: true,
  images: {
    orderBy: { position: 'asc' },
    include: { variants: { select: { id: true } } },
  },
  categories: true,
} satisfies Prisma.ProductInclude;

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

function toWhere(
  params: Pick<FindProductsParams, 'categoryIds' | 'status' | 'search'>,
): Prisma.ProductWhereInput {
  return {
    categories: params.categoryIds?.length
      ? { some: { id: { in: params.categoryIds } } }
      : undefined,
    status: params.status,
    OR: params.search
      ? [
          { name: { contains: params.search, mode: 'insensitive' } },
          { description: { contains: params.search, mode: 'insensitive' } },
        ]
      : undefined,
  };
}

@Injectable()
export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = productInclude;

  async findMany(params: FindProductsParams): Promise<Product[]> {
    const records = await this.prisma.product.findMany({
      where: toWhere(params),
      include: this.include,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    });

    return records.map((record) => this.toDomain(record));
  }

  async count(
    params: Pick<FindProductsParams, 'categoryIds' | 'status' | 'search'>,
  ): Promise<number> {
    return this.prisma.product.count({
      where: toWhere(params),
    });
  }

  async findById(id: string): Promise<Product | null> {
    const record = await this.prisma.product.findUnique({
      where: { id },
      include: this.include,
    });
    return record ? this.toDomain(record) : null;
  }

  async findBySlug(slug: string): Promise<Product | null> {
    const record = await this.prisma.product.findUnique({
      where: { slug },
      include: this.include,
    });
    return record ? this.toDomain(record) : null;
  }

  async slugExists(slug: string): Promise<boolean> {
    const record = await this.prisma.product.findUnique({
      where: { slug },
      select: { id: true },
    });
    return record !== null;
  }

  async create(product: Product): Promise<Product> {
    const props = product.toPersistenceProps();

    const record = await this.prisma.product.create({
      data: {
        id: props.id,
        name: props.name,
        slug: props.slug,
        description: props.description,
        basePriceCents: props.basePriceCents,
        currency: props.currency,
        status: props.status,
        categories: {
          connect: props.categoryIds.map((id) => ({ id })),
        },
        variants: {
          create: props.variants.map((variant) => ({
            id: variant.id,
            size: variant.size,
            color: variant.color,
            sku: variant.sku,
            stock: variant.stock,
            priceCents: variant.priceCents,
          })),
        },
        images: {
          create: props.images.map((image) => ({
            id: image.id,
            url: image.url,
            altText: image.altText,
            position: image.position,
            variants:
              image.variantIds.length > 0
                ? { connect: image.variantIds.map((id) => ({ id })) }
                : undefined,
          })),
        },
      },
      include: this.include,
    });

    return this.toDomain(record);
  }

  async update(product: Product): Promise<Product> {
    const props = product.toPersistenceProps();

    const record = await this.prisma.product.update({
      where: { id: props.id },
      data: {
        name: props.name,
        description: props.description,
        basePriceCents: props.basePriceCents,
        currency: props.currency,
        status: props.status,
        // Full replace of the m2m relation, matching the domain's
        // categoryIds array semantics (not an incremental add/remove).
        categories: { set: props.categoryIds.map((id) => ({ id })) },
      },
      include: this.include,
    });

    return this.toDomain(record);
  }

  async updateVariants(
    productId: string,
    variants: ProductVariantProps[],
  ): Promise<Product> {
    return this.prisma.$transaction(async (tx) => {
      const keepIds = variants.map((variant) => variant.id);
      await tx.productVariant.deleteMany({
        where: { productId, id: { notIn: keepIds } },
      });
      for (const variant of variants) {
        await tx.productVariant.upsert({
          where: { id: variant.id },
          update: {
            size: variant.size,
            color: variant.color,
            sku: variant.sku,
            stock: variant.stock,
            priceCents: variant.priceCents,
          },
          create: {
            id: variant.id,
            productId,
            size: variant.size,
            color: variant.color,
            sku: variant.sku,
            stock: variant.stock,
            priceCents: variant.priceCents,
          },
        });
      }

      const record = await tx.product.findUniqueOrThrow({
        where: { id: productId },
        include: this.include,
      });
      return this.toDomain(record);
    });
  }

  async updateImages(
    productId: string,
    images: ProductImageProps[],
  ): Promise<Product> {
    return this.prisma.$transaction(async (tx) => {
      const keepIds = images.map((image) => image.id);
      await tx.productImage.deleteMany({
        where: { productId, id: { notIn: keepIds } },
      });
      for (const image of images) {
        await tx.productImage.upsert({
          where: { id: image.id },
          update: {
            url: image.url,
            altText: image.altText,
            position: image.position,
            variants: { set: image.variantIds.map((id) => ({ id })) },
          },
          create: {
            id: image.id,
            productId,
            url: image.url,
            altText: image.altText,
            position: image.position,
            variants: { connect: image.variantIds.map((id) => ({ id })) },
          },
        });
      }

      const record = await tx.product.findUniqueOrThrow({
        where: { id: productId },
        include: this.include,
      });
      return this.toDomain(record);
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.product.delete({ where: { id } });
  }

  private toDomain(record: ProductWithRelations): Product {
    return Product.fromPersistence({
      id: record.id,
      name: record.name,
      slug: record.slug,
      description: record.description,
      basePriceCents: record.basePriceCents,
      currency: record.currency,
      status: toDomainStatus(record.status),
      categoryIds: record.categories.map((category) => category.id),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      variants: record.variants.map((variant) => ({
        id: variant.id,
        size: variant.size,
        color: variant.color,
        sku: variant.sku,
        stock: variant.stock,
        priceCents: variant.priceCents,
      })),
      images: record.images.map((image) => ({
        id: image.id,
        url: image.url,
        altText: image.altText,
        position: image.position,
        variantIds: image.variants.map((variant) => variant.id),
      })),
    });
  }
}
