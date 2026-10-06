// Prisma's error codes that the app reacts to, named once. They were string
// literals repeated in the exception filter and in each repository that
// handles an upsert race.
export const PRISMA_ERROR = {
  UNIQUE_CONSTRAINT: 'P2002',
  FOREIGN_KEY_CONSTRAINT: 'P2003',
  RECORD_NOT_FOUND: 'P2025',
} as const;
