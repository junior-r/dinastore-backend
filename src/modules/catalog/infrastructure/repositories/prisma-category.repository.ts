import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/shared/infrastructure/prisma/prisma.service';
import { Category } from '@/modules/catalog/domain/entities/category.entity';
import {
  CategoryRepository,
  OrphanedProductSummary,
} from '@/modules/catalog/domain/repositories/category.repository';

const categorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
} as const;

@Injectable()
export class PrismaCategoryRepository implements CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(): Promise<Category[]> {
    return this.prisma.category.findMany({
      select: categorySelect,
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string): Promise<Category | null> {
    return this.prisma.category.findUnique({
      where: { id },
      select: categorySelect,
    });
  }

  async findBySlug(slug: string): Promise<Category | null> {
    return this.prisma.category.findUnique({
      where: { slug },
      select: categorySelect,
    });
  }

  async create(category: Category): Promise<Category> {
    return this.prisma.category.create({
      data: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
      },
      select: categorySelect,
    });
  }

  async update(category: Category): Promise<Category> {
    return this.prisma.category.update({
      where: { id: category.id },
      data: {
        name: category.name,
        slug: category.slug,
        description: category.description,
      },
      select: categorySelect,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.category.delete({ where: { id } });
  }

  async findProductsThatWouldBeOrphaned(
    categoryId: string,
  ): Promise<OrphanedProductSummary[]> {
    const products = await this.prisma.product.findMany({
      where: { categories: { some: { id: categoryId } } },
      select: {
        id: true,
        name: true,
        _count: { select: { categories: true } },
      },
    });
    return products
      .filter((product) => product._count.categories === 1)
      .map((product) => ({ id: product.id, name: product.name }));
  }
}
