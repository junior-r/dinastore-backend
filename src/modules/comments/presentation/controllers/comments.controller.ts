import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@/modules/users/infrastructure/auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '@/modules/users/infrastructure/auth/optional-jwt-auth.guard';
import { CurrentUser } from '@/modules/users/presentation/decorators/current-user.decorator';
import { OptionalCurrentUser } from '@/modules/users/presentation/decorators/optional-current-user.decorator';
import type { TokenPayload } from '@/modules/users/domain/services/token-service';
import { CreateCommentCommand } from '@/modules/comments/application/commands/create-comment/create-comment.command';
import { DeleteCommentCommand } from '@/modules/comments/application/commands/delete-comment/delete-comment.command';
import { SetCommentLikeCommand } from '@/modules/comments/application/commands/set-comment-like/set-comment-like.command';
import type { CommentLikeState } from '@/modules/comments/application/commands/set-comment-like/set-comment-like.handler';
import { PaginatedComments } from '@/modules/comments/application/queries/get-product-comments/get-product-comments.handler';
import { GetProductCommentsQuery } from '@/modules/comments/application/queries/get-product-comments/get-product-comments.query';
import { MAX_COMMENT_IMAGE_BYTES } from '@/modules/comments/domain/comment-image-policy';
import { Comment } from '@/modules/comments/domain/entities/comment.entity';
import { CommentResponseDto } from '../dto/comment-response.dto';
import { CreateCommentDto } from '../dto/create-comment.dto';
import { ListCommentsDto } from '../dto/list-comments.dto';

@Controller('catalog/products/:productId/comments')
export class CommentsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // Public, but reads the token when one is sent so `likedByViewer` can be
  // filled in — counts themselves are visible to everyone.
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async list(
    @Param('productId') productId: string,
    @Query() query: ListCommentsDto,
    @OptionalCurrentUser() currentUser: TokenPayload | undefined,
  ) {
    const result = await this.queryBus.execute<
      GetProductCommentsQuery,
      PaginatedComments
    >(
      new GetProductCommentsQuery(
        productId,
        query.page,
        query.pageSize,
        currentUser?.sub,
      ),
    );

    return {
      items: result.items.map((item) => CommentResponseDto.fromListItem(item)),
      total: result.total,
      rootTotal: result.rootTotal,
      page: result.page,
      pageSize: result.pageSize,
    };
  }

  // Accepts plain JSON (text-only comment) or multipart/form-data with the
  // same fields plus one optional `image` file — multer leaves non-multipart
  // requests untouched. No `storage` option means the file is held in memory
  // (bounded by the size limit) and handed to the command as bytes: where it
  // ends up is the FileStorage port's decision, not this route's.
  // `single` + `files: 1` is the one-image-per-comment limit at the HTTP
  // edge: a second file is a 400 before anything is processed.
  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: MAX_COMMENT_IMAGE_BYTES, files: 1 },
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('productId') productId: string,
    @CurrentUser() currentUser: TokenPayload,
    @Body() dto: CreateCommentDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    const comment = await this.commandBus.execute<
      CreateCommentCommand,
      Comment
    >(
      new CreateCommentCommand(
        productId,
        currentUser.sub,
        dto.body,
        dto.parentId ?? null,
        image?.buffer ?? null,
      ),
    );

    return CommentResponseDto.fromDomain(comment);
  }

  // POST/DELETE rather than a single toggle endpoint: both are idempotent,
  // so a retry or a double-click can't flip the state back the other way.
  @Post(':commentId/likes')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async like(
    @Param('commentId') commentId: string,
    @CurrentUser() currentUser: TokenPayload,
  ) {
    return this.commandBus.execute<SetCommentLikeCommand, CommentLikeState>(
      new SetCommentLikeCommand(commentId, currentUser.sub, true),
    );
  }

  @Delete(':commentId/likes')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async unlike(
    @Param('commentId') commentId: string,
    @CurrentUser() currentUser: TokenPayload,
  ) {
    return this.commandBus.execute<SetCommentLikeCommand, CommentLikeState>(
      new SetCommentLikeCommand(commentId, currentUser.sub, false),
    );
  }

  @Delete(':commentId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('commentId') commentId: string,
    @CurrentUser() currentUser: TokenPayload,
  ) {
    await this.commandBus.execute<DeleteCommentCommand, void>(
      new DeleteCommentCommand(commentId, currentUser.sub),
    );
  }
}
