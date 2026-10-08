import { DomainError } from '@/shared/domain/domain-error';

const MAX_BODY_LENGTH = 1000;

/**
 * Deepest nesting level a comment can be rendered at. A reply to a comment
 * that is already at this depth does not go deeper — it is re-parented to
 * that comment's own parent so it lands alongside it (see `reply()`), which
 * is why nothing is ever un-replyable even though the tree is bounded.
 */
export const MAX_COMMENT_DEPTH = 3;

/**
 * The one image a comment may carry. Holds storage **keys**, not URLs — the
 * domain doesn't know (or care) which backend the files live in; URLs are
 * resolved from these keys on the read side. "At most one" is structural:
 * this is a single nullable slot on the comment, not a collection.
 */
export interface CommentImage {
  key: string;
  thumbnailKey: string;
  /** Pixel size of the full image, so the UI can reserve its box up front. */
  width: number;
  height: number;
}

export interface CommentProps {
  id: string;
  productId: string;
  userId: string;
  body: string;
  parentId: string | null;
  depth: number;
  image: CommentImage | null;
  createdAt: Date;
}

export type NewCommentProps = Omit<
  CommentProps,
  'id' | 'createdAt' | 'parentId' | 'depth' | 'image'
> & { image?: CommentImage | null };

export class Comment {
  private constructor(private readonly props: CommentProps) {}

  static create(props: NewCommentProps): Comment {
    return new Comment({
      id: crypto.randomUUID(),
      productId: props.productId,
      userId: props.userId,
      body: validateBody(props.body),
      parentId: null,
      depth: 1,
      image: props.image ?? null,
      createdAt: new Date(),
    });
  }

  static fromPersistence(props: CommentProps): Comment {
    return new Comment(props);
  }

  /**
   * Builds a reply to this comment. Kept on the entity (rather than in the
   * handler) because the depth/flattening rule is the domain invariant here:
   * a reply sits one level below its parent, except at MAX_COMMENT_DEPTH
   * where it is re-parented to the parent's own parent and stays at that
   * depth. Replying across products is impossible by construction — the
   * reply inherits `productId` from its parent.
   */
  reply(props: {
    userId: string;
    body: string;
    image?: CommentImage | null;
  }): Comment {
    const nested = this.props.depth < MAX_COMMENT_DEPTH;

    return new Comment({
      id: crypto.randomUUID(),
      productId: this.props.productId,
      userId: props.userId,
      body: validateBody(props.body),
      parentId: nested ? this.props.id : this.props.parentId,
      depth: nested ? this.props.depth + 1 : this.props.depth,
      image: props.image ?? null,
      createdAt: new Date(),
    });
  }

  get id(): string {
    return this.props.id;
  }

  get productId(): string {
    return this.props.productId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get body(): string {
    return this.props.body;
  }

  get parentId(): string | null {
    return this.props.parentId;
  }

  get depth(): number {
    return this.props.depth;
  }

  get image(): CommentImage | null {
    return this.props.image;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  belongsTo(userId: string): boolean {
    return this.props.userId === userId;
  }

  toPersistenceProps(): CommentProps {
    return this.props;
  }
}

function validateBody(raw: string): string {
  const body = raw.trim();
  if (!body) {
    throw new DomainError('Comment body cannot be empty');
  }
  if (body.length > MAX_BODY_LENGTH) {
    throw new DomainError(
      `Comment body cannot exceed ${MAX_BODY_LENGTH} characters`,
    );
  }
  return body;
}
