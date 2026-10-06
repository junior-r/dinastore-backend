import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/shared/infrastructure/prisma/prisma.service';
import { ViewedProductPort } from '@/modules/analytics/domain/ports/viewed-product.port';

@Injectable()
export class PrismaViewedProductAdapter implements ViewedProductPort {
  constructor(private readonly prisma: PrismaService) {}

  async findName(productId: string): Promise<string | null> {
    const record = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { name: true },
    });
    return record?.name ?? null;
  }
}
