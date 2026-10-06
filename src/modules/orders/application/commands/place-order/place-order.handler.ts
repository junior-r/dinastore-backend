import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DomainError } from '@/shared/domain/domain-error';
import { Order } from '@/modules/orders/domain/entities/order.entity';
import type { OrderItemCustomization } from '@/modules/orders/domain/entities/order.entity';
import { DESIGN_LOOKUP_PORT } from '@/modules/orders/domain/repositories/design-lookup.port';
import type { DesignLookupPort } from '@/modules/orders/domain/repositories/design-lookup.port';
import {
  ORDER_REPOSITORY,
  StockDecrement,
} from '@/modules/orders/domain/repositories/order.repository';
import type { OrderRepository } from '@/modules/orders/domain/repositories/order.repository';
import { PRODUCT_CATALOG_PORT } from '@/modules/orders/domain/repositories/product-catalog.port';
import type {
  OrderableVariant,
  ProductCatalogPort,
} from '@/modules/orders/domain/repositories/product-catalog.port';
import { PlaceOrderCommand } from './place-order.command';
import type { PlaceOrderItemInput } from './place-order.command';

@CommandHandler(PlaceOrderCommand)
export class PlaceOrderHandler implements ICommandHandler<
  PlaceOrderCommand,
  Order
> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orderRepository: OrderRepository,
    @Inject(PRODUCT_CATALOG_PORT) private readonly catalog: ProductCatalogPort,
    @Inject(DESIGN_LOOKUP_PORT) private readonly designs: DesignLookupPort,
  ) {}

  async execute(command: PlaceOrderCommand): Promise<Order> {
    if (command.items.length === 0) {
      throw new DomainError('An order must have at least one item');
    }
    for (const item of command.items) {
      if (item.quantity <= 0) {
        throw new DomainError('Order item quantity must be positive');
      }
    }

    const lines = this.toLines(command.items);
    const variantsById = await this.loadVariants(lines);
    const customizations = await this.resolveCustomizations(
      command.userId,
      lines,
      variantsById,
    );

    const variants = [...variantsById.values()];
    const currency = variants[0].currency;
    if (variants.some((variant) => variant.currency !== currency)) {
      throw new DomainError('Order items must share the same currency');
    }

    const order = Order.create({
      userId: command.userId,
      currency,
      items: lines.map((line, index) => {
        const variant = variantsById.get(line.productVariantId)!;
        return {
          productId: variant.productId,
          productVariantId: variant.productVariantId,
          productName: variant.productName,
          variantSize: variant.variantSize,
          variantColor: variant.variantColor,
          unitPriceCents: variant.unitPriceCents,
          quantity: line.quantity,
          customization: customizations[index],
        };
      }),
    });

    // Stock is per variant no matter how many lines draw on it: a plain tee
    // and the same tee with a design come out of the same pile.
    const quantityByVariantId = new Map<string, number>();
    for (const line of lines) {
      quantityByVariantId.set(
        line.productVariantId,
        (quantityByVariantId.get(line.productVariantId) ?? 0) + line.quantity,
      );
    }
    const stockDecrements: StockDecrement[] = [...quantityByVariantId].map(
      ([productVariantId, quantity]) => ({ productVariantId, quantity }),
    );

    return this.orderRepository.create(order, stockDecrements);
  }

  /**
   * Plain lines for the same variant collapse into one. A customized line
   * never merges, not even with another carrying the same design: its
   * placement is part of what was ordered.
   */
  private toLines(items: PlaceOrderItemInput[]): PlaceOrderItemInput[] {
    const plainQuantities = new Map<string, number>();
    const customized: PlaceOrderItemInput[] = [];

    for (const item of items) {
      if (item.customization) {
        customized.push(item);
      } else {
        plainQuantities.set(
          item.productVariantId,
          (plainQuantities.get(item.productVariantId) ?? 0) + item.quantity,
        );
      }
    }

    return [
      ...[...plainQuantities].map(([productVariantId, quantity]) => ({
        productVariantId,
        quantity,
      })),
      ...customized,
    ];
  }

  private async loadVariants(
    lines: PlaceOrderItemInput[],
  ): Promise<Map<string, OrderableVariant>> {
    const ids = [...new Set(lines.map((line) => line.productVariantId))];
    const variants = await this.catalog.findVariantsByIds(ids);
    const variantsById = new Map(
      variants.map((variant) => [variant.productVariantId, variant]),
    );

    for (const id of ids) {
      const variant = variantsById.get(id);
      if (!variant) {
        throw new NotFoundException(`Product variant "${id}" not found`);
      }
      if (!variant.isPublished) {
        throw new DomainError(
          `Product "${variant.productName}" is not available for purchase`,
        );
      }
    }
    return variantsById;
  }

  /** One entry per line, in order: its customization snapshot, or null. */
  private async resolveCustomizations(
    userId: string,
    lines: PlaceOrderItemInput[],
    variantsById: Map<string, OrderableVariant>,
  ): Promise<(OrderItemCustomization | null)[]> {
    const designIds = [
      ...new Set(
        lines.flatMap((line) =>
          line.customization ? [line.customization.designId] : [],
        ),
      ),
    ];
    const designsById = new Map(
      (await this.designs.findByIds(designIds)).map((design) => [
        design.designId,
        design,
      ]),
    );

    return lines.map((line) => {
      if (!line.customization) return null;

      const design = designsById.get(line.customization.designId);
      // Someone else's design is reported as missing, not as forbidden, so
      // design ids can't be probed for existence.
      if (!design || design.ownerId !== userId) {
        throw new NotFoundException(
          `Design "${line.customization.designId}" not found`,
        );
      }

      return {
        designId: design.designId,
        thumbnailKey: design.thumbnailKey,
        printKey: design.printKey,
        garmentImageUrl:
          variantsById.get(line.productVariantId)?.imageUrl ?? null,
        placement: line.customization.placement,
      };
    });
  }
}
