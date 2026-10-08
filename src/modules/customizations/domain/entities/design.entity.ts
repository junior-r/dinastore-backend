import { DomainError } from '@/shared/domain/domain-error';
import { MIN_DESIGN_EDGE_PX } from '@/modules/customizations/domain/design-policy';

export interface DesignProps {
  id: string;
  userId: string;
  /** The upload as received: orientation fixed, metadata stripped, no logo. */
  sourceKey: string;
  /** What gets printed: the source with the store logo applied. */
  printKey: string;
  /** Small preview, also carrying the logo. */
  thumbnailKey: string;
  /** Pixel size of the print file. */
  width: number;
  height: number;
  createdAt: Date;
}

export type NewDesignProps = Omit<DesignProps, 'createdAt'>;

export class Design {
  private constructor(private readonly props: DesignProps) {}

  static create(props: NewDesignProps): Design {
    if (Math.max(props.width, props.height) < MIN_DESIGN_EDGE_PX) {
      throw new DomainError(
        `The design is too small to print well. Its longest side must be at least ${MIN_DESIGN_EDGE_PX}px`,
      );
    }
    return new Design({ ...props, createdAt: new Date() });
  }

  static fromPersistence(props: DesignProps): Design {
    return new Design(props);
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get sourceKey(): string {
    return this.props.sourceKey;
  }

  get printKey(): string {
    return this.props.printKey;
  }

  get thumbnailKey(): string {
    return this.props.thumbnailKey;
  }

  get width(): number {
    return this.props.width;
  }

  get height(): number {
    return this.props.height;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  /** Every file this design owns, for cleanup. */
  fileKeys(): string[] {
    return [this.props.sourceKey, this.props.printKey, this.props.thumbnailKey];
  }
}
