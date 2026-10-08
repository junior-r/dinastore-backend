/**
 * One command for a first rating and for changing it: a shopper has at most
 * one review per product, so "rate" always means "this is my rating now".
 */
export class RateProductCommand {
  constructor(
    public readonly productId: string,
    public readonly userId: string,
    public readonly rating: number,
    /** Omitted or blank for a rating without a comment. */
    public readonly body: string | null = null,
  ) {}
}
