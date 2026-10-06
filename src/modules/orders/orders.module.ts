import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PassportModule } from '@nestjs/passport';
import { PlaceOrderHandler } from './application/commands/place-order/place-order.handler';
import { PayOrderHandler } from './application/commands/pay-order/pay-order.handler';
import { GetCustomizedOrderItemsHandler } from './application/queries/get-customized-order-items/get-customized-order-items.handler';
import { GetMyOrdersHandler } from './application/queries/get-my-orders/get-my-orders.handler';
import { GetOrderByIdHandler } from './application/queries/get-order-by-id/get-order-by-id.handler';
import { ORDER_REPOSITORY } from './domain/repositories/order.repository';
import { DESIGN_LOOKUP_PORT } from './domain/repositories/design-lookup.port';
import { PRODUCT_CATALOG_PORT } from './domain/repositories/product-catalog.port';
import { PrismaDesignLookupAdapter } from './infrastructure/repositories/prisma-design-lookup.adapter';
import { PrismaOrderRepository } from './infrastructure/repositories/prisma-order.repository';
import { PrismaProductCatalogAdapter } from './infrastructure/repositories/prisma-product-catalog.adapter';
import { UsersModule } from '../users/users.module';
import { AdminOrdersController } from './presentation/controllers/admin/admin-orders.controller';
import { OrdersController } from './presentation/controllers/orders.controller';

const commandHandlers = [PlaceOrderHandler, PayOrderHandler];
const queryHandlers = [
  GetMyOrdersHandler,
  GetOrderByIdHandler,
  GetCustomizedOrderItemsHandler,
];

@Module({
  // UsersModule because PermissionsGuard (on the admin controller) needs
  // USER_REPOSITORY. FILE_STORAGE comes from the global StorageModule.
  imports: [CqrsModule, PassportModule, UsersModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    { provide: ORDER_REPOSITORY, useClass: PrismaOrderRepository },
    { provide: PRODUCT_CATALOG_PORT, useClass: PrismaProductCatalogAdapter },
    { provide: DESIGN_LOOKUP_PORT, useClass: PrismaDesignLookupAdapter },
  ],
})
export class OrdersModule {}
