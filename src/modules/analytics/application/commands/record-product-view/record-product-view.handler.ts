import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ProductView } from '@/modules/analytics/domain/entities/product-view.entity';
import { COUNTRY_RESOLVER_PORT } from '@/modules/analytics/domain/ports/country-resolver.port';
import type { CountryResolverPort } from '@/modules/analytics/domain/ports/country-resolver.port';
import { VIEWED_PRODUCT_PORT } from '@/modules/analytics/domain/ports/viewed-product.port';
import type { ViewedProductPort } from '@/modules/analytics/domain/ports/viewed-product.port';
import { PRODUCT_VIEW_REPOSITORY } from '@/modules/analytics/domain/repositories/product-view.repository';
import type { ProductViewRepository } from '@/modules/analytics/domain/repositories/product-view.repository';
import { RecordProductViewCommand } from './record-product-view.command';

/**
 * Handles every report a product page sends: the first one opens the row,
 * the rest top it up. One command for both, because the browser can't know
 * which of its requests will land first (the opening report and an early
 * heartbeat can cross), and a single idempotent "this is where the visit
 * stands now" is correct in either order.
 */
@CommandHandler(RecordProductViewCommand)
export class RecordProductViewHandler implements ICommandHandler<
  RecordProductViewCommand,
  void
> {
  constructor(
    @Inject(PRODUCT_VIEW_REPOSITORY)
    private readonly viewRepository: ProductViewRepository,
    @Inject(VIEWED_PRODUCT_PORT)
    private readonly products: ViewedProductPort,
    @Inject(COUNTRY_RESOLVER_PORT)
    private readonly countryResolver: CountryResolverPort,
  ) {}

  async execute(command: RecordProductViewCommand): Promise<void> {
    const existing = await this.viewRepository.findById(command.viewId);

    if (existing) {
      // A view id is only valid in the hands of the browser that opened it,
      // for the product it was opened on. Anything else is answered exactly
      // like an id that doesn't exist, so the endpoint can't be used to find
      // out which ids are real, let alone to edit someone else's row.
      if (
        existing.visitorId !== command.visitorId ||
        existing.productId !== command.productId
      ) {
        throw new NotFoundException(`View "${command.viewId}" not found`);
      }

      await this.viewRepository.save(
        existing.progress({
          durationMs: command.durationMs,
          favorited: command.favorited,
          userId: command.userId,
        }),
      );
      return;
    }

    const productName = await this.products.findName(command.productId);
    if (productName === null) {
      throw new NotFoundException(`Product "${command.productId}" not found`);
    }

    await this.viewRepository.save(
      ProductView.start({
        id: command.viewId,
        productId: command.productId,
        productName,
        userId: command.userId,
        visitorId: command.visitorId,
        ipAddress: command.ipAddress,
        // Resolved once, when the visit opens. The address is fixed for the
        // row from here on, so there is nothing to re-resolve on a top-up.
        country:
          command.countryHint ??
          this.countryResolver.resolve(command.ipAddress),
        durationMs: command.durationMs,
        favorited: command.favorited,
      }),
    );
  }
}
