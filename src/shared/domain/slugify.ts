// Normalizes to the same charset every slug field in this codebase already
// validates against: `^[a-z0-9]+(-[a-z0-9]+)*$`.
const COMBINING_DIACRITICS = /[̀-ͯ]/g;

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(COMBINING_DIACRITICS, '') // e.g. "café" -> "cafe"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
