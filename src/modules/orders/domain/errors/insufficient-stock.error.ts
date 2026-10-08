import { DomainError } from '@/shared/domain/domain-error';

export class InsufficientStockError extends DomainError {
  constructor(public readonly productVariantId: string) {
    super(`Not enough stock for variant "${productVariantId}"`);
    this.name = 'InsufficientStockError';
  }
}
