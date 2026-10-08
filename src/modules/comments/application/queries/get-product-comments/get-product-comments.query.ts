const MAX_PAGE_SIZE = 100;

export class GetProductCommentsQuery {
  public readonly page: number;
  public readonly pageSize: number;

  constructor(
    public readonly productId: string,
    page = 1,
    pageSize = 20,
    /**
     * The authenticated reader, when there is one. Only used to resolve
     * `likedByViewer` — the list itself is public either way.
     */
    public readonly viewerId?: string,
  ) {
    this.page = Number.isInteger(page) && page >= 1 ? page : 1;
    this.pageSize =
      Number.isInteger(pageSize) && pageSize >= 1
        ? Math.min(pageSize, MAX_PAGE_SIZE)
        : 20;
  }
}
