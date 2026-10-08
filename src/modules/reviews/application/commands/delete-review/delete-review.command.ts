/** Removes the requesting user's own review of a product. */
export class DeleteReviewCommand {
  constructor(
    public readonly productId: string,
    public readonly userId: string,
  ) {}
}
