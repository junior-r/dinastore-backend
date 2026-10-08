const MAX_PAGE_SIZE = 100;

export class GetMyOrdersQuery {
  public readonly page: number;
  public readonly pageSize: number;

  constructor(
    public readonly userId: string,
    page = 1,
    pageSize = 20,
  ) {
    this.page = Number.isInteger(page) && page >= 1 ? page : 1;
    this.pageSize =
      Number.isInteger(pageSize) && pageSize >= 1
        ? Math.min(pageSize, MAX_PAGE_SIZE)
        : 20;
  }
}
