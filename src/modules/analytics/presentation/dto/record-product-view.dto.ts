import { IsBoolean, IsInt, IsUUID, Min } from 'class-validator';

// Note what is NOT here: no IP, no country, no user id. Those come from the
// connection and the token, never from a body the page controls.
export class RecordProductViewDto {
  @IsUUID()
  viewId!: string;

  @IsUUID()
  productId!: string;

  @IsUUID()
  visitorId!: string;

  // Milliseconds the page has been visible so far in this visit. The upper
  // bound is applied by the domain (MAX_VIEW_DURATION_MS), which clamps
  // rather than rejects: a tab left open overnight should still be recorded.
  @IsInt()
  @Min(0)
  durationMs!: number;

  @IsBoolean()
  favorited!: boolean;
}
