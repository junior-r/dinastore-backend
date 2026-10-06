import { DomainError } from '@/shared/domain/domain-error';

export enum ProductStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export interface ProductVariantProps {
  id: string;
  size: string;
  color: string;
  sku: string;
  stock: number;
  priceCents: number | null;
}

export interface ProductImageProps {
  id: string;
  url: string;
  altText: string | null;
  position: number;
  // Which variants this image applies to. Empty means "all variants" --
  // the default for an image nobody has tagged.
  variantIds: string[];
}

// Images arrive from the API before variant ids exist (both are created in
// the same request), so an image references its variants by their index in
// the `variants` array passed alongside it -- create() resolves those to
// the freshly generated variant ids below.
export type NewProductImageInput = Omit<
  ProductImageProps,
  'id' | 'variantIds'
> & {
  variantIndexes?: number[];
};

export interface ProductProps {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  basePriceCents: number;
  currency: string;
  status: ProductStatus;
  categoryIds: string[];
  variants: ProductVariantProps[];
  images: ProductImageProps[];
  createdAt: Date;
  updatedAt: Date;
}

export type NewProductProps = Omit<
  ProductProps,
  'id' | 'status' | 'variants' | 'images' | 'createdAt' | 'updatedAt'
> & {
  variants?: Omit<ProductVariantProps, 'id'>[];
  images?: NewProductImageInput[];
};

export interface UpdateProductProps {
  name: string;
  description: string | null;
  basePriceCents: number;
  currency: string;
  categoryIds: string[];
}

// One entry per variant in the *complete* desired end-state list (like
// categoryIds' full-replace semantics) -- any existing variant whose id
// isn't present gets deleted. `id` present means "update this existing
// variant's stock/price"; size/color/sku are locked for it (not accepted
// here at all) once created, so renaming a variant can't collide with a
// sibling mid-transaction or silently reshape what a customer already added
// to their cart. `id` absent means "create a new variant" and needs the
// full shape, exactly like creation.
export interface UpdateVariantsEntry {
  id?: string;
  // Required when `id` is absent (a new variant) -- validated at runtime by
  // validateVariant() below, since a string-vs-undefined `id` check can't
  // discriminate this as a real TS union.
  size?: string;
  color?: string;
  sku?: string;
  stock: number;
  priceCents: number | null;
}

// One entry per image in the complete desired end-state list, same
// full-replace semantics as variants above. `id` present updates that
// existing image's position/altText/variant tags in place; absent creates a
// new image row. Unlike create(), variantIds are real ids here (not
// indexes) -- by the time a product is being edited, every variant already
// has a real id, so there's no need for index-resolution.
export interface UpdateImagesEntry {
  id?: string;
  url: string;
  altText: string | null;
  position: number;
  variantIds: string[];
}

export class Product {
  private constructor(private readonly props: ProductProps) {}

  private static validateCore(props: {
    name: string;
    basePriceCents: number;
    categoryIds: string[];
  }): void {
    if (props.basePriceCents < 0) {
      throw new DomainError('basePriceCents cannot be negative');
    }
    if (!props.name.trim()) {
      throw new DomainError('Product name cannot be empty');
    }
    if (props.categoryIds.length === 0) {
      throw new DomainError('Product must have at least one category');
    }
  }

  private static validateVariant(variant: {
    size: string;
    color: string;
    sku: string;
    stock: number;
    priceCents: number | null;
  }): void {
    if (!variant.sku.trim() || !variant.size.trim() || !variant.color.trim()) {
      throw new DomainError('Variant sku, size and color cannot be empty');
    }
    if (variant.stock < 0) {
      throw new DomainError('Variant stock cannot be negative');
    }
    if (variant.priceCents !== null && variant.priceCents < 0) {
      throw new DomainError('Variant priceCents cannot be negative');
    }
  }

  private static validateUniqueVariantKeys(
    variants: { size: string; color: string }[],
  ): void {
    const keys = new Set(
      variants.map((variant) => `${variant.size}::${variant.color}`),
    );
    if (keys.size !== variants.length) {
      throw new DomainError(
        'Variants must have a unique size/color combination',
      );
    }
  }

