import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/shared/infrastructure/prisma/prisma.service';
import {
  OrderableVariant,
  ProductCatalogPort,
} from '@/modules/orders/domain/repositories/product-catalog.port';

interface CatalogImage {
  url: string;
  variants: { id: string }[];
}

// An image with no variant tags applies to every variant.
function firstImageFor(
  variantId: string,
  images: CatalogImage[],
): string | null {
  const match = images.find(
    (image) =>
      image.variants.length === 0 ||
      image.variants.some((variant) => variant.id === variantId),
  );
  return (match ?? images[0])?.url ?? null;
}

@Injectable()
export class PrismaProductCatalogAdapter implements ProductCatalogPort {
  constructor(private readonly prisma: PrismaService) {}

  async findVariantsByIds(
    productVariantIds: string[],
  ): Promise<OrderableVariant[]> {
    if (productVariantIds.length === 0) {
      return [];
    }

    const records = await this.prisma.productVariant.findMany({
      where: { id: { in: productVariantIds } },
      include: {
        product: {
          include: {
            images: {
              orderBy: { position: 'asc' },
              select: { url: true, variants: { select: { id: true } } },
            },
          },
        },
      },
    });

    return records.map((record) => ({
      productVariantId: record.id,
      productId: record.productId,
      productName: record.product.name,
      variantSize: record.size,
      variantColor: record.color,
      stock: record.stock,
      unitPriceCents: record.priceCents ?? record.product.basePriceCents,
      currency: record.product.currency,
      isPublished: record.product.status === 'PUBLISHED',
      imageUrl: firstImageFor(record.id, record.product.images),
    }));
  }
}
