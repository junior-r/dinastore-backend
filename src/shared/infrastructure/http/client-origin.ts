// What the server can say about where a request came from. Kept in shared/
// because the proxy setting is app-wide (main.ts) even though Analytics is the
// first module to read the results.

const IPV4_MAPPED_PREFIX = '::ffff:';
const COUNTRY_CODE = /^[A-Za-z]{2}$/;
// Cloudflare's placeholders for "unknown" and "Tor exit node". They match the
// two-letter shape but are not countries.
const NON_COUNTRY_CODES = new Set(['XX', 'T1']);

/**
 * Parses the TRUST_PROXY env var into the value Express's `trust proxy`
 * setting takes. Undefined (the default) means "trust nothing", which is the
 * only safe answer when the app is reached directly.
 *
 * This matters for analytics specifically: with a proxy in front and this
 * unset, every visitor is recorded with the proxy's address. Set too
 * generously, anyone can put the address they like in X-Forwarded-For.
 *  - a number is how many proxy hops to trust ("1" for a single load balancer)
 *  - "true" trusts every hop, only sane when the app is unreachable directly
 *  - anything else is passed through as Express's list of addresses/subnets
 */
export function parseTrustProxy(
  value: string | undefined,
): boolean | number | string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === 'false') {
    return undefined;
  }
  if (trimmed === 'true') {
    return true;
  }
  return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}

/**
 * The address to record for a request. Node reports an IPv4 client on a
 * dual-stack socket as "::ffff:203.0.113.7"; that prefix is dropped so one
 * visitor isn't stored under two spellings.
 */
export function normalizeIp(raw: string | undefined): string {
  const ip = raw?.trim();
  if (!ip) {
    return 'unknown';
  }
  return ip.toLowerCase().startsWith(IPV4_MAPPED_PREFIX)
    ? ip.slice(IPV4_MAPPED_PREFIX.length)
    : ip;
}

/**
 * Reads a country code a CDN put on the request (e.g. Cloudflare's
 * CF-IPCountry). Returns null for anything that isn't a plain two-letter
 * code, since the header is free text from the network's point of view.
 */
export function readCountryHeader(
  value: string | string[] | undefined,
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const code = raw?.trim().toUpperCase();
  if (!code || !COUNTRY_CODE.test(code) || NON_COUNTRY_CODES.has(code)) {
    return null;
  }
  return code;
}
