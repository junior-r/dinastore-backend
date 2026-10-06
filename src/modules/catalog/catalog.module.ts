import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PassportModule } from '@nestjs/passport';
import { CreateCategoryHandler } from './application/commands/create-category/create-category.handler';
import { CreateProductHandler } from './application/commands/create-product/create-product.handler';
import { DeleteCategoryHandler } from './application/commands/delete-category/delete-category.handler';
import { DeleteProductHandler } from './application/commands/delete-product/delete-product.handler';
import { UpdateCategoryHandler } from './application/commands/update-category/update-category.handler';
import { UpdateProductHandler } from './application/commands/update-product/update-product.handler';
import { UpdateProductImagesHandler } from './application/commands/update-product-images/update-product-images.handler';
import { UpdateProductStatusHandler } from './application/commands/update-product-status/update-product-status.handler';
import { UpdateProductVariantsHandler } from './application/commands/update-product-variants/update-product-variants.handler';
import { GetAdminProductsHandler } from './application/queries/get-admin-products/get-admin-products.handler';
import { GetCategoriesHandler } from './application/queries/get-categories/get-categories.handler';
import { GetProductBySlugHandler } from './application/queries/get-product-by-slug/get-product-by-slug.handler';
import { GetProductsHandler } from './application/queries/get-products/get-products.handler';
import { CATEGORY_REPOSITORY } from './domain/repositories/category.repository';
import { PRODUCT_REPOSITORY } from './domain/repositories/product.repository';
import { PrismaCategoryRepository } from './infrastructure/repositories/prisma-category.repository';
import { PrismaProductRepository } from './infrastructure/repositories/prisma-product.repository';
import { AdminCatalogController } from './presentation/controllers/admin/admin-catalog.controller';
import { CatalogController } from './presentation/controllers/catalog.controller';
import { PermissionsGuard } from '../users/infrastructure/auth/permissions.guard';
import { RolesGuard } from '../users/infrastructure/auth/roles.guard';
import { UsersModule } from '../users/users.module';

const commandHandlers = [
  CreateProductHandler,
  UpdateProductHandler,
  UpdateProductVariantsHandler,
  UpdateProductImagesHandler,
  UpdateProductStatusHandler,
  DeleteProductHandler,
  CreateCategoryHandler,
  UpdateCategoryHandler,
  DeleteCategoryHandler,
];
const queryHandlers = [
  GetProductsHandler,
  GetProductBySlugHandler,
  GetCategoriesHandler,
  GetAdminProductsHandler,
];

@Module({
  // PassportModule: needed here (not just in UsersModule) for JwtAuthGuard
  // to resolve within this module's own controllers -- same pattern Orders
  // and Comments already use. UsersModule: exports USER_REPOSITORY, needed
  // by PermissionsGuard on the new admin routes below.
  imports: [CqrsModule, PassportModule, UsersModule],
  controllers: [CatalogController, AdminCatalogController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    RolesGuard,
    PermissionsGuard,
    { provide: PRODUCT_REPOSITORY, useClass: PrismaProductRepository },
    { provide: CATEGORY_REPOSITORY, useClass: PrismaCategoryRepository },
  ],
})
export class CatalogModule {}
