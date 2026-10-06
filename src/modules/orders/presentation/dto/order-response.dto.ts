import type { FileStorage } from '@/shared/domain/storage/file-storage.port';
import type { DesignPlacement } from '@/modules/orders/domain/design-placement';
import { Order } from '@/modules/orders/domain/entities/order.entity';
import type {
  OrderItemCustomization,
  OrderItemProps,
} from '@/modules/orders/domain/entities/order.entity';

export interface OrderItemCustomizationResponse {
  designId: string;
  /** Preview of the design with the store logo applied. */
  thumbnailUrl: string;
  garmentImageUrl: string | null;
  placement: DesignPlacement;
}

export interface OrderItemResponse {
  id: string;
  productId: string;
  productVariantId: string;
  productName: string;
  variantSize: string;
  variantColor: string;
  unitPriceCents: number;
  quantity: number;
  customization: OrderItemCustomizationResponse | null;
}

// The print file is left out on purpose: the buyer gets the preview, and the
// full-resolution file is only handed to staff (see AdminOrdersController).
export function toCustomizationResponse(
  customization: OrderItemCustomization,
  storage: FileStorage,
): OrderItemCustomizationResponse {
  return {
    designId: customization.designId,
    thumbnailUrl: storage.publicUrl(customization.thumbnailKey),
    garmentImageUrl: customization.garmentImageUrl,
    placement: customization.placement,
  };
}

export function toItemResponse(
  item: OrderItemProps,
  storage: FileStorage,
): OrderItemResponse {
  return {
    id: item.id,
    productId: item.productId,
    productVariantId: item.productVariantId,
    productName: item.productName,
    variantSize: item.variantSize,
    variantColor: item.variantColor,
    unitPriceCents: item.unitPriceCents,
    quantity: item.quantity,
    customization:
      item.customization &&
      toCustomizationResponse(item.customization, storage),
  };
}

export class OrderResponseDto {
  id: string;
  userId: string;
  status: string;
  currency: string;
  subtotalCents: number;
  items: OrderItemResponse[];
  createdAt: Date;
  updatedAt: Date;

  // `storage` turns the design's storage keys into URLs. Keys are what is
  // persisted (see FileStorage), so that happens here, on the way out.
  static fromDomain(order: Order, storage: FileStorage): OrderResponseDto {
    const dto = new OrderResponseDto();
    dto.id = order.id;
    dto.userId = order.userId;
    dto.status = order.status;
    dto.currency = order.currency;
    dto.subtotalCents = order.subtotalCents();
    dto.items = order.items.map((item) => toItemResponse(item, storage));
    dto.createdAt = order.createdAt;
    dto.updatedAt = order.updatedAt;
    return dto;
  }
}
