import type { FileStorage } from '@/shared/domain/storage/file-storage.port';
import type { CustomizedOrderItem } from '@/modules/orders/domain/repositories/order.repository';
import { toItemResponse } from './order-response.dto';
import type { OrderItemResponse } from './order-response.dto';

export class CustomizedOrderItemResponseDto {
  orderId: string;
  orderStatus: string;
  orderedAt: Date;
  customer: { id: string; name: string; email: string };
  item: OrderItemResponse;
  /** The full-resolution, logo-applied file to send to the printer. */
  printUrl: string;

  static fromListItem(
    entry: CustomizedOrderItem,
    storage: FileStorage,
  ): CustomizedOrderItemResponseDto {
    const dto = new CustomizedOrderItemResponseDto();
    dto.orderId = entry.orderId;
    dto.orderStatus = entry.orderStatus;
    dto.orderedAt = entry.orderedAt;
    dto.customer = entry.customer;
    dto.item = toItemResponse(entry.item, storage);
    dto.printUrl = storage.publicUrl(entry.item.customization.printKey);
    return dto;
  }
}
