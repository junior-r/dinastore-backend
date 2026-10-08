// geoip-country ships no type declarations. Only the one call this module
// makes is described.
declare module 'geoip-country' {
  interface GeoIpCountryResult {
    /** ISO 3166-1 alpha-2. */
    country: string;
  }

  export function lookup(ipAddress: string): GeoIpCountryResult | null;
}
