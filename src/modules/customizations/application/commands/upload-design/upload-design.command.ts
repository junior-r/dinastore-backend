import type { DesignCrop } from '@/modules/customizations/domain/design-policy';

export class UploadDesignCommand {
  constructor(
    public readonly userId: string,
    public readonly file: Buffer,
    /** The part of the file to keep. Null keeps all of it. */
    public readonly crop: DesignCrop | null = null,
  ) {}
}
