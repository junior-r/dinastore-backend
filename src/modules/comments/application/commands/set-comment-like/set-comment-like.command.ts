/**
 * One command for both directions rather than Like/Unlike pair: the only
 * thing that differs is a boolean, and both halves share the same lookup,
 * ownership-agnostic check and recount.
 */
export class SetCommentLikeCommand {
  constructor(
    public readonly commentId: string,
    public readonly userId: string,
    public readonly liked: boolean,
  ) {}
}
