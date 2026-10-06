import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandBus } from '@nestjs/cqrs';
import type { Request } from 'express';
import {
  normalizeIp,
  parseTrustProxy,
  readCountryHeader,
} from '@/shared/infrastructure/http/client-origin';
import { OptionalJwtAuthGuard } from '@/modules/users/infrastructure/auth/optional-jwt-auth.guard';
import { OptionalCurrentUser } from '@/modules/users/presentation/decorators/optional-current-user.decorator';
import type { TokenPayload } from '@/modules/users/domain/services/token-service';
import { RecordProductViewCommand } from '@/modules/analytics/application/commands/record-product-view/record-product-view.command';
import { RecordProductViewDto } from '../dto/record-product-view.dto';

// Cloudflare's country header. Other CDNs use other names; add them here if
// one of those ends up in front of this API.
const EDGE_COUNTRY_HEADER = 'cf-ipcountry';

@Controller('analytics/product-views')
export class ProductViewsController {
  // A header from the edge is only believed when the deployment has said
  // there *is* an edge (TRUST_PROXY). Reached directly, the same header is
  // just something the caller typed.
  private readonly trustEdgeHeaders: boolean;

  constructor(
    private readonly commandBus: CommandBus,
    configService: ConfigService,
  ) {
    this.trustEdgeHeaders =
      parseTrustProxy(configService.get<string>('TRUST_PROXY')) !== undefined;
  }

  // Public on purpose: most product views come from people who are not
  // signed in, and those are exactly the ones worth counting. The token is
  // read when present so the visit can be tied to the account.
  //
  // POST for both the first report and every later one (see
  // RecordProductViewHandler for why it is one idempotent operation), and
  // 204 because the page does nothing with a response: it is often already
  // being torn down when this is sent.
  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async record(
    @Body() dto: RecordProductViewDto,
    @OptionalCurrentUser() currentUser: TokenPayload | undefined,
    @Req() request: Request,
  ): Promise<void> {
    await this.commandBus.execute<RecordProductViewCommand, void>(
      new RecordProductViewCommand(
        dto.viewId,
        dto.productId,
        dto.visitorId,
        dto.durationMs,
        dto.favorited,
        currentUser?.sub ?? null,
        // `request.ip` already honours the `trust proxy` setting from
        // main.ts, so this is the client's address behind a configured
        // proxy and the socket's address otherwise.
        normalizeIp(request.ip),
        this.trustEdgeHeaders
          ? readCountryHeader(request.headers[EDGE_COUNTRY_HEADER])
          : null,
      ),
    );
  }
}
