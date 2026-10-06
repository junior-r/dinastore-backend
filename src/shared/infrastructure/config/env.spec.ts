import { ENV_DEFAULTS, validateEnv } from './env';

const minimal = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_SECRET: 'secret',
};

describe('validateEnv', () => {
  it('fills in every default when only the required variables are set', () => {
    const env = validateEnv(minimal);

    expect(env.PORT).toBe(ENV_DEFAULTS.PORT);
    expect(env.FRONTEND_URL).toBe(ENV_DEFAULTS.FRONTEND_URL);
    expect(env.APP_URL).toBe(ENV_DEFAULTS.APP_URL);
    expect(env.JWT_EXPIRES_IN_SECONDS).toBe(
      ENV_DEFAULTS.JWT_EXPIRES_IN_SECONDS,
    );
    expect(env.STORAGE_DRIVER).toBe(ENV_DEFAULTS.STORAGE_DRIVER);
    expect(env.GOOGLE_CLIENT_ID).toBe(ENV_DEFAULTS.GOOGLE_NOT_CONFIGURED);
    expect(env.FEELINGS_ANALYSIS_URL).toBeUndefined();
    expect(env.TRUST_PROXY).toBeUndefined();
  });

  it('keeps a value that was provided', () => {
    const env = validateEnv({
      ...minimal,
      FRONTEND_URL: 'https://shop.example.com',
      PORT: '8080',
      TRUST_PROXY: '1',
    });

    expect(env.FRONTEND_URL).toBe('https://shop.example.com');
    expect(env.PORT).toBe('8080');
    expect(env.TRUST_PROXY).toBe('1');
  });

  it('treats an empty value as not set', () => {
    // `FRONTEND_URL=""` in a .env file must fall back to the default, and an
    // empty optional URL must not be rejected as malformed.
    const env = validateEnv({
      ...minimal,
      FRONTEND_URL: '',
      FEELINGS_ANALYSIS_URL: '   ',
    });

    expect(env.FRONTEND_URL).toBe(ENV_DEFAULTS.FRONTEND_URL);
    expect(env.FEELINGS_ANALYSIS_URL).toBeUndefined();
  });

  it('passes through variables it does not know about', () => {
    const env = validateEnv({ ...minimal, POSTGRES_USER: 'dinastore' });

    expect((env as Record<string, unknown>).POSTGRES_USER).toBe('dinastore');
  });

  it.each(['DATABASE_URL', 'JWT_SECRET'])(
    'refuses to boot without %s, and names it',
    (key) => {
      const env: Record<string, string> = { ...minimal };
      delete env[key];

      expect(() => validateEnv(env)).toThrow(key);
    },
  );

  it('refuses a required variable that is present but empty', () => {
    expect(() => validateEnv({ ...minimal, JWT_SECRET: '' })).toThrow(
      'JWT_SECRET',
    );
  });

  it.each([
    ['FRONTEND_URL', 'not a url'],
    ['APP_URL', 'localhost:3000'.replace(':', ' ')],
    ['PORT', 'three thousand'],
    ['JWT_EXPIRES_IN_SECONDS', '1d'],
    ['FEELINGS_ANALYSIS_TIMEOUT_MS', '-5'],
  ])('rejects a malformed %s', (key, value) => {
    expect(() => validateEnv({ ...minimal, [key]: value })).toThrow(key);
  });

  it('reports every problem at once, not just the first', () => {
    expect(() => validateEnv({ PORT: 'abc' })).toThrow(
      /DATABASE_URL[\s\S]*JWT_SECRET[\s\S]*PORT/,
    );
  });
});
