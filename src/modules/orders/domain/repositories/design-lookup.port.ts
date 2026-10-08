export const DESIGN_LOOKUP_PORT = Symbol('DESIGN_LOOKUP_PORT');

export interface OrderableDesign {
  designId: string;
  ownerId: string;
  thumbnailKey: string;
  printKey: string;
}

/**
 * Read-only view of the Customizations domain that Orders needs to attach a
 * design to a line item: who owns it, and which files to snapshot. Narrow for
 * the same reason ProductCatalogPort is.
 */
export interface DesignLookupPort {
  findByIds(designIds: string[]): Promise<OrderableDesign[]>;
}
