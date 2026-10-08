import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/shared/infrastructure/prisma/prisma.service';
import { ProductLookupPort } from '@/modules/comments/domain/ports/product-lookup.port';

@Injectable()
export class PrismaProductLookupAdapter implements ProductLookupPort {
  constructor(private readonly prisma: PrismaService) {}

  async exists(productId: string): Promise<boolean> {
    const record = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    return record !== null;
  }
}
