// Fixed, known permission set -- not admin-defined/dynamic. STAFF users are
// granted a subset of these (User.permissions); ADMIN bypasses this
// entirely (see PermissionsGuard).
export enum Permission {
  USERS_VIEW = 'users:view',
  USERS_MANAGE = 'users:manage',
  PRODUCTS_VIEW = 'products:view',
  PRODUCTS_MANAGE = 'products:manage',
  CATEGORIES_VIEW = 'categories:view',
  CATEGORIES_MANAGE = 'categories:manage',
  // The product-view history, which includes visitors' IP addresses. Separate
  // from the catalog permissions so it has to be granted on purpose.
  ANALYTICS_VIEW = 'analytics:view',
  // The custom-print list: ordered items with a customer design, including
  // the print-ready files fulfillment downloads.
  ORDERS_VIEW = 'orders:view',
}
