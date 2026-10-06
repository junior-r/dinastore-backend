export class GetCustomizedOrderItemsQuery {
  constructor(
    public readonly page: number,
    public readonly pageSize: number,
  ) {}
}
