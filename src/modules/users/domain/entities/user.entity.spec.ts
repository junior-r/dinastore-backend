import { DomainError } from '@/shared/domain/domain-error';
import { Role, User } from './user.entity';

describe('User entity', () => {
  const validProps = {
    email: 'Jane@Example.com',
    passwordHash: 'salt:hash',
    name: 'Jane Doe',
  };

  describe('create', () => {
    it('creates a user with CUSTOMER role by default and a normalized email', () => {
      const user = User.create(validProps);

      expect(user.id).toEqual(expect.any(String));
      expect(user.email).toBe('jane@example.com');
      expect(user.role).toBe(Role.CUSTOMER);
      expect(user.isAdmin()).toBe(false);
      expect(user.name).toBe('Jane Doe');
    });

    it('never has an avatarUrl — password registration has no way to set one', () => {
      const user = User.create({
        ...validProps,
        ...({ avatarUrl: 'https://example.com/sneaky.jpg' } as object),
      });
      expect(user.avatarUrl).toBeNull();
    });

    it('allows an explicit role', () => {
      const user = User.create({ ...validProps, role: Role.ADMIN });
      expect(user.role).toBe(Role.ADMIN);
      expect(user.isAdmin()).toBe(true);
    });

    it('rejects an invalid email', () => {
      expect(() =>
        User.create({ ...validProps, email: 'not-an-email' }),
      ).toThrow(DomainError);
    });

    it('rejects a blank name', () => {
      expect(() => User.create({ ...validProps, name: '   ' })).toThrow(
        'User name cannot be empty',
      );
    });

    it('rejects a blank passwordHash', () => {
      expect(() => User.create({ ...validProps, passwordHash: '' })).toThrow(
        'User passwordHash cannot be empty',
      );
    });

    it('defaults to active with no permissions', () => {
      const user = User.create(validProps);
      expect(user.isActive).toBe(true);
      expect(user.permissions).toEqual([]);
    });
  });

  describe('deactivate / activate / changeRole / setPermissions', () => {
    it('deactivate() and activate() toggle isActive without touching other fields', () => {
      const user = User.create(validProps);

      const deactivated = user.deactivate();
      expect(deactivated.isActive).toBe(false);
      expect(deactivated.id).toBe(user.id);
      expect(deactivated.email).toBe(user.email);

      const reactivated = deactivated.activate();
      expect(reactivated.isActive).toBe(true);
    });

    it('changeRole() returns a user with the new role', () => {
      const user = User.create(validProps);
      const staff = user.changeRole(Role.STAFF);
      expect(staff.role).toBe(Role.STAFF);
      expect(user.role).toBe(Role.CUSTOMER); // original untouched (immutable)
    });

    it('setPermissions() replaces the full permissions list', () => {
      const user = User.create(validProps).setPermissions(['products:view']);
      expect(user.permissions).toEqual(['products:view']);

      const updated = user.setPermissions(['users:manage']);
      expect(updated.permissions).toEqual(['users:manage']);
    });
  });

  describe('createFromOAuth', () => {
    it('creates a CUSTOMER user with no password hash and a normalized email', () => {
      const user = User.createFromOAuth({
        email: 'Jane@Example.com',
        name: 'Jane Doe',
      });

      expect(user.id).toEqual(expect.any(String));
      expect(user.email).toBe('jane@example.com');
      expect(user.role).toBe(Role.CUSTOMER);
      expect(user.passwordHash).toBeNull();
    });

    it('rejects an invalid email', () => {
      expect(() =>
        User.createFromOAuth({ email: 'not-an-email', name: 'Jane Doe' }),
      ).toThrow(DomainError);
    });

    it('rejects a blank name', () => {
      expect(() =>
        User.createFromOAuth({ email: 'jane@example.com', name: '  ' }),
      ).toThrow('User name cannot be empty');
    });
  });

  describe('fromPersistence / toPersistenceProps', () => {
    it('round-trips props without mutation', () => {
      const props = {
        id: 'user-1',
        email: 'jane@example.com',
        passwordHash: 'salt:hash',
        name: 'Jane Doe',
        avatarUrl: null,
        role: Role.CUSTOMER,
        isActive: true,
        permissions: [],
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      };

      const user = User.fromPersistence(props);

      expect(user.toPersistenceProps()).toEqual(props);
    });
  });
});
