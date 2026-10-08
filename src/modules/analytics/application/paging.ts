const MAX_PAGE_SIZE = 100;

/**
 * Clamped here as well as in the DTOs: the handlers are callable from
 * anywhere in the app, not only through the validated HTTP routes.
 */
export function clampPage(
  page: number,
  pageSize: number,
): { page: number; pageSize: number; skip: number } {
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.trunc(pageSize)),
  );
  return {
    page: safePage,
    pageSize: safePageSize,
    skip: (safePage - 1) * safePageSize,
  };
}
