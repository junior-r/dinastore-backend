export class GetProductViewsQuery {
  constructor(
    public readonly page: number = 1,
    public readonly pageSize: number = 20,
    /** Restricts the history to one product. */
    public readonly productId?: string,
  ) {}
}
