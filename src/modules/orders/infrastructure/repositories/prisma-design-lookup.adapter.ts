import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/shared/infrastructure/prisma/prisma.service';
import {
  DesignLookupPort,
  OrderableDesign,
} from '@/modules/orders/domain/repositories/design-lookup.port';

@Injectable()
export class PrismaDesignLookupAdapter implements DesignLookupPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByIds(designIds: string[]): Promise<OrderableDesign[]> {
    if (designIds.length === 0) {
      return [];
    }

    const records = await this.prisma.design.findMany({
      where: { id: { in: designIds } },
      select: { id: true, userId: true, thumbnailKey: true, printKey: true },
    });

    return records.map((record) => ({
      designId: record.id,
      ownerId: record.userId,
      thumbnailKey: record.thumbnailKey,
      printKey: record.printKey,
    }));
  }
}
