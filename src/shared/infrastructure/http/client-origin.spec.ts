import {
  normalizeIp,
  parseTrustProxy,
  readCountryHeader,
} from './client-origin';

describe('parseTrustProxy', () => {
  it.each([undefined, '', '   ', 'false'])(
    'treats %p as "trust nothing"',
    (value) => {
      expect(parseTrustProxy(value)).toBeUndefined();
    },
  );

  it('reads a hop count as a number', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy(' 2 ')).toBe(2);
  });

  it('reads "true" as trusting every hop', () => {
    expect(parseTrustProxy('true')).toBe(true);
  });

  it('passes an address list through for Express to interpret', () => {
    expect(parseTrustProxy('loopback, 10.0.0.0/8')).toBe(
      'loopback, 10.0.0.0/8',
    );
  });
});

describe('normalizeIp', () => {
  it('leaves plain IPv4 and IPv6 addresses alone', () => {
    expect(normalizeIp('203.0.113.7')).toBe('203.0.113.7');
    expect(normalizeIp('2001:db8::1')).toBe('2001:db8::1');
  });

  it('unwraps an IPv4 address reported in IPv6-mapped form', () => {
    expect(normalizeIp('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(normalizeIp('::FFFF:127.0.0.1')).toBe('127.0.0.1');
  });

  it.each([undefined, '', '  '])('falls back to "unknown" for %p', (value) => {
    expect(normalizeIp(value)).toBe('unknown');
  });
});

describe('readCountryHeader', () => {
  it('returns an upper-cased two-letter code', () => {
    expect(readCountryHeader('ve')).toBe('VE');
    expect(readCountryHeader(' US ')).toBe('US');
  });

  it('takes the first value when the header was sent more than once', () => {
    expect(readCountryHeader(['CO', 'US'])).toBe('CO');
  });

  it.each(['XX', 'T1'])('ignores the %s placeholder', (value) => {
    expect(readCountryHeader(value)).toBeNull();
  });

  it.each([undefined, '', 'USA', 'U', '12', 'U$'])(
    'ignores %p, which is not a country code',
    (value) => {
      expect(readCountryHeader(value)).toBeNull();
    },
  );
});
