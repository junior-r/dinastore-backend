import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import type { DesignCrop } from '@/modules/customizations/domain/design-policy';

// Multipart fields arrive as strings, hence @Type on each.
export class UploadDesignDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  cropX?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  cropY?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  cropWidth?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  cropHeight?: number;

  /**
   * The four fields as one crop, or null when none was sent. A partial set
   * is passed on as it is (missing values become NaN) so the domain refuses
   * it, rather than quietly uploading the whole image.
   */
  toCrop(): DesignCrop | null {
    const values = [this.cropX, this.cropY, this.cropWidth, this.cropHeight];
    if (values.every((value) => value === undefined)) return null;
    const [x, y, width, height] = values.map((value) => value ?? Number.NaN);
    return { x, y, width, height };
  }
}
