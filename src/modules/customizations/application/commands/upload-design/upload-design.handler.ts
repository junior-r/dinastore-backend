import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  FILE_STORAGE,
  IMMUTABLE_CACHE_CONTROL,
} from '@/shared/domain/storage/file-storage.port';
import type { FileStorage } from '@/shared/domain/storage/file-storage.port';
import { DESIGN_KEY_PREFIX } from '@/modules/customizations/domain/design-policy';
import { Design } from '@/modules/customizations/domain/entities/design.entity';
import { DESIGN_RENDERER } from '@/modules/customizations/domain/ports/design-renderer.port';
import type { DesignRenderer } from '@/modules/customizations/domain/ports/design-renderer.port';
import { STORE_LOGO_PORT } from '@/modules/customizations/domain/ports/store-logo.port';
import type { StoreLogoPort } from '@/modules/customizations/domain/ports/store-logo.port';
import { DESIGN_REPOSITORY } from '@/modules/customizations/domain/repositories/design.repository';
import type { DesignRepository } from '@/modules/customizations/domain/repositories/design.repository';
import { UploadDesignCommand } from './upload-design.command';

@CommandHandler(UploadDesignCommand)
export class UploadDesignHandler implements ICommandHandler<
  UploadDesignCommand,
  Design
> {
  constructor(
    @Inject(DESIGN_REPOSITORY)
    private readonly designRepository: DesignRepository,
    @Inject(DESIGN_RENDERER)
    private readonly renderer: DesignRenderer,
    @Inject(STORE_LOGO_PORT)
    private readonly storeLogo: StoreLogoPort,
    @Inject(FILE_STORAGE)
    private readonly fileStorage: FileStorage,
  ) {}

  async execute(command: UploadDesignCommand): Promise<Design> {
    const logo = await this.storeLogo.get();
    const rendered = await this.renderer.render(
      command.file,
      logo.data,
      command.crop,
    );

    // A fresh random name per upload: keys are never reused or overwritten,
    // which is what makes it safe to cache these files forever.
    const id = crypto.randomUUID();
    const base = `${DESIGN_KEY_PREFIX}/${id}`;

    // Built before anything is written, so a design the domain refuses (too
    // small to print) never reaches storage.
    const design = Design.create({
      id,
      userId: command.userId,
      sourceKey: `${base}-source.${rendered.source.extension}`,
      printKey: `${base}-print.${rendered.print.extension}`,
      thumbnailKey: `${base}-thumb.${rendered.thumbnail.extension}`,
      width: rendered.print.width,
      height: rendered.print.height,
    });

    const files = [
      { key: design.sourceKey, image: rendered.source },
      { key: design.printKey, image: rendered.print },
      { key: design.thumbnailKey, image: rendered.thumbnail },
    ];

    try {
      await Promise.all(
        files.map(({ key, image }) =>
          this.fileStorage.put(key, image.data, {
            contentType: image.contentType,
            cacheControl: IMMUTABLE_CACHE_CONTROL,
          }),
        ),
      );
      return await this.designRepository.create(design);
    } catch (error) {
      // Some of the files may have landed, and nothing will ever point at
      // them. Best-effort: the original error is the one the caller needs.
      await Promise.allSettled(
        design.fileKeys().map((key) => this.fileStorage.delete(key)),
      );
      throw error;
    }
  }
}
