import { z } from 'zod';

/**
 * The one place a default for an environment variable is written down.
 *
 * Before this file each default lived inline at its point of use, so
 * "http://localhost:4321" was typed out in three files and
 * "http://localhost:3000" in two, with nothing keeping the copies equal.
 * Anything that needs a fallback imports it from here instead.
 */
export const ENV_DEFAULTS = {
  PORT: '3000',
  FRONTEND_URL: 'http://localhost:4321',
  APP_URL: 'http://localhost:3000',
  JWT_EXPIRES_IN_SECONDS: '86400',
  STORAGE_DRIVER: 'local',
  STORAGE_LOCAL_DIR: 'uploads',
  STORE_LOGO_PATH: 'assets/store-logo.png',
  GOOGLE_CALLBACK_URL: 'http://localhost:3000/auth/google/callback',
  // Deliberately a non-empty placeholder, not an error: an app with no
  // Google credentials must still boot, and only /auth/google should fail.
  GOOGLE_NOT_CONFIGURED: 'not-configured',
  FEELINGS_ANALYSIS_TIMEOUT_MS: '5000',
} as const;

// A variable present but empty (`KEY=""` in a .env file) means "not set".
// Without this, an empty string would beat the default and, for the optional
// URLs, fail validation for a value nobody meant to provide.
const blankAsUnset = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const text = () => z.preprocess(blankAsUnset, z.string().optional());
const required = () => z.preprocess(blankAsUnset, z.string());
const withDefault = (fallback: string) =>
  z.preprocess(blankAsUnset, z.string().default(fallback));

const url = (schema: z.ZodType<string | undefined>) =>
  schema.refine((value) => value === undefined || URL.canParse(value), {
    message: 'must be a valid URL',
  });

const digits = (schema: z.ZodType<string | undefined>) =>
  schema.refine((value) => value === undefined || /^\d+$/.test(value), {
    message: 'must be a whole number',
  });

// Values stay strings, exactly as they arrive from the environment. Callers
// that need a number convert at the point of use, as they already did; this
// schema's job is to reject a bad value at boot, not to change any types.
const envSchema = z.object({
  // The two the app cannot run without. Everything else has a default or is
  // an optional integration.
  DATABASE_URL: required(),
  JWT_SECRET: required(),

  PORT: digits(withDefault(ENV_DEFAULTS.PORT)),
  JWT_EXPIRES_IN_SECONDS: digits(
    withDefault(ENV_DEFAULTS.JWT_EXPIRES_IN_SECONDS),
  ),
  FRONTEND_URL: url(withDefault(ENV_DEFAULTS.FRONTEND_URL)),
  APP_URL: url(withDefault(ENV_DEFAULTS.APP_URL)),
  // Free-form on purpose: Express accepts a hop count, "true", or a list of
  // addresses. See parseTrustProxy in ../http/client-origin.ts.
  TRUST_PROXY: text(),

  STORAGE_DRIVER: withDefault(ENV_DEFAULTS.STORAGE_DRIVER),
  STORAGE_LOCAL_DIR: withDefault(ENV_DEFAULTS.STORAGE_LOCAL_DIR),
  STORAGE_PUBLIC_URL: url(text()),
  STORE_LOGO_PATH: withDefault(ENV_DEFAULTS.STORE_LOGO_PATH),

  GOOGLE_CLIENT_ID: withDefault(ENV_DEFAULTS.GOOGLE_NOT_CONFIGURED),
  GOOGLE_CLIENT_SECRET: withDefault(ENV_DEFAULTS.GOOGLE_NOT_CONFIGURED),
  GOOGLE_CALLBACK_URL: url(withDefault(ENV_DEFAULTS.GOOGLE_CALLBACK_URL)),

  FEELINGS_ANALYSIS_URL: url(text()),
  FEELINGS_ANALYSIS_API_KEY: text(),
  FEELINGS_ANALYSIS_TIMEOUT_MS: digits(
    withDefault(ENV_DEFAULTS.FEELINGS_ANALYSIS_TIMEOUT_MS),
  ),

  REDIS_URL: url(text()),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Passed to `ConfigModule.forRoot({ validate })`. Runs once at boot, so a
 * missing or malformed variable stops the app with a message naming it,
 * instead of surfacing later as a confusing failure inside whichever request
 * first needed it.
 *
 * Variables the schema doesn't know about (the POSTGRES_* ones docker-compose
 * reads, for instance) are passed through untouched.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return { ...raw, ...result.data };
}
