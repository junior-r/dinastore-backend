import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateCategoryCommand } from '@/modules/catalog/application/commands/create-category/create-category.command';
import { DeleteCategoryCommand } from '@/modules/catalog/application/commands/delete-category/delete-category.command';
import { DeleteProductCommand } from '@/modules/catalog/application/commands/delete-product/delete-product.command';
import { UpdateCategoryCommand } from '@/modules/catalog/application/commands/update-category/update-category.command';
import { UpdateProductCommand } from '@/modules/catalog/application/commands/update-product/update-product.command';
import { UpdateProductImagesCommand } from '@/modules/catalog/application/commands/update-product-images/update-product-images.command';
import { UpdateProductStatusCommand } from '@/modules/catalog/application/commands/update-product-status/update-product-status.command';
import { UpdateProductVariantsCommand } from '@/modules/catalog/application/commands/update-product-variants/update-product-variants.command';
import { GetAdminProductsQuery } from '@/modules/catalog/application/queries/get-admin-products/get-admin-products.query';
import { PaginatedAdminProducts } from '@/modules/catalog/application/queries/get-admin-products/get-admin-products.handler';
import { Category } from '@/modules/catalog/domain/entities/category.entity';
import { Product } from '@/modules/catalog/domain/entities/product.entity';
import { Permission } from '@/modules/users/domain/entities/permission';
import { Role } from '@/modules/users/domain/entities/user.entity';
import { JwtAuthGuard } from '@/modules/users/infrastructure/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/users/infrastructure/auth/permissions.guard';
import { RolesGuard } from '@/modules/users/infrastructure/auth/roles.guard';
import { RequirePermission } from '@/modules/users/presentation/decorators/require-permission.decorator';
import { Roles } from '@/modules/users/presentation/decorators/roles.decorator';
import { CreateCategoryDto } from '@/modules/catalog/presentation/dto/admin/create-category.dto';
import { UpdateCategoryDto } from '@/modules/catalog/presentation/dto/admin/update-category.dto';
import { UpdateProductDto } from '@/modules/catalog/presentation/dto/admin/update-product.dto';
import { UpdateProductImagesDto } from '@/modules/catalog/presentation/dto/admin/update-product-images.dto';
import { UpdateProductStatusDto } from '@/modules/catalog/presentation/dto/admin/update-product-status.dto';
import { UpdateProductVariantsDto } from '@/modules/catalog/presentation/dto/admin/update-product-variants.dto';
import { ListProductsDto } from '@/modules/catalog/presentation/dto/list-products.dto';
import { ProductResponseDto } from '@/modules/catalog/presentation/dto/product-response.dto';

@Controller('admin/catalog')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.STAFF)
export class AdminCatalogController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('products')
  @RequirePermission(Permission.PRODUCTS_VIEW)
  async listProducts(@Query() query: ListProductsDto) {
    const result = await this.queryBus.execute<
      GetAdminProductsQuery,
      PaginatedAdminProducts
    >(
      new GetAdminProductsQuery(
        query.categoryIds,
        query.status,
        query.page,
        query.pageSize,
        query.search,
      ),
    );

    return {
      items: result.items.map((product) =>
        ProductResponseDto.fromDomain(product),
      ),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }

  @Patch('products/:id')
  @RequirePermission(Permission.PRODUCTS_MANAGE)
  async updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    const product = await this.commandBus.execute<
      UpdateProductCommand,
      Product
    >(
      new UpdateProductCommand(
        id,
        dto.name,
        dto.description ?? null,
        dto.basePriceCents,
        dto.currency,
        dto.categoryIds,
      ),
    );
    return ProductResponseDto.fromDomain(product);
  }

  @Patch('products/:id/variants')
  @RequirePermission(Permission.PRODUCTS_MANAGE)
  async updateProductVariants(
    @Param('id') id: string,
    @Body() dto: UpdateProductVariantsDto,
  ) {
    const product = await this.commandBus.execute<
      UpdateProductVariantsCommand,
      Product
    >(
      new UpdateProductVariantsCommand(
        id,
        dto.variants.map((variant) =>
          variant.id
            ? {
                id: variant.id,
                stock: variant.stock,
                priceCents: variant.priceCents ?? null,
              }
            : {
                size: variant.size!,
                color: variant.color!,
                sku: variant.sku!,
                stock: variant.stock,
                priceCents: variant.priceCents ?? null,
              },
        ),
      ),
    );
    return ProductResponseDto.fromDomain(product);
  }

  @Patch('products/:id/images')
  @RequirePermission(Permission.PRODUCTS_MANAGE)
  async updateProductImages(
    @Param('id') id: string,
    @Body() dto: UpdateProductImagesDto,
  ) {
    const product = await this.commandBus.execute<
      UpdateProductImagesCommand,
      Product
    >(
      new UpdateProductImagesCommand(
        id,
        dto.images.map((image) => ({
          id: image.id,
          url: image.url,
          altText: image.altText ?? null,
          position: image.position,
          variantIds: image.variantIds ?? [],
        })),
      ),
    );
    return ProductResponseDto.fromDomain(product);
  }

  @Patch('products/:id/status')
  @RequirePermission(Permission.PRODUCTS_MANAGE)
  async updateProductStatus(
    @Param('id') id: string,
    @Body() dto: UpdateProductStatusDto,
  ) {
    const product = await this.commandBus.execute<
      UpdateProductStatusCommand,
      Product
    >(new UpdateProductStatusCommand(id, dto.status));
    return ProductResponseDto.fromDomain(product);
  }

  @Delete('products/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(Permission.PRODUCTS_MANAGE)
  async deleteProduct(@Param('id') id: string) {
    await this.commandBus.execute<DeleteProductCommand, void>(
      new DeleteProductCommand(id),
    );
  }

  @Post('categories')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(Permission.CATEGORIES_MANAGE)
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.commandBus.execute<CreateCategoryCommand, Category>(
      new CreateCategoryCommand(dto.name, dto.description),
    );
  }

  @Patch('categories/:id')
  @RequirePermission(Permission.CATEGORIES_MANAGE)
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.commandBus.execute<UpdateCategoryCommand, Category>(
      new UpdateCategoryCommand(id, dto.name, dto.slug, dto.description),
    );
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(Permission.CATEGORIES_MANAGE)
  async deleteCategory(@Param('id') id: string) {
    await this.commandBus.execute<DeleteCategoryCommand, void>(
      new DeleteCategoryCommand(id),
    );
  }
}
