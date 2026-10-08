import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CommentsModule } from './modules/comments/comments.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { UsersModule } from './modules/users/users.module';
import { CustomizationsModule } from './modules/customizations/customizations.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { AiAgentModule } from './modules/ai-agent/ai-agent.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { validateEnv } from './shared/infrastructure/config/env';
import { DomainErrorFilter } from './shared/infrastructure/filters/domain-error.filter';
import { PrismaExceptionFilter } from './shared/infrastructure/filters/prisma-exception.filter';
import { RequestLoggerMiddleware } from './shared/infrastructure/middleware/request-logger.middleware';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module';
import { StorageModule } from './shared/infrastructure/storage/storage.module';

@Module({
  imports: [
    // `validate` checks the environment once at boot and fills in defaults
    // (see shared/infrastructure/config/env.ts), so a missing DATABASE_URL
    // or a malformed URL stops the app with a message that names it.
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    StorageModule,
    CatalogModule,
    CommentsModule,
    ReviewsModule,
    OrdersModule,
    UsersModule,
    CustomizationsModule,
    GamificationModule,
    AiAgentModule,
    RealtimeModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
    { provide: APP_FILTER, useClass: DomainErrorFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
