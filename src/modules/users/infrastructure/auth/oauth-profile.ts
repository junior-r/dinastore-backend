/**
 * Common shape every OAuth strategy's `validate()` must return, regardless of
 * provider. OAuthController reads `req.user` as this type — a new provider
 * (GitHub, Spotify, Apple, ...) only needs a strategy that maps its own
 * profile payload into this shape, nothing downstream has to change.
 */
export interface OAuthProfile {
  providerAccountId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}
