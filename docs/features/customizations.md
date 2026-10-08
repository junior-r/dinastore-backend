# Customizations (design studio)

A shopper uploads their own artwork, places it on a garment in the frontend's `/customize` studio, and orders it. This module owns the artwork. The Orders module owns what was ordered with it.

## What is stored per design

Three files, all under the `designs/` storage prefix, plus one `designs` row holding their keys:

| File | Format | What it is |
| --- | --- | --- |
| `<id>-source.png` | PNG | The upload, orientation fixed and metadata stripped, scaled down to fit 4000px. No logo. Kept so the print can be regenerated if the logo changes. |
| `<id>-print.png` | PNG | The source with the store logo stamped on. This is what gets printed. |
| `<id>-thumb.webp` | WebP, 800px | A preview of the print file. The only one the shopper is given a URL for. |

PNG is used for the first two because it is lossless and keeps transparency, which most print artwork relies on.

## Endpoints

| Route | Auth | Purpose |
| --- | --- | --- |
| `GET /customizations/config` | public | The logo (URL, size, placement rule) and the upload limits. The studio previews with these numbers, so the two sides cannot drift. |
| `POST /customizations/designs` | JWT | Multipart, field `file`, plus optional `cropX`, `cropY`, `cropWidth`, `cropHeight`. Returns `{ id, thumbnailUrl, width, height, createdAt }`. |
| `GET /admin/orders/custom-items` | `orders:view` | Lives in Orders. Every ordered item with a design, with the print file URL. |

## Rules (all in `domain/design-policy.ts`)

- Accepted: PNG, JPEG, WebP, decided from the file's bytes. Up to 15 MB.
- Refused if the longest side is under 500px (`Design.create`). It would print blurry.
- The logo goes in the bottom-right corner: 22% of the design's width, capped at 25% of its height, inset by 3% of the shorter side. `logoBox()` is the single implementation; the renderer uses it and the frontend mirrors the same arithmetic with the served ratios.

## Cropping

The four crop fields are fractions (0 to 1) of the image **as displayed**, that is after its EXIF orientation is applied. Fractions rather than pixels so the browser's preview and the server agree without either knowing the other's pixel size. `cropRegion()` in the policy turns them into a pixel region and refuses anything outside the image; a partial set of fields is refused too rather than ignored.

When a crop is sent, all three stored files hold only the cropped part, and the logo is placed relative to it. The uncropped upload is not kept: re-cropping in the studio uploads the original file again with different numbers, which creates a new design. The 500px minimum applies to the cropped result.

## The logo

`STORE_LOGO_PATH` (default `assets/store-logo.png`) points at the file. **The one shipped is a temporary wordmark**; replace the file or the variable and restart. `FileStoreLogo` publishes a copy to storage under a key containing a hash of its contents, so a new logo gets a new URL and is not masked by browser caches. Designs already uploaded keep the logo they were stamped with.

## How Orders uses a design

`POST /orders` items accept an optional `customization: { designId, placement: { x, y, width } }`. Placement values are fractions of the garment photo: `x`/`y` are the design's centre, `width` its width (0.1 to 0.9).

- Orders reads designs through its own narrow `DesignLookupPort`. Someone else's design is reported as 404, not 403.
- The order item **snapshots** the design's thumbnail and print keys, the placement, and the garment photo URL. No foreign key, same as the rest of an order item, so the order survives the design or product changing.
- The garment photo is the first image that applies to the variant (`firstImageFor` in the catalog adapter). The frontend's `imagesForVariant` applies the same rule, which is what makes a placement mean the same thing on both sides. Keep them equal.
- Plain lines for one variant still merge. A customized line never merges. Stock is taken per variant across all lines.

## Known gaps

- Stored files are public to anyone with the URL. The names are random UUIDs, but there is no access control on print files.
- No rate limit on uploads, and no cleanup of designs that were uploaded and never ordered.
- No "my designs" list: a design can only be reused within the browser session that uploaded it.
- Any published product can be customized. There is no per-product switch or print area.
- No surcharge for customizing.
- No e2e spec yet. The flow was checked by hand against the running API (see the progress log in `CLAUDE.md`).
