import { BadRequestException } from '@nestjs/common';
import { mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { diskStorage } from 'multer';
import { ENV_DEFAULTS } from '@/shared/infrastructure/config/env';

export const PRODUCT_IMAGE_UPLOAD_DIR = join(
  process.cwd(),
  'uploads',
  'products',
);

// multer's diskStorage does not create its destination directory itself.
mkdirSync(PRODUCT_IMAGE_UPLOAD_DIR, { recursive: true });

export const ALLOWED_PRODUCT_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
];

export const productImageUploadOptions = {
  storage: diskStorage({
    destination: PRODUCT_IMAGE_UPLOAD_DIR,
    filename: (_req, file, callback) => {
      callback(null, `${crypto.randomUUID()}${extname(file.originalname)}`);
    },
  }),
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!ALLOWED_PRODUCT_IMAGE_MIME_TYPES.includes(file.mimetype)) {
      callback(
        new BadRequestException('Only PNG, JPEG, and WebP images are allowed'),
        false,
      );
      return;
    }
    callback(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
};

export function productImagePublicUrl(filename: string): string {
  const baseUrl = (process.env.APP_URL ?? ENV_DEFAULTS.APP_URL).replace(
    /\/+$/,
    '',
  );
  return `${baseUrl}/uploads/products/${filename}`;
}