  static create(props: NewProductProps): Product {
    Product.validateCore(props);
    for (const variant of props.variants ?? []) {
      Product.validateVariant(variant);
    }
    Product.validateUniqueVariantKeys(props.variants ?? []);

    const variants = (props.variants ?? []).map((variant) => ({
      id: crypto.randomUUID(),
      ...variant,
    }));

    for (const image of props.images ?? []) {
      for (const index of image.variantIndexes ?? []) {
        if (index < 0 || index >= variants.length) {
          throw new DomainError(`Image variant index ${index} is out of range`);
        }
      }
    }

    return new Product({
      id: crypto.randomUUID(),
      name: props.name,
      slug: props.slug,
      description: props.description,
      basePriceCents: props.basePriceCents,
      currency: props.currency,
      categoryIds: props.categoryIds,
      status: ProductStatus.DRAFT,
      variants,
      images: (props.images ?? []).map(({ variantIndexes, ...image }) => ({
        id: crypto.randomUUID(),
        variantIds: (variantIndexes ?? []).map((index) => variants[index].id),
        ...image,
      })),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static fromPersistence(props: ProductProps): Product {
    return new Product(props);
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get slug(): string {
    return this.props.slug;
  }

  get description(): string | null {
    return this.props.description;
  }

  get basePriceCents(): number {
    return this.props.basePriceCents;
  }

  get currency(): string {
    return this.props.currency;
  }

  get status(): ProductStatus {
    return this.props.status;
  }

  get categoryIds(): string[] {
    return this.props.categoryIds;
  }

  get variants(): ProductVariantProps[] {
    return this.props.variants;
  }

  get images(): ProductImageProps[] {
    return this.props.images;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  totalStock(): number {
    return this.props.variants.reduce((sum, variant) => sum + variant.stock, 0);
  }

  isPublished(): boolean {
    return this.props.status === ProductStatus.PUBLISHED;
  }

  // Deliberately does not touch variants -- editing product details (name,
  // price, categories, ...) and managing stock/variants are different
  // concerns with different UX needs. Regenerating variant ids on every
  // detail edit would silently invalidate anything already in a
  // customer's cart (which is keyed by productVariantId), even for
  // variants that didn't conceptually change.
  update(props: UpdateProductProps): Product {
    Product.validateCore(props);
    return new Product({
      ...this.props,
      name: props.name,
      description: props.description,
      basePriceCents: props.basePriceCents,
      currency: props.currency,
      categoryIds: props.categoryIds,
      updatedAt: new Date(),
    });
  }

  // Full-replace, like categoryIds: the submitted list *is* the desired
  // end state, so any current variant left out gets dropped. Existing
  // variants (entries with an id) can only have their stock/price changed
  // here -- see UpdateVariantsEntry for why size/color/sku are locked once
  // created.
  updateVariants(entries: UpdateVariantsEntry[]): Product {
    const resolved: ProductVariantProps[] = entries.map((entry) => {
      if (entry.id) {
        const existing = this.props.variants.find(
          (variant) => variant.id === entry.id,
        );
        if (!existing) {
          throw new DomainError(
            `Variant "${entry.id}" not found on this product`,
          );
        }
        const updated = {
          ...existing,
          stock: entry.stock,
          priceCents: entry.priceCents,
        };
        Product.validateVariant(updated);
        return updated;
      }
      const created = {
        id: crypto.randomUUID(),
        size: entry.size ?? '',
        color: entry.color ?? '',
        sku: entry.sku ?? '',
        stock: entry.stock,
        priceCents: entry.priceCents,
      };
      Product.validateVariant(created);
      return created;
    });
    Product.validateUniqueVariantKeys(resolved);

    return new Product({
      ...this.props,
      variants: resolved,
      updatedAt: new Date(),
    });
  }

  // Full-replace, same semantics as updateVariants above -- unlike variants,
  // images carry no downstream referential risk (nothing snapshots an
  // image id), so there's no reason to lock any field on an existing entry.
  updateImages(entries: UpdateImagesEntry[]): Product {
    const validVariantIds = new Set(
      this.props.variants.map((variant) => variant.id),
    );
    const resolved: ProductImageProps[] = entries.map((entry) => {
      for (const variantId of entry.variantIds) {
        if (!validVariantIds.has(variantId)) {
          throw new DomainError(
            `Image references variant "${variantId}", which doesn't exist on this product`,
          );
        }
      }
      return {
        id: entry.id ?? crypto.randomUUID(),
        url: entry.url,
        altText: entry.altText,
        position: entry.position,
        variantIds: entry.variantIds,
      };
    });

    return new Product({
      ...this.props,
      images: resolved,
      updatedAt: new Date(),
    });
  }

  changeStatus(status: ProductStatus): Product {
    return new Product({ ...this.props, status, updatedAt: new Date() });
  }

  toPersistenceProps(): ProductProps {
    return this.props;
  }
}
