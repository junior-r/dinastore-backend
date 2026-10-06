export class PayOrderCommand {
  constructor(
    public readonly userId: string,
    public readonly orderId: string,
  ) {}
}
