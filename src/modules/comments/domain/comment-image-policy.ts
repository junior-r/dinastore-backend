import type { ImageVariantSpec } from '@/shared/domain/images/image-processor.port';

/** Largest upload accepted for a comment's image, before optimization. */
export const MAX_COMMENT_IMAGE_BYTES = 8 * 1024 * 1024;

/** Storage key prefix every comment image lives under. */
export const COMMENT_IMAGE_KEY_PREFIX = 'comments';

/**
 * The two renditions kept per comment image. The thread only ever loads the
 * thumbnail (it is displayed at ~240px, so 480 keeps it sharp on 2x screens);
 * the full version is fetched only when a reader opens the image.
 */
export const COMMENT_IMAGE_FULL: ImageVariantSpec = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 80,
};

export const COMMENT_IMAGE_THUMBNAIL: ImageVariantSpec = {
  maxWidth: 480,
  maxHeight: 480,
  quality: 72,
};
