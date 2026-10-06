# Comments

Per-product comments with pluggable, fail-safe content moderation. The smallest end-to-end example of the "narrow port into another module" pattern used across the codebase.

Source: `src/modules/comments/`

## Entity

`Comment` (`domain/entities/comment.entity.ts`): `body` is trimmed and must be non-empty and ≤ 1000 characters (`DomainError` otherwise). Author name/avatar are **read live** via the `user` Prisma relation on list queries — not snapshotted like `OrderItem` — so a comment reflects the commenter's current profile, not one frozen at post time.

## Endpoints

`CommentsController`, nested under the product: `/catalog/products/:productId/comments`

- `GET /` — public, paginated, newest first.
- `POST /` — JWT-guarded. Creates a comment.
- `DELETE /:commentId` — JWT-guarded, author-only; **404 (not 403)** on someone else's comment, matching the same existence-hiding convention used elsewhere.

## CQRS

`CreateCommentCommand`/`Handler` — 404s if the product doesn't exist (via `ProductLookupPort`), runs the body through the moderation port and throws `DomainError` (→ 400) if rejected, otherwise persists. `DeleteCommentCommand`/`Handler`. `GetProductCommentsQuery` (paginated).

## Image attachment

A comment (root or reply) may carry **one** image. `POST /` accepts JSON, or `multipart/form-data` with the same fields plus an `image` file (PNG/JPEG/WebP, ≤ 8 MB; a second file is a 400, an oversize one a 413, a non-image a 400).

- The upload is re-encoded by the `ImageProcessor` port (`SharpImageProcessor`) into two WebP renditions — full (≤1600px) and thumbnail (≤480px) — with EXIF orientation applied and all metadata stripped. Sizes/qualities live in `domain/comment-image-policy.ts`.
- The files go through the shared `FileStorage` port (see `docs/architecture.md`); the comment row stores only their **keys** plus the full image's width/height. `GET /` returns `image: { url, thumbnailUrl, width, height } | null`, with URLs resolved from the keys at read time. The create response carries `hasImage` only.
- Deleting a comment deletes its files and those of every reply removed with it. Deleting a product or user does not (known gap).

## Moderation architecture

`CommentModerationPort` (`domain/services/comment-moderation.port.ts`) is the seam `CreateCommentHandler` depends on — `review(body): Promise<ModerationResult>`. Three adapters compose in `comments.module.ts`'s factory for the `COMMENT_MODERATION_PORT` token:

1. **`HttpCommentModerationAdapter`** (`infrastructure/moderation/`) — calls `POST {FEELINGS_ANALYSIS_URL}/v1/analyze` on the sibling `feelings-analysis` service (a standalone Python/FastAPI project, outside this repo, that scores text with a self-hosted Detoxify toxicity classifier — switched from OpenAI's Moderation API after hitting rate limits on an unfunded account). Auth via an `X-API-Key` header that must match the target service's own key; request has a timeout (`FEELINGS_ANALYSIS_TIMEOUT_MS`, default 5000ms). It **never guesses**: any non-2xx response, network error, or timeout is thrown, not swallowed.
2. **`FallbackCommentModerationAdapter`** wraps the HTTP adapter — on any thrown error it logs a warning and falls through to the keyword adapter, so a bad key or unreachable service degrades gracefully rather than bypassing moderation.
3. **`KeywordCommentModerationAdapter`** — a small curated wordlist plus shouting/harassment heuristics, used either as the fallback or, if `FEELINGS_ANALYSIS_URL`/`FEELINGS_ANALYSIS_API_KEY` aren't both set, as the sole adapter with zero network calls. This is why `pnpm test:e2e` needs no live `feelings-analysis` instance to pass.

## Interaction with other modules

- **`ProductLookupPort`** (`domain/ports/product-lookup.port.ts`, `exists(productId)`) is Comments' narrow read-only view into Catalog — deliberately not a dependency on Catalog's `ProductRepository`.
- Depends on **Users** for `JwtAuthGuard`/`CurrentUser` on the create/delete routes.
- Calls the external **feelings-analysis** service (sibling repo, not part of this backend) for moderation, with local-keyword fallback.
