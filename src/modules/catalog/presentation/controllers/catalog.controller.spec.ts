import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateProductCommand } from '@/modules/catalog/application/commands/create-product/create-product.command';
import { GetProductBySlugQuery } from '@/modules/catalog/application/queries/get-product-by-slug/get-product-by-slug.query';
import { GetProductsQuery } from '@/modules/catalog/application/queries/get-products/get-products.query';
import {
  Product,
  ProductStatus,
} from '@/modules/catalog/domain/entities/product.entity';
import { JwtAuthGuard } from '@/modules/users/infrastructure/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/users/infrastructure/auth/permissions.guard';
import { RolesGuard } from '@/modules/users/infrastructure/auth/roles.guard';
import { CatalogController } from './catalog.controller';

describe('CatalogController', () => {
  let controller: CatalogController;
  let commandBus: { execute: jest.Mock };
  let queryBus: { execute: jest.Mock };

  const product = Product.fromPersistence({
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
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(async () => {
    commandBus = { execute: jest.fn() };
    queryBus = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [
        { provide: CommandBus, useValue: commandBus },
        { provide: QueryBus, useValue: queryBus },
      ],
    })
      // create() is now guarded (ADMIN/STAFF + products:manage) -- this
      // spec only exercises controller-level dispatch logic, real guard
      // behavior is covered by roles.guard.spec.ts/permissions.guard.spec.ts
      // and the catalog e2e suite.
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(CatalogController);
  });

  it('list() dispatches GetProductsQuery and returns a paginated DTO', async () => {
    queryBus.execute.mockResolvedValue({
      items: [product],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    const result = await controller.list({ page: 1, pageSize: 20 });

    expect(queryBus.execute).toHaveBeenCalledWith(expect.any(GetProductsQuery));
    expect(result).toEqual({
      items: [
        expect.objectContaining({ id: 'product-1', slug: 'classic-tee' }),
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it('findBySlug() dispatches GetProductBySlugQuery and returns a product DTO', async () => {
    queryBus.execute.mockResolvedValue(product);

    const result = await controller.findBySlug('classic-tee');

    expect(queryBus.execute).toHaveBeenCalledWith(
      new GetProductBySlugQuery('classic-tee'),
    );
    expect(result).toEqual(expect.objectContaining({ id: 'product-1' }));
  });

  it('create() dispatches CreateProductCommand built from the DTO', async () => {
    commandBus.execute.mockResolvedValue(product);

    const result = await controller.create({
      name: 'Classic Tee',
      slug: 'classic-tee',
      basePriceCents: 2500,
      currency: 'USD',
      categoryIds: ['category-1'],
      variants: [{ size: 'M', color: 'black', sku: 'TEE-M-BLK', stock: 10 }],
    });

    expect(commandBus.execute).toHaveBeenCalledWith(
      new CreateProductCommand(
        'Classic Tee',
        'classic-tee',
        null,
        2500,
        'USD',
        ['category-1'],
        [
          {
            size: 'M',
            color: 'black',
            sku: 'TEE-M-BLK',
            stock: 10,
            priceCents: null,
          },
        ],
      ),
    );
    expect(result).toEqual(expect.objectContaining({ id: 'product-1' }));
  });
});
