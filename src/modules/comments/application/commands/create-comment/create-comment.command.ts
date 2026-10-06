export class CreateCommentCommand {
  constructor(
    public readonly productId: string,
    public readonly userId: string,
    public readonly body: string,
    /** Null for a root comment; the comment being replied to otherwise. */
    public readonly parentId: string | null = null,
    /**
     * Raw bytes of the (single) attached image exactly as uploaded, or null.
     * Untrusted: the handler validates and re-encodes it before storing.
     */
    public readonly image: Buffer | null = null,
  ) {}
}
