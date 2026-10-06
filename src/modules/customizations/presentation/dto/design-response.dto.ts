import type { FileStorage } from '@/shared/domain/storage/file-storage.port';
import { Design } from '@/modules/customizations/domain/entities/design.entity';

export class DesignResponseDto {
  id: string;
  /** Preview with the store logo already applied. */
  thumbnailUrl: string;
  width: number;
  height: number;
  createdAt: Date;

  // The print and source files are deliberately not exposed here: the
  // shopper needs a preview, fulfillment needs the print file (see the admin
  // custom-prints list in the Orders module).
  static fromDomain(design: Design, storage: FileStorage): DesignResponseDto {
    const dto = new DesignResponseDto();
    dto.id = design.id;
    dto.thumbnailUrl = storage.publicUrl(design.thumbnailKey);
    dto.width = design.width;
    dto.height = design.height;
    dto.createdAt = design.createdAt;
    return dto;
  }
}
