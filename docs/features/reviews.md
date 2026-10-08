# Reviews

Star ratings for a product, each with an optional comment. One review per shopper per product.

Source: `src/modules/reviews/`

## How it differs from Comments

A comment is a message in a thread: there can be many per person, they nest, they can be liked. A review is a single score that feeds the product's average. They are separate tables and separate modules, and a review's comment is not part of the comment thread.

## Entity

`Review` (`domain/entities/review.entity.ts`): `rating` is a whole number from 1 to 5; `body` is optional, trimmed, at most 1000 characters, and a blank one is stored as `null`. `revise()` replaces both at once, so rating again without a comment removes a comment that was there before.

`summarizeRatings()` (`domain/rating-summary.ts`) turns "how many ratings per star value" into `{ average, count, distribution }`. `average` is rounded to two decimals and is `null` while nobody has rated.

## Endpoints

`ReviewsController`, nested under the product: `/catalog/products/:productId/reviews`

- `GET /` is public and paginated. It returns:
  - `items`: only the reviews that carry a comment, most recently edited first. `total` counts those.
  - `summary`: covers every rating, with or without a comment.
  - `viewerReview`: the caller's own review when a token is sent (`OptionalJwtAuthGuard`), otherwise `null`. It is separate from `items` because a rating without a comment is not listed.
- `PUT /mine` (JWT) with `{ rating, body? }` creates the caller's review or replaces it. 404 if the product doesn't exist, 400 if the rating is out of range or the comment fails moderation.
- `DELETE /mine` (JWT) removes the caller's review. 204 whether or not there was one.

Reviews are addressed by (product, caller), never by id, so there is no route that can name another user's review.

## Persistence

`product_reviews` (migration `20261007120000_add_product_reviews`), `@@unique([productId, userId])`, cascade on product and user delete.

`PrismaReviewRepository.save()` is an upsert on that unique key. Prisma's upsert is a read followed by a write, so two concurrent first ratings can both try to insert; the loser's P2002 is caught and turned into an update. Same race, same handling, as `PrismaCommentLikeRepository.like`.

## Interaction with other modules

- Imports **Comments** for two ports that module owns and exports: `PRODUCT_LOOKUP_PORT` and `COMMENT_MODERATION_PORT`. A review's comment goes through the same moderation chain as a product comment. A rating with no comment skips moderation entirely.
- Depends on **Users** for the auth guards.

## Known gaps

- Anyone signed in can rate any product. There is no "verified purchase" check against Orders.
- The product list and product detail responses carry no rating, so catalog cards cannot show stars without a request per product. Adding it means either denormalized `ratingCount`/`ratingSum` columns on `products` or a batch summary endpoint.
- No rate limiting, and no admin view or removal of other people's reviews.
