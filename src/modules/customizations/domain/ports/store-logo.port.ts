export const STORE_LOGO_PORT = Symbol('STORE_LOGO_PORT');

export interface StoreLogo {
  data: Buffer;
  width: number;
  height: number;
  /** Where the studio loads it from to draw the preview. */
  url: string;
}

/** The mark stamped on every design. One per deployment, swappable by config. */
export interface StoreLogoPort {
  get(): Promise<StoreLogo>;
}
