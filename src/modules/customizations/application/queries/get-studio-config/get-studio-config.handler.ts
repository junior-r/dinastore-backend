import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  ACCEPTED_DESIGN_TYPES,
  LOGO_RULE,
  MAX_DESIGN_BYTES,
  MIN_DESIGN_EDGE_PX,
} from '@/modules/customizations/domain/design-policy';
import { STORE_LOGO_PORT } from '@/modules/customizations/domain/ports/store-logo.port';
import type { StoreLogoPort } from '@/modules/customizations/domain/ports/store-logo.port';
import { GetStudioConfigQuery } from './get-studio-config.query';

/**
 * Everything the studio needs to preview a design the way the server will
 * render it, and to refuse a file early that the server would refuse anyway.
 * Served rather than duplicated in the frontend so the two cannot drift.
 */
export interface StudioConfig {
  logo: {
    url: string;
    width: number;
    height: number;
    widthRatio: number;
    maxHeightRatio: number;
    marginRatio: number;
  };
  upload: {
    maxBytes: number;
    acceptedTypes: string[];
    minEdgePx: number;
  };
}

@QueryHandler(GetStudioConfigQuery)
export class GetStudioConfigHandler implements IQueryHandler<
  GetStudioConfigQuery,
  StudioConfig
> {
  constructor(
    @Inject(STORE_LOGO_PORT) private readonly storeLogo: StoreLogoPort,
  ) {}

  async execute(): Promise<StudioConfig> {
    const logo = await this.storeLogo.get();
    return {
      logo: {
        url: logo.url,
        width: logo.width,
        height: logo.height,
        ...LOGO_RULE,
      },
      upload: {
        maxBytes: MAX_DESIGN_BYTES,
        acceptedTypes: ACCEPTED_DESIGN_TYPES,
        minEdgePx: MIN_DESIGN_EDGE_PX,
      },
    };
  }
}
