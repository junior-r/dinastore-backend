import type { DesignPlacement } from '@/modules/orders/domain/design-placement';

export interface PlaceOrderItemInput {
  productVariantId: string;
  quantity: number;
  /** Present when the shopper customized this line in the design studio. */
  customization?: {
    designId: string;
    placement: DesignPlacement;
  };
}

export class PlaceOrderCommand {
  constructor(
    public readonly userId: string,
    public readonly items: PlaceOrderItemInput[],
  ) {}
}
