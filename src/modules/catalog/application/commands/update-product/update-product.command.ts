export class UpdateProductCommand {
  constructor(
    public readonly productId: string,
    public readonly name: string,
    public readonly description: string | null,
    public readonly basePriceCents: number,
    public readonly currency: string,
    public readonly categoryIds: string[],
  ) {}
}
