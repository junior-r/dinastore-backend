export class GetOrderByIdQuery {
  constructor(
    public readonly userId: string,
    public readonly orderId: string,
  ) {}
}
