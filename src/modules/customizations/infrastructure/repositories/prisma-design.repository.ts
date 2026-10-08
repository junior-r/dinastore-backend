import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/shared/infrastructure/prisma/prisma.service';
import { Design } from '@/modules/customizations/domain/entities/design.entity';
import { DesignRepository } from '@/modules/customizations/domain/repositories/design.repository';

@Injectable()
export class PrismaDesignRepository implements DesignRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(design: Design): Promise<Design> {
    const record = await this.prisma.design.create({
      data: {
        id: design.id,
        userId: design.userId,
        sourceKey: design.sourceKey,
        printKey: design.printKey,
        thumbnailKey: design.thumbnailKey,
        width: design.width,
        height: design.height,
        createdAt: design.createdAt,
      },
    });
    return Design.fromPersistence(record);
  }
}
