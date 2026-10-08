# Analytics

Records how long each visitor looks at a product page, and from where. One
row per visit, kept as a history. Module: `src/modules/analytics/`.

## What a row holds

Table `product_views` (Prisma model `ProductView`):

| Column | Meaning |
| --- | --- |
| `id` | Chosen by the browser, one per page visit. |
| `product_id`, `product_name` | The product, plus a snapshot of its name. `product_id` becomes null if the product is deleted; the name stays. |
| `user_id` | The signed-in user. Null for an anonymous visitor. |
| `visitor_id` | Random id kept in the browser's `localStorage`. Groups visits by someone who never signs in. |
| `ip_address` | Read from the connection by the server. |
| `country` | ISO 3166-1 alpha-2. Null when the address can't be placed. |
| `duration_ms` | Time the page was **visible**, not time since it opened. Capped at 4 hours. |
| `favorited` | Whether the product was in the visitor's favorites at the last report. |
| `started_at`, `last_seen_at` | When the visit opened and when it last reported. |

## Endpoints

- `POST /analytics/product-views` — public. Body: `viewId`, `productId`,
  `visitorId` (all UUIDs), `durationMs`, `favorited`. Returns 204. A token is
  optional; when present and valid the visit is tied to that user, and an
  invalid one is ignored rather than rejected.
- `GET /admin/analytics/product-views` — `ADMIN`, or `STAFF` holding
  `analytics:view`. Query: `page`, `pageSize` (max 100), plus the filters
  below. Newest first.
- `GET /admin/analytics/product-views/by-product` and `/by-visitor` — the
  same history summed up per product, or per person (an account across all
  its browsers, or a browser that never signed in). Paginated, most views
  first; `total` counts groups, not visits.
- `GET /admin/analytics/product-views/insights` — what the admin page charts:
  totals, a zero-filled daily series, top products, views by country, a
  forecast and product momentum. Takes `tzOffset`
  (`Date#getTimezoneOffset` from the browser) so a "day" is the viewer's.
- `GET /admin/analytics/product-views/export` — the filtered history as an
  `.xlsx` file with four sheets (visits, by product, by visitor, daily plus
  forecast). Takes `tzOffset` and `lang` (`en`/`es`, for sheet names and
  headers).

All four admin routes share one permission and one set of filters
(`ProductViewFilterDto`), combined with AND:

| Query | Meaning |
| --- | --- |
| `search` | Case-insensitive match on product name, visitor name or email, IP address, or the start of the browser id. |
| `from`, `to` | ISO instants; `from` inclusive, `to` exclusive. |
| `country` | Two-letter code, or `unknown` for visits that couldn't be placed. |
| `visitor` | `signed-in` or `anonymous`. |
| `favorited` | `true` or `false`. |
| `productId`, `userId`, `visitorId` | Narrow to one product, account or browser. |

## Aggregates and the two filter builders

The row list goes through a Prisma `where`; the aggregates are raw SQL
(`date_trunc`, `count(DISTINCT …)`, `FILTER`), which Prisma's query builder
can't express. So `PrismaProductViewRepository` holds the filter twice:
`where()` and `whereSql()`. **They must stay equivalent**, or the table and
the charts on the same page would describe different visits. The e2e spec
runs every filter through both and compares the counts.

`started_at` is a `timestamp` without time zone holding UTC, so instants are
sent as UTC wall-clock text cast to `timestamp`; the comparison then doesn't
depend on the database session's `TimeZone`.

## Forecast and momentum

Both live in `domain/view-forecast.ts` as plain functions and are estimates:

- **Forecast** (`forecastViews`): a least-squares line through the daily
  views of the last 28 full days, multiplied by a weekday factor once there
  are 21 days to learn it from, for the next 7 days. The range is ±1.28
  standard deviations of the model's own past error (about 80%). Days before
  the first recorded view are dropped rather than counted as zeros. With
  under 7 days of history it returns `status: 'insufficient'` instead of a
  guess. Today is excluded from the history because it is still filling up.
- **Momentum** (`rankMomentum`): each product's last 7 days against the 7
  before, labelled new / rising / steady / cooling (±20%), with next week
  projected by carrying half of the change forward.

Both ignore `from`/`to` (they always read the most recent weeks) and honor
every other filter, which is what makes a forecast for one product or one
country possible.

## Export

`ExportProductViewsHandler` gathers the data and hands it to
`ProductViewsWorkbookPort`; `ExcelJsProductViewsWorkbook` (the `exceljs`
dependency) writes the file. It is built in memory, so the visits sheet is
capped at 20,000 rows (newest kept) and says so in the file when it cuts.

## How recording works

The page sends the **running total** for the visit, repeatedly: when it
opens, every 15 seconds while visible, when the tab is hidden, when the
favorite state changes, and when it goes away. The server upserts by
`viewId`. Because every report is a total rather than a delta, a lost or
late report costs nothing; the next one supersedes it.

Rules enforced by `ProductView` and `RecordProductViewHandler`:

- **Duration only grows.** A late, smaller report can't shrink the row.
- **Who and where are fixed when the visit opens.** IP, country, product and
  visitor are never rewritten by a later report.
- **A user can be added, never swapped.** An anonymous visit picks up the
  account if the visitor signs in partway through.
- **A view id only works for the browser that opened it.** A report with a
  different `visitorId` or `productId` gets 404, the same answer as an id
  that doesn't exist.

## IP and country

Neither is accepted from the request body. The IP is `request.ip`; the
country is looked up from it in a database bundled with the `geoip-country`
package, in-process, so no visitor address is sent to a third party.

- **`TRUST_PROXY` must be set in production behind a proxy** (see
  `.env.example`). Without it every row holds the proxy's address. Only when
  it is set does the API also believe Cloudflare's `CF-IPCountry` header.
- **Local development always records `::1` or `127.0.0.1` with no country.**
  Loopback addresses belong to no country; this is expected, not a bug.
- The bundled database is a snapshot from install time. Update the
  dependency occasionally to keep it accurate.

## Privacy

This table stores IP addresses and links them to user accounts, which is
personal data under GDPR and similar laws. Nothing in the app currently asks
visitors for consent or tells them this is collected, and there is no
retention limit: rows are kept forever. Both should be addressed before this
runs against real visitors.

That sensitivity is also why reading the history has its own permission
(`analytics:view`) instead of riding on `products:view`.

## Known gaps

- **No rate limiting** on the public endpoint (the app has none anywhere).
  A script can insert rows freely. Each needs a real product id, and it can't
  touch other visitors' rows, but it can inflate counts.
- **Aggregates are computed on every request**, with no cache or rollup
  table. Fine at the current size; a large history would want daily rollups.
- **The export is synchronous and in memory.** Past the 20,000-row cap it
  would need a background job and a download link.
- The forecast is deliberately simple and has not been checked against real
  traffic. Treat it as a guide.
- Staff and admins browsing the storefront are recorded like anyone else.
- Favorites are stored per browser on the frontend, so `favorited` reflects
  that browser, not the account.

## Tests

- Unit: `product-view.entity.spec.ts`, `record-product-view.handler.spec.ts`,
  `get-product-views.handler.spec.ts`, and
  `src/shared/infrastructure/http/client-origin.spec.ts`.
- e2e: `test/analytics.e2e-spec.ts` covers anonymous and signed-in visits,
  attempts to supply a fake IP, country or user, top-ups, the permission
  matrix on the admin route, and history surviving product deletion. It
  removes every row it creates.
