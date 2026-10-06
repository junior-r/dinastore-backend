import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateProductCommand } from '@/modules/catalog/application/commands/create-product/create-product.command';
import { GetCategoriesQuery } from '@/modules/catalog/application/queries/get-categories/get-categories.query';
import { GetProductBySlugQuery } from '@/modules/catalog/application/queries/get-product-by-slug/get-product-by-slug.query';
import { PaginatedProducts } from '@/modules/catalog/application/queries/get-products/get-products.handler';
import { GetProductsQuery } from '@/modules/catalog/application/queries/get-products/get-products.query';
import { Category } from '@/modules/catalog/domain/entities/category.entity';
import { Product } from '@/modules/catalog/domain/entities/product.entity';
import { Permission } from '@/modules/users/domain/entities/permission';
import { Role } from '@/modules/users/domain/entities/user.entity';
import { JwtAuthGuard } from '@/modules/users/infrastructure/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/users/infrastructure/auth/permissions.guard';
import { RolesGuard } from '@/modules/users/infrastructure/auth/roles.guard';
import { RequirePermission } from '@/modules/users/presentation/decorators/require-permission.decorator';
import { Roles } from '@/modules/users/presentation/decorators/roles.decorator';
import { CreateProductDto } from '../dto/create-product.dto';
import { ListProductsDto } from '../dto/list-products.dto';
import { ProductResponseDto } from '../dto/product-response.dto';
import {
  productImagePublicUrl,
  productImageUploadOptions,
} from '@/modules/catalog/infrastructure/uploads/product-image-storage';

@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('categories')
  async listCategories() {
    return this.queryBus.execute<GetCategoriesQuery, Category[]>(
      new GetCategoriesQuery(),
    );
  }

  @Get('products')
  async list(@Query() query: ListProductsDto) {
    const result = await this.queryBus.execute<
      GetProductsQuery,
      PaginatedProducts
    >(
      new GetProductsQuery(
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

  @Get('products/:slug')
  async findBySlug(@Param('slug') slug: string) {
    const product = await this.queryBus.execute<GetProductBySlugQuery, Product>(
      new GetProductBySlugQuery(slug),
    );
    return ProductResponseDto.fromDomain(product);
  }

  @Post('products')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @RequirePermission(Permission.PRODUCTS_MANAGE)
  async create(@Body() dto: CreateProductDto) {
    const product = await this.commandBus.execute<
      CreateProductCommand,
      Product
    >(
      new CreateProductCommand(
        dto.name,
        dto.slug,
        dto.description ?? null,
        dto.basePriceCents,
        dto.currency,
        dto.categoryIds,
        (dto.variants ?? []).map((variant) => ({
          size: variant.size,
          color: variant.color,
          sku: variant.sku,
          stock: variant.stock,
          priceCents: variant.priceCents ?? null,
        })),
        (dto.images ?? []).map((image, index) => ({
          url: image.url,
          altText: image.altText ?? null,
          position: image.position ?? index,
          variantIndexes: image.variantIndexes ?? [],
        })),
      ),
    );

    return ProductResponseDto.fromDomain(product);
  }

  // Uploaded ahead of product creation (the product doesn't exist yet in the
  // create-sidebar flow) -- returns public URLs the client attaches to the
  // CreateProductDto.images it sends on submit.
  @Post('products/images')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @RequirePermission(Permission.PRODUCTS_MANAGE)
  @UseInterceptors(FilesInterceptor('files', 10, productImageUploadOptions))
  uploadImages(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one image file is required');
    }

    return files.map((file) => ({ url: productImagePublicUrl(file.filename) }));
  }
}
