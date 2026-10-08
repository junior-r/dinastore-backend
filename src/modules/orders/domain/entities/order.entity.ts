import { DomainError } from '@/shared/domain/domain-error';
import { normalizePlacement } from '@/modules/orders/domain/design-placement';
import type { DesignPlacement } from '@/modules/orders/domain/design-placement';

export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

/**
 * The customer design printed on a line item. A snapshot like the rest of the
 * item: the files and the garment photo are copied in at order time, so the
 * order still describes what was bought if the design or product changes.
 */
export interface OrderItemCustomization {
  designId: string;
  /** Storage keys, see FileStorage. */
  thumbnailKey: string;
  printKey: string;
  /** The garment photo the placement is relative to, if the variant had one. */
  garmentImageUrl: string | null;
  placement: DesignPlacement;
}

export interface OrderItemProps {
  id: string;
  productId: string;
  productVariantId: string;
  productName: string;
  variantSize: string;
  variantColor: string;
  unitPriceCents: number;
  quantity: number;
  /** Null for a plain, uncustomized item. */
  customization: OrderItemCustomization | null;
}

export interface OrderProps {
  id: string;
  userId: string;
  status: OrderStatus;
  currency: string;
  items: OrderItemProps[];
  createdAt: Date;
  updatedAt: Date;
}

export type NewOrderItemProps = Omit<OrderItemProps, 'id'>;

export interface NewOrderProps {
  userId: string;
  currency: string;
  items: NewOrderItemProps[];
}

export class Order {
  private constructor(private readonly props: OrderProps) {}

  static create(props: NewOrderProps): Order {
    if (props.items.length === 0) {
      throw new DomainError('An order must have at least one item');
    }
    for (const item of props.items) {
      if (item.quantity <= 0) {
        throw new DomainError('Order item quantity must be positive');
      }
      if (item.unitPriceCents < 0) {
        throw new DomainError('Order item unitPriceCents cannot be negative');
      }
    }

    const now = new Date();
    return new Order({
      id: crypto.randomUUID(),
      userId: props.userId,
      status: OrderStatus.PENDING,
      currency: props.currency,
      items: props.items.map((item) => ({
        id: crypto.randomUUID(),
        ...item,
        customization: item.customization && {
          ...item.customization,
          placement: normalizePlacement(item.customization.placement),
        },
      })),
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: OrderProps): Order {
    return new Order(props);
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get status(): OrderStatus {
    return this.props.status;
  }

  get currency(): string {
    return this.props.currency;
  }

  get items(): OrderItemProps[] {
    return this.props.items;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  subtotalCents(): number {
    return this.props.items.reduce(
      (sum, item) => sum + item.unitPriceCents * item.quantity,
      0,
    );
  }

  belongsTo(userId: string): boolean {
    return this.props.userId === userId;
  }

  pay(): Order {
    if (this.props.status !== OrderStatus.PENDING) {
      throw new DomainError(
        `Cannot pay an order in "${this.props.status}" status`,
      );
    }
    return new Order({
      ...this.props,
      status: OrderStatus.PAID,
      updatedAt: new Date(),
    });
  }

  cancel(): Order {
    if (this.props.status !== OrderStatus.PENDING) {
      throw new DomainError(
        `Cannot cancel an order in "${this.props.status}" status`,
      );
    }
    return new Order({
      ...this.props,
      status: OrderStatus.CANCELLED,
      updatedAt: new Date(),
    });
  }

  toPersistenceProps(): OrderProps {
    return this.props;
  }
}
