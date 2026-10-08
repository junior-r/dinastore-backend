import { OAuthProvider, User } from '../entities/user.entity';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface OAuthAccountSummary {
  provider: OAuthProvider;
  providerAccountId: string;
  createdAt: Date;
}

export interface UserDetail {
  user: User;
  oauthAccounts: OAuthAccountSummary[];
  hasPassword: boolean;
}

export interface FindUsersParams {
  search?: string;
  skip?: number;
  take?: number;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  emailExists(email: string): Promise<boolean>;
  create(user: User): Promise<User>;
  findByProviderAccount(
    provider: OAuthProvider,
    providerAccountId: string,
  ): Promise<User | null>;
  /** Links a new provider to an already-existing user (matched by email). */
  linkOAuthAccount(
    userId: string,
    provider: OAuthProvider,
    providerAccountId: string,
  ): Promise<void>;
  /**
   * Fills in the user's avatar if they don't already have one — never
   * overwrites a photo already set (from an earlier login or a different
   * provider). A no-op when `avatarUrl` is null. Called on every OAuth login
   * so an account created before this field existed (or before its provider
   * had a photo) picks one up as soon as one becomes available.
   */
  setAvatarUrlIfMissing(
    userId: string,
    avatarUrl: string | null,
  ): Promise<void>;
  /** Creates a brand-new OAuth-only user and its first linked account atomically. */
  createFromOAuth(
    user: User,
    provider: OAuthProvider,
    providerAccountId: string,
  ): Promise<User>;
  /** Admin user list — paginated, optional search across name/email. */
  findMany(params: FindUsersParams): Promise<User[]>;
  count(params: Pick<FindUsersParams, 'search'>): Promise<number>;
  /** Persists role/permissions/isActive changes made via User's domain methods. */
  update(user: User): Promise<User>;
  /** Admin user detail — the user plus its linked OAuth accounts and whether a password is set. */
  findDetailById(id: string): Promise<UserDetail | null>;
}
