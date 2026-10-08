import {
  OAuthProvider,
  Role,
  User,
} from '@/modules/users/domain/entities/user.entity';
import type { PrismaService } from '@/shared/infrastructure/prisma/prisma.service';
import { PrismaUserRepository } from './prisma-user.repository';

function makePrismaMock() {
  return {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    oAuthAccount: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
}

const rawRecord = {
  id: 'user-1',
  email: 'jane@example.com',
  passwordHash: 'salt:hash',
  name: 'Jane Doe',
  avatarUrl: null,
  role: Role.CUSTOMER,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
};

describe('PrismaUserRepository', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let repository: PrismaUserRepository;

  beforeEach(() => {
    prisma = makePrismaMock();
    repository = new PrismaUserRepository(prisma as unknown as PrismaService);
  });

  it('returns null from findById when no record exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(repository.findById('missing')).resolves.toBeNull();
  });

  it('maps a found record to a domain User in findById', async () => {
    prisma.user.findUnique.mockResolvedValue(rawRecord);

    const user = await repository.findById('user-1');

    expect(user).toBeInstanceOf(User);
    expect(user?.email).toBe('jane@example.com');
    expect(user?.role).toBe(Role.CUSTOMER);
  });

  it('maps a found record to a domain User in findByEmail', async () => {
    prisma.user.findUnique.mockResolvedValue(rawRecord);

    const user = await repository.findByEmail('jane@example.com');

    expect(user).toBeInstanceOf(User);
    expect(user?.id).toBe('user-1');
  });

  it('throws if Prisma returns a role that is not a known Role', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...rawRecord,
      role: 'SUPERUSER',
    });

    await expect(repository.findById('user-1')).rejects.toThrow(
      /Unknown user role/,
    );
  });

  it('emailExists returns true only when a record is found', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1' });
    await expect(repository.emailExists('jane@example.com')).resolves.toBe(
      true,
    );

    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(repository.emailExists('missing@example.com')).resolves.toBe(
      false,
    );
  });

  it('create() inserts the user, returning the mapped domain entity', async () => {
    const user = User.create({
      email: 'jane@example.com',
      passwordHash: 'salt:hash',
      name: 'Jane Doe',
    });

    let createArgs:
      { data: { id: string; email: string; passwordHash: string } } | undefined;
    prisma.user.create.mockImplementation((args: typeof createArgs) => {
      createArgs = args;
      return Promise.resolve({ ...rawRecord, id: user.id });
    });

    const result = await repository.create(user);

    expect(createArgs?.data.id).toBe(user.id);
    expect(createArgs?.data.email).toBe('jane@example.com');
    expect(createArgs?.data.passwordHash).toBe('salt:hash');
    expect(result).toBeInstanceOf(User);
  });

  it('findByProviderAccount returns null when no linked account exists', async () => {
    prisma.oAuthAccount.findUnique.mockResolvedValue(null);
    await expect(
      repository.findByProviderAccount(OAuthProvider.GOOGLE, 'google-sub-1'),
    ).resolves.toBeNull();
  });

  it("findByProviderAccount maps the linked account's user to a domain User", async () => {
    prisma.oAuthAccount.findUnique.mockResolvedValue({ user: rawRecord });

    const user = await repository.findByProviderAccount(
      OAuthProvider.GOOGLE,
      'google-sub-1',
    );

    expect(prisma.oAuthAccount.findUnique).toHaveBeenCalledWith({
      where: {
        provider_providerAccountId: {
          provider: OAuthProvider.GOOGLE,
          providerAccountId: 'google-sub-1',
        },
      },
      include: { user: true },
    });
    expect(user).toBeInstanceOf(User);
    expect(user?.email).toBe('jane@example.com');
  });

  it('linkOAuthAccount creates an OAuthAccount row for the given user', async () => {
    let createArgs:
      | {
          data: {
            userId: string;
            provider: OAuthProvider;
            providerAccountId: string;
          };
        }
      | undefined;
    prisma.oAuthAccount.create.mockImplementation((args: typeof createArgs) => {
      createArgs = args;
      return Promise.resolve(undefined);
    });

    await repository.linkOAuthAccount(
      'user-1',
      OAuthProvider.GOOGLE,
      'google-sub-1',
    );

    expect(createArgs?.data.userId).toBe('user-1');
    expect(createArgs?.data.provider).toBe(OAuthProvider.GOOGLE);
    expect(createArgs?.data.providerAccountId).toBe('google-sub-1');
  });

  it('setAvatarUrlIfMissing does nothing when avatarUrl is null', async () => {
    await repository.setAvatarUrlIfMissing('user-1', null);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('setAvatarUrlIfMissing fills in the avatar only when the user has none', async () => {
    await repository.setAvatarUrlIfMissing(
      'user-1',
      'https://example.com/photo.jpg',
    );

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', avatarUrl: null },
      data: { avatarUrl: 'https://example.com/photo.jpg' },
    });
  });

  it('createFromOAuth inserts the user with a nested oauthAccounts create', async () => {
    const user = User.createFromOAuth({
      email: 'jane@example.com',
      name: 'Jane Doe',
    });

    let createArgs:
      | {
          data: {
            id: string;
            passwordHash: string | null;
            oauthAccounts?: unknown;
          };
        }
      | undefined;
    prisma.user.create.mockImplementation((args: typeof createArgs) => {
      createArgs = args;
      return Promise.resolve({ ...rawRecord, id: user.id, passwordHash: null });
    });

    const result = await repository.createFromOAuth(
      user,
      OAuthProvider.GOOGLE,
      'google-sub-1',
    );

    expect(createArgs?.data.id).toBe(user.id);
    expect(createArgs?.data.passwordHash).toBeNull();
    expect(createArgs?.data.oauthAccounts).toEqual({
      create: [
        expect.objectContaining({
          provider: OAuthProvider.GOOGLE,
          providerAccountId: 'google-sub-1',
        }),
      ],
    });
    expect(result).toBeInstanceOf(User);
  });
});
