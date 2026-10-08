import { DomainError } from '@/shared/domain/domain-error';

export enum Role {
  CUSTOMER = 'CUSTOMER',
  STAFF = 'STAFF',
  ADMIN = 'ADMIN',
}

// Extending to a new provider (GitHub, Spotify, Apple, ...) only needs a new
// member here plus a matching Passport strategy — see users.module.ts.
export enum OAuthProvider {
  GOOGLE = 'GOOGLE',
  GITHUB = 'GITHUB',
  SPOTIFY = 'SPOTIFY',
  APPLE = 'APPLE',
}

export interface UserProps {
  id: string;
  email: string;
  // Null for users who only ever signed in via an OAuth provider.
  passwordHash: string | null;
  name: string;
  // Only ever populated from an OAuth provider's profile photo — password
  // registration (NewUserProps below) has no way to set this at all.
  avatarUrl: string | null;
  role: Role;
  // Blocks future logins once false; does not revoke already-issued JWTs
  // (JwtStrategy is stateless) -- see prisma/schema.prisma's User.isActive
  // comment for the full tradeoff.
  isActive: boolean;
  // Fixed permission strings (see Permission enum) -- only meaningful for
  // STAFF; ADMIN bypasses permission checks regardless of this list.
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type NewUserProps = Omit<
  UserProps,
  | 'id'
  | 'passwordHash'
  | 'avatarUrl'
  | 'role'
  | 'isActive'
  | 'permissions'
  | 'createdAt'
  | 'updatedAt'
> & {
  passwordHash: string;
  role?: Role;
};

export type NewOAuthUserProps = Omit<
  UserProps,
  | 'id'
  | 'passwordHash'
  | 'avatarUrl'
  | 'role'
  | 'isActive'
  | 'permissions'
  | 'createdAt'
  | 'updatedAt'
> & {
  avatarUrl?: string | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalized)) {
    throw new DomainError('User email is not a valid email address');
  }
  return normalized;
}

export class User {
  private constructor(private readonly props: UserProps) {}

  static create(props: NewUserProps): User {
    const email = normalizeEmail(props.email);
    if (!props.name.trim()) {
      throw new DomainError('User name cannot be empty');
    }
    if (!props.passwordHash.trim()) {
      throw new DomainError('User passwordHash cannot be empty');
    }

    return new User({
      id: crypto.randomUUID(),
      email,
      passwordHash: props.passwordHash,
      name: props.name,
      avatarUrl: null,
      role: props.role ?? Role.CUSTOMER,
      isActive: true,
      permissions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static createFromOAuth(props: NewOAuthUserProps): User {
    const email = normalizeEmail(props.email);
    if (!props.name.trim()) {
      throw new DomainError('User name cannot be empty');
    }

    return new User({
      id: crypto.randomUUID(),
      email,
      passwordHash: null,
      name: props.name,
      avatarUrl: props.avatarUrl ?? null,
      role: Role.CUSTOMER,
      isActive: true,
      permissions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static fromPersistence(props: UserProps): User {
    return new User(props);
  }

  get id(): string {
    return this.props.id;
  }

  get email(): string {
    return this.props.email;
  }

  get passwordHash(): string | null {
    return this.props.passwordHash;
  }

  get name(): string {
    return this.props.name;
  }

  get avatarUrl(): string | null {
    return this.props.avatarUrl;
  }

  get role(): Role {
    return this.props.role;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get permissions(): string[] {
    return this.props.permissions;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isAdmin(): boolean {
    return this.props.role === Role.ADMIN;
  }

  deactivate(): User {
    return new User({ ...this.props, isActive: false, updatedAt: new Date() });
  }

  activate(): User {
    return new User({ ...this.props, isActive: true, updatedAt: new Date() });
  }

  changeRole(role: Role): User {
    return new User({ ...this.props, role, updatedAt: new Date() });
  }

  setPermissions(permissions: string[]): User {
    return new User({ ...this.props, permissions, updatedAt: new Date() });
  }

  toPersistenceProps(): UserProps {
    return this.props;
  }
}
