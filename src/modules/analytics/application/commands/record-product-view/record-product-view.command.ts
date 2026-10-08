export class RecordProductViewCommand {
  constructor(
    /** Chosen by the browser, one per page visit. */
    public readonly viewId: string,
    public readonly productId: string,
    public readonly visitorId: string,
    public readonly durationMs: number,
    public readonly favorited: boolean,
    /** Null when the request carried no valid token. */
    public readonly userId: string | null,
    /** As seen by the server on the connection, never client-supplied. */
    public readonly ipAddress: string,
    /**
     * A country the edge already worked out (a CDN header), when there is one
     * and it can be trusted. Saves the lookup, and is right in the cases a
     * local database gets wrong.
     */
    public readonly countryHint: string | null,
  ) {}
}
