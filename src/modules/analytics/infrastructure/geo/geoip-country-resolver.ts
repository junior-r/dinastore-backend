import { Injectable, Logger } from '@nestjs/common';
import { lookup } from 'geoip-country';
import { CountryResolverPort } from '@/modules/analytics/domain/ports/country-resolver.port';

/**
 * Country lookup against the database bundled with the `geoip-country`
 * package. It runs in-process: no visitor address is ever sent to a
 * third-party service to find out where it is.
 *
 * The data is a snapshot from when the package was installed, and IP ranges
 * are reassigned over time, so accuracy drifts until the dependency is
 * updated.
 */
@Injectable()
export class GeoIpCountryResolver implements CountryResolverPort {
  private readonly logger = new Logger(GeoIpCountryResolver.name);

  resolve(ipAddress: string): string | null {
    try {
      return lookup(ipAddress)?.country ?? null;
    } catch (error) {
      // The country is a nice-to-have on a row whose real payload is the
      // visit itself. A malformed address must not cost the whole record, so
      // unlike other adapters this one degrades to "unknown" instead of
      // throwing. It is logged so a systematic failure doesn't go unnoticed.
      this.logger.warn(
        `Country lookup failed for "${ipAddress}": ${String(error)}`,
      );
      return null;
    }
  }
}
