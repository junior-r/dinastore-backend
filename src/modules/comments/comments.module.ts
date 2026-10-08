import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { PassportModule } from '@nestjs/passport';
import { CreateCommentHandler } from './application/commands/create-comment/create-comment.handler';
import { DeleteCommentHandler } from './application/commands/delete-comment/delete-comment.handler';
import { SetCommentLikeHandler } from './application/commands/set-comment-like/set-comment-like.handler';
import { GetProductCommentsHandler } from './application/queries/get-product-comments/get-product-comments.handler';
import { IMAGE_PROCESSOR } from '@/shared/domain/images/image-processor.port';
import { SharpImageProcessor } from '@/shared/infrastructure/images/sharp-image-processor';
import { PRODUCT_LOOKUP_PORT } from './domain/ports/product-lookup.port';
import { COMMENT_LIKE_REPOSITORY } from './domain/repositories/comment-like.repository';
import { COMMENT_REPOSITORY } from './domain/repositories/comment.repository';
import { COMMENT_MODERATION_PORT } from './domain/services/comment-moderation.port';
import { PrismaProductLookupAdapter } from './infrastructure/adapters/prisma-product-lookup.adapter';
import { FallbackCommentModerationAdapter } from './infrastructure/moderation/fallback-comment-moderation.adapter';
import { HttpCommentModerationAdapter } from './infrastructure/moderation/http-comment-moderation.adapter';
import { KeywordCommentModerationAdapter } from './infrastructure/moderation/keyword-comment-moderation.adapter';
import { PrismaCommentLikeRepository } from './infrastructure/repositories/prisma-comment-like.repository';
import { PrismaCommentRepository } from './infrastructure/repositories/prisma-comment.repository';
import { CommentsController } from './presentation/controllers/comments.controller';

const commandHandlers = [
  CreateCommentHandler,
  DeleteCommentHandler,
  SetCommentLikeHandler,
];
const queryHandlers = [GetProductCommentsHandler];

@Module({
  imports: [CqrsModule, PassportModule],
  controllers: [CommentsController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    { provide: COMMENT_REPOSITORY, useClass: PrismaCommentRepository },
    {
      provide: COMMENT_LIKE_REPOSITORY,
      useClass: PrismaCommentLikeRepository,
    },
    { provide: PRODUCT_LOOKUP_PORT, useClass: PrismaProductLookupAdapter },
    // FILE_STORAGE (where the optimized files go) comes from the global
    // StorageModule; this is only the optimizer.
    { provide: IMAGE_PROCESSOR, useClass: SharpImageProcessor },
    {
      provide: COMMENT_MODERATION_PORT,
      // feelings-analysis is only wired in when both env vars are present —
      // an unconfigured deployment (e.g. CI, or a fresh checkout) falls
      // straight back to the local keyword filter with no network attempt
      // at all, same as the "don't crash on missing config" pattern used
      // for Google OAuth (see users/infrastructure/auth/google.strategy.ts).
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>('FEELINGS_ANALYSIS_URL');
        const apiKey = configService.get<string>('FEELINGS_ANALYSIS_API_KEY');
        const keyword = new KeywordCommentModerationAdapter();
        if (!url || !apiKey) {
          return keyword;
        }
        return new FallbackCommentModerationAdapter(
          new HttpCommentModerationAdapter(configService),
          keyword,
        );
      },
      inject: [ConfigService],
    },
  ],
  // Used by ReviewsModule, whose review comments follow the same moderation
  // policy and need the same "does this product exist" check.
  exports: [PRODUCT_LOOKUP_PORT, COMMENT_MODERATION_PORT],
})
export class CommentsModule {}
