import { ScryptPasswordHasher } from './scrypt-password-hasher';

describe('ScryptPasswordHasher', () => {
  const hasher = new ScryptPasswordHasher();

  it('produces a hash that verifies against the original password', async () => {
    const hash = await hasher.hash('supersecret123');

    await expect(hasher.compare('supersecret123', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hasher.hash('supersecret123');

    await expect(hasher.compare('wrong-password', hash)).resolves.toBe(false);
  });

  it('produces a different hash each time (random salt)', async () => {
    const [first, second] = await Promise.all([
      hasher.hash('supersecret123'),
      hasher.hash('supersecret123'),
    ]);

    expect(first).not.toBe(second);
    await expect(hasher.compare('supersecret123', second)).resolves.toBe(true);
  });

  it('rejects a malformed stored hash instead of throwing', async () => {
    await expect(
      hasher.compare('supersecret123', 'not-a-valid-hash'),
    ).resolves.toBe(false);
  });
});
