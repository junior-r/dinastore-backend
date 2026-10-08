import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { FILE_STORAGE } from '@/shared/domain/storage/file-storage.port';
import type { FileStorage } from '@/shared/domain/storage/file-storage.port';
import { COMMENT_REPOSITORY } from '@/modules/comments/domain/repositories/comment.repository';
import type { CommentRepository } from '@/modules/comments/domain/repositories/comment.repository';
import { DeleteCommentCommand } from './delete-comment.command';

@CommandHandler(DeleteCommentCommand)
export class DeleteCommentHandler implements ICommandHandler<
  DeleteCommentCommand,
  void
> {
  private readonly logger = new Logger(DeleteCommentHandler.name);

  constructor(
    @Inject(COMMENT_REPOSITORY)
    private readonly commentRepository: CommentRepository,
    @Inject(FILE_STORAGE)
    private readonly fileStorage: FileStorage,
  ) {}

  async execute(command: DeleteCommentCommand): Promise<void> {
    const comment = await this.commentRepository.findById(command.commentId);
    if (!comment || !comment.belongsTo(command.userId)) {
      throw new NotFoundException(`Comment "${command.commentId}" not found`);
    }

    // Collected before the delete: the row cascade takes the replies (and
    // with them the only record of their image keys) along with it.
    const images = await this.commentRepository.findImagesInSubtree(
      command.commentId,
    );

    await this.commentRepository.deleteById(command.commentId);

    // Rows first, files second, and a storage failure is logged rather than
    // thrown: the comment is already gone, so the worst outcome is an
    // orphaned file — never a visible comment pointing at a missing image.
    const keys = images.flatMap((image) => [image.key, image.thumbnailKey]);
    const results = await Promise.allSettled(
      keys.map((key) => this.fileStorage.delete(key)),
    );
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.warn(
          `Could not delete stored file "${keys[index]}": ${String(result.reason)}`,
        );
      }
    });
  }
}
