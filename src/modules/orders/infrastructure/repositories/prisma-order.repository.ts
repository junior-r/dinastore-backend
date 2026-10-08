import { Injectable } from '@nestjs/common';
import type { Prisma } from '@generated/prisma/client';
import { PrismaService } from '@/shared/infrastructure/prisma/prisma.service';
import { InsufficientStockError } from '@/modules/orders/domain/errors/insufficient-stock.error';
import type { DesignPlacement } from '@/modules/orders/domain/design-placement';
import {
  Order,
  OrderStatus,
} from '@/modules/orders/domain/entities/order.entity';
import type {
  OrderItemCustomization,
  OrderItemProps,
} from '@/modules/orders/domain/entities/order.entity';
import {
  CustomizedOrderItem,
  FindOrdersParams,
  OrderRepository,
  PageParams,
  StockDecrement,
} from '@/modules/orders/domain/repositories/order.repository';

function toDomainStatus(status: string): OrderStatus {
  switch (status) {
    case 'PENDING':
      return OrderStatus.PENDING;
    case 'PAID':
      return OrderStatus.PAID;
    case 'CANCELLED':
      return OrderStatus.CANCELLED;
    default:
      throw new Error(`Unknown order status from persistence: "${status}"`);
  }
}

const orderInclude = {
  items: true,
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
}>;

type OrderItemRecord = OrderWithRelations['items'][number];

// The design columns are written together or not at all.
function toCustomization(
  record: OrderItemRecord,
): OrderItemCustomization | null {
  if (
    !record.designId ||
    !record.designThumbnailKey ||
    !record.designPrintKey ||
    !record.designPlacement
  ) {
    return null;
  }
  return {
    designId: record.designId,
    thumbnailKey: record.designThumbnailKey,
    printKey: record.designPrintKey,
    garmentImageUrl: record.garmentImageUrl,
    // Written only through Order.create, which normalizes it.
    placement: record.designPlacement as unknown as DesignPlacement,
  };
}

function toItemProps(record: OrderItemRecord): OrderItemProps {
  return {
    id: record.id,
    productId: record.productId,
    productVariantId: record.productVariantId,
    productName: record.productName,
    variantSize: record.variantSize,
    variantColor: record.variantColor,
    unitPriceCents: record.unitPriceCents,
    quantity: record.quantity,
    customization: toCustomization(record),
  };
}

const customizedItemsWhere = {
  designId: { not: null },
} satisfies Prisma.OrderItemWhereInput;

@Injectable()
export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = orderInclude;

  async create(
    order: Order,
    stockDecrements: StockDecrement[],
  ): Promise<Order> {
    const props = order.toPersistenceProps();

    const record = await this.prisma.$transaction(async (tx) => {
      for (const decrement of stockDecrements) {
        const result = await tx.productVariant.updateMany({
          where: {
            id: decrement.productVariantId,
            stock: { gte: decrement.quantity },
          },
          data: { stock: { decrement: decrement.quantity } },
        });
        if (result.count !== 1) {
          throw new InsufficientStockError(decrement.productVariantId);
        }
      }

      return tx.order.create({
        data: {
          id: props.id,
          userId: props.userId,
          status: props.status,
          currency: props.currency,
          subtotalCents: order.subtotalCents(),
          items: {
            create: props.items.map((item) => ({
              id: item.id,
              productId: item.productId,
              productVariantId: item.productVariantId,
              productName: item.productName,
              variantSize: item.variantSize,
              variantColor: item.variantColor,
              unitPriceCents: item.unitPriceCents,
              quantity: item.quantity,
              ...(item.customization && {
                designId: item.customization.designId,
                designThumbnailKey: item.customization.thumbnailKey,
                designPrintKey: item.customization.printKey,
                garmentImageUrl: item.customization.garmentImageUrl,
                designPlacement: { ...item.customization.placement },
              }),
            })),
          },
        },
        include: this.include,
      });
    });

    return this.toDomain(record);
  }

  async findById(id: string): Promise<Order | null> {
    const record = await this.prisma.order.findUnique({
      where: { id },
      include: this.include,
    });
    return record ? this.toDomain(record) : null;
  }

  async findMany(params: FindOrdersParams): Promise<Order[]> {
    const records = await this.prisma.order.findMany({
      where: { userId: params.userId },
      include: this.include,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    });
    return records.map((record) => this.toDomain(record));
  }

  async countByUserId(userId: string): Promise<number> {
    return this.prisma.order.count({ where: { userId } });
  }

  async updateStatus(order: Order): Promise<Order> {
    const props = order.toPersistenceProps();
    const record = await this.prisma.order.update({
      where: { id: props.id },
      data: { status: props.status },
      include: this.include,
    });
    return this.toDomain(record);
  }

  async findCustomizedItems(
    params: PageParams,
  ): Promise<CustomizedOrderItem[]> {
    const records = await this.prisma.orderItem.findMany({
      where: customizedItemsWhere,
      include: {
        order: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
      skip: params.skip,
      take: params.take,
      // `id` only to keep paging stable among items of the same order.
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });

    return records.flatMap((record) => {
      const item = toItemProps(record);
      const { customization } = item;
      if (!customization) return [];
      return [
        {
          orderId: record.orderId,
          orderStatus: toDomainStatus(record.order.status),
          orderedAt: record.order.createdAt,
          customer: record.order.user,
          item: { ...item, customization },
        },
      ];
    });
  }

  async countCustomizedItems(): Promise<number> {
    return this.prisma.orderItem.count({ where: customizedItemsWhere });
  }

  private toDomain(record: OrderWithRelations): Order {
    return Order.fromPersistence({
      id: record.id,
      userId: record.userId,
      status: toDomainStatus(record.status),
      currency: record.currency,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      items: record.items.map(toItemProps),
    });
  }
}
