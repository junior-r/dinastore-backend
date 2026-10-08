export const COUNTRY_RESOLVER_PORT = Symbol('COUNTRY_RESOLVER_PORT');

/**
 * Places an IP address in a country. A port so the lookup source (a bundled
 * database today) can change without the application layer noticing.
 */
export interface CountryResolverPort {
  /**
   * ISO 3166-1 alpha-2 code, or null when the address can't be placed.
   * Null is a normal answer, not an error: loopback and private addresses
   * belong to no country, and that covers every request in local development.
   */
  resolve(ipAddress: string): string | null;
}
