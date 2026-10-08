import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '@/modules/users/infrastructure/auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '@/modules/users/infrastructure/auth/optional-jwt-auth.guard';
import { CurrentUser } from '@/modules/users/presentation/decorators/current-user.decorator';
import { OptionalCurrentUser } from '@/modules/users/presentation/decorators/optional-current-user.decorator';
import type { TokenPayload } from '@/modules/users/domain/services/token-service';
import { DeleteReviewCommand } from '@/modules/reviews/application/commands/delete-review/delete-review.command';
import { RateProductCommand } from '@/modules/reviews/application/commands/rate-product/rate-product.command';
import type { ProductReviews } from '@/modules/reviews/application/queries/get-product-reviews/get-product-reviews.handler';
import { GetProductReviewsQuery } from '@/modules/reviews/application/queries/get-product-reviews/get-product-reviews.query';
import { Review } from '@/modules/reviews/domain/entities/review.entity';
import { ListReviewsDto } from '../dto/list-reviews.dto';
import { RateProductDto } from '../dto/rate-product.dto';
import { ReviewResponseDto } from '../dto/review-response.dto';

@Controller('catalog/products/:productId/reviews')
export class ReviewsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // Public, but reads the token when one is sent so the reader's own review
  // comes back with the list.
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async list(
    @Param('productId') productId: string,
    @Query() query: ListReviewsDto,
    @OptionalCurrentUser() currentUser: TokenPayload | undefined,
  ) {
    const result = await this.queryBus.execute<
      GetProductReviewsQuery,
      ProductReviews
    >(
      new GetProductReviewsQuery(
        productId,
        query.page,
        query.pageSize,
        currentUser?.sub,
      ),
    );

    return {
      items: result.items.map((item) => ReviewResponseDto.fromListItem(item)),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      summary: result.summary,
      viewerReview:
        result.viewerReview &&
        ReviewResponseDto.fromDomain(result.viewerReview),
    };
  }

  // PUT on a fixed `mine` resource rather than POST to the collection: there
  // is exactly one review per shopper per product, and sending it again
  // replaces it. That also makes a retry or a double click harmless.
  @Put('mine')
  @UseGuards(JwtAuthGuard)
  async rate(
    @Param('productId') productId: string,
    @CurrentUser() currentUser: TokenPayload,
    @Body() dto: RateProductDto,
  ) {
    const review = await this.commandBus.execute<RateProductCommand, Review>(
      new RateProductCommand(
        productId,
        currentUser.sub,
        dto.rating,
        dto.body ?? null,
      ),
    );

    return ReviewResponseDto.fromDomain(review);
  }

  @Delete('mine')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('productId') productId: string,
    @CurrentUser() currentUser: TokenPayload,
  ) {
    await this.commandBus.execute<DeleteReviewCommand, void>(
      new DeleteReviewCommand(productId, currentUser.sub),
    );
  }
}
