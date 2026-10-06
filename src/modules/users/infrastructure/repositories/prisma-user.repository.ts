import { Injectable } from '@nestjs/common';
import type { Prisma } from '@generated/prisma/client';
import { PrismaService } from '@/shared/infrastructure/prisma/prisma.service';
import {
  OAuthProvider,
  Role,
  User,
} from '@/modules/users/domain/entities/user.entity';
import {
  FindUsersParams,
  UserDetail,
  UserRepository,
} from '@/modules/users/domain/repositories/user.repository';

type UserRecord = Prisma.UserModel;

function toDomainRole(role: string): Role {
  switch (role) {
    case 'CUSTOMER':
      return Role.CUSTOMER;
    case 'STAFF':
      return Role.STAFF;
    case 'ADMIN':
      return Role.ADMIN;
    default:
      throw new Error(`Unknown user role from persistence: "${role}"`);
  }
}

function toDomainProvider(provider: string): OAuthProvider {
  switch (provider) {
    case 'GOOGLE':
      return OAuthProvider.GOOGLE;
    case 'GITHUB':
      return OAuthProvider.GITHUB;
    case 'SPOTIFY':
      return OAuthProvider.SPOTIFY;
    case 'APPLE':
      return OAuthProvider.APPLE;
    default:
      throw new Error(`Unknown OAuth provider from persistence: "${provider}"`);
  }
}

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { email } });
    return record ? this.toDomain(record) : null;
  }

  async emailExists(email: string): Promise<boolean> {
    const record = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return record !== null;
  }

  async create(user: User): Promise<User> {
    const props = user.toPersistenceProps();

    const record = await this.prisma.user.create({
      data: {
        id: props.id,
        email: props.email,
        passwordHash: props.passwordHash,
        name: props.name,
        role: props.role,
        isActive: props.isActive,
        permissions: props.permissions,
      },
    });

    return this.toDomain(record);
  }

  async findByProviderAccount(
    provider: OAuthProvider,
    providerAccountId: string,
  ): Promise<User | null> {
    const account = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      include: { user: true },
    });
    return account ? this.toDomain(account.user) : null;
  }

  async linkOAuthAccount(
    userId: string,
    provider: OAuthProvider,
    providerAccountId: string,
  ): Promise<void> {
    await this.prisma.oAuthAccount.create({
      data: { id: crypto.randomUUID(), userId, provider, providerAccountId },
    });
  }

  async setAvatarUrlIfMissing(
    userId: string,
    avatarUrl: string | null,
  ): Promise<void> {
    if (!avatarUrl) {
      return;
    }
    await this.prisma.user.updateMany({
      where: { id: userId, avatarUrl: null },
      data: { avatarUrl },
    });
  }

  async createFromOAuth(
    user: User,
    provider: OAuthProvider,
    providerAccountId: string,
  ): Promise<User> {
    const props = user.toPersistenceProps();

    const record = await this.prisma.user.create({
      data: {
        id: props.id,
        email: props.email,
        passwordHash: props.passwordHash,
        name: props.name,
        avatarUrl: props.avatarUrl,
        role: props.role,
        isActive: props.isActive,
        permissions: props.permissions,
        oauthAccounts: {
          create: [{ id: crypto.randomUUID(), provider, providerAccountId }],
        },
      },
    });

    return this.toDomain(record);
  }

  async findMany(params: FindUsersParams): Promise<User[]> {
    const records = await this.prisma.user.findMany({
      where: this.toWhere(params.search),
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    });
    return records.map((record) => this.toDomain(record));
  }

  async count(params: Pick<FindUsersParams, 'search'>): Promise<number> {
    return this.prisma.user.count({ where: this.toWhere(params.search) });
  }

  async update(user: User): Promise<User> {
    const props = user.toPersistenceProps();
    const record = await this.prisma.user.update({
      where: { id: props.id },
      data: {
        email: props.email,
        passwordHash: props.passwordHash,
        name: props.name,
        avatarUrl: props.avatarUrl,
        role: props.role,
        isActive: props.isActive,
        permissions: props.permissions,
      },
    });
    return this.toDomain(record);
  }

  async findDetailById(id: string): Promise<UserDetail | null> {
    const record = await this.prisma.user.findUnique({
      where: { id },
      include: { oauthAccounts: true },
    });
    if (!record) {
      return null;
    }
    return {
      user: this.toDomain(record),
      oauthAccounts: record.oauthAccounts.map((account) => ({
        provider: toDomainProvider(account.provider),
        providerAccountId: account.providerAccountId,
        createdAt: account.createdAt,
      })),
      hasPassword: record.passwordHash !== null,
    };
  }

  private toWhere(search?: string): Prisma.UserWhereInput {
    return search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};
  }

  private toDomain(record: UserRecord): User {
    return User.fromPersistence({
      id: record.id,
      email: record.email,
      passwordHash: record.passwordHash,
      name: record.name,
      avatarUrl: record.avatarUrl,
      role: toDomainRole(record.role),
      isActive: record.isActive,
      permissions: record.permissions,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
