import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DomainError } from '@/shared/domain/domain-error';
import { IMAGE_PROCESSOR } from '@/shared/domain/images/image-processor.port';
import type { ImageProcessor } from '@/shared/domain/images/image-processor.port';
import {
  FILE_STORAGE,
  IMMUTABLE_CACHE_CONTROL,
} from '@/shared/domain/storage/file-storage.port';
import type { FileStorage } from '@/shared/domain/storage/file-storage.port';
import {
  COMMENT_IMAGE_FULL,
  COMMENT_IMAGE_KEY_PREFIX,
  COMMENT_IMAGE_THUMBNAIL,
} from '@/modules/comments/domain/comment-image-policy';
import { Comment } from '@/modules/comments/domain/entities/comment.entity';
import type { CommentImage } from '@/modules/comments/domain/entities/comment.entity';
import { PRODUCT_LOOKUP_PORT } from '@/modules/comments/domain/ports/product-lookup.port';
import type { ProductLookupPort } from '@/modules/comments/domain/ports/product-lookup.port';
import { COMMENT_REPOSITORY } from '@/modules/comments/domain/repositories/comment.repository';
import type { CommentRepository } from '@/modules/comments/domain/repositories/comment.repository';
import { COMMENT_MODERATION_PORT } from '@/modules/comments/domain/services/comment-moderation.port';
import type { CommentModerationPort } from '@/modules/comments/domain/services/comment-moderation.port';
import { CreateCommentCommand } from './create-comment.command';

@CommandHandler(CreateCommentCommand)
export class CreateCommentHandler implements ICommandHandler<
  CreateCommentCommand,
  Comment
> {
  constructor(
    @Inject(COMMENT_REPOSITORY)
    private readonly commentRepository: CommentRepository,
    @Inject(PRODUCT_LOOKUP_PORT)
    private readonly productLookup: ProductLookupPort,
    @Inject(COMMENT_MODERATION_PORT)
    private readonly moderation: CommentModerationPort,
    @Inject(IMAGE_PROCESSOR)
    private readonly imageProcessor: ImageProcessor,
    @Inject(FILE_STORAGE)
    private readonly fileStorage: FileStorage,
  ) {}

  async execute(command: CreateCommentCommand): Promise<Comment> {
    if (!(await this.productLookup.exists(command.productId))) {
      throw new NotFoundException(`Product "${command.productId}" not found`);
    }

    const parent = command.parentId
      ? await this.loadParent(command.parentId, command.productId)
      : null;

    const result = await this.moderation.review(command.body);
    if (!result.allowed) {
      throw new DomainError(
        result.reason ?? 'Please keep comments respectful.',
      );
    }

    // Only after every cheap rejection above has passed — decoding and
    // re-encoding an image is by far the most expensive step here.
    const image = command.image ? await this.storeImage(command.image) : null;

    try {
      // `Comment.reply` owns the depth/flattening rule — see MAX_COMMENT_DEPTH.
      const comment = parent
        ? parent.reply({ userId: command.userId, body: command.body, image })
        : Comment.create({
            productId: command.productId,
            userId: command.userId,
            body: command.body,
            image,
          });

      return await this.commentRepository.create(comment);
    } catch (error) {
      // The files are already written but nothing will ever point at them.
      if (image) {
        await this.discard([image.key, image.thumbnailKey]);
      }
      throw error;
    }
  }

  private async storeImage(input: Buffer): Promise<CommentImage> {
    const [full, thumbnail] = await this.imageProcessor.optimize(input, [
      COMMENT_IMAGE_FULL,
      COMMENT_IMAGE_THUMBNAIL,
    ]);

    // A fresh random name per upload: keys are never reused or overwritten,
    // which is what makes it safe to cache these files forever.
    const name = crypto.randomUUID();
    const key = `${COMMENT_IMAGE_KEY_PREFIX}/${name}.${full.extension}`;
    const thumbnailKey = `${COMMENT_IMAGE_KEY_PREFIX}/${name}-thumb.${thumbnail.extension}`;

    const uploads = await Promise.allSettled([
      this.fileStorage.put(key, full.data, {
        contentType: full.contentType,
        cacheControl: IMMUTABLE_CACHE_CONTROL,
      }),
      this.fileStorage.put(thumbnailKey, thumbnail.data, {
        contentType: thumbnail.contentType,
        cacheControl: IMMUTABLE_CACHE_CONTROL,
      }),
    ]);

    const failed = uploads.find((upload) => upload.status === 'rejected');
    if (failed) {
      // One of the two may have landed; don't leave half an image behind.
      await this.discard([key, thumbnailKey]);
      throw failed.reason;
    }

    return { key, thumbnailKey, width: full.width, height: full.height };
  }

  // Best-effort: this only runs while another error is already on its way
  // out, and that original error is the one the caller needs to see.
  private async discard(keys: string[]): Promise<void> {
    await Promise.allSettled(keys.map((key) => this.fileStorage.delete(key)));
  }

  private async loadParent(
    parentId: string,
    productId: string,
  ): Promise<Comment> {
    const parent = await this.commentRepository.findById(parentId);
    // A parent on a different product is reported as missing rather than as
    // a mismatch — same existence-hiding convention the rest of the module
    // uses (see DeleteCommentHandler).
    if (!parent || parent.productId !== productId) {
      throw new NotFoundException(`Comment "${parentId}" not found`);
    }
    return parent;
  }
}
