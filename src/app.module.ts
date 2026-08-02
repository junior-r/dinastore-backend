import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CatalogModule } from './modules/catalog/catalog.module';
import { OrdersModule } from './modules/orders/orders.module';
import { UsersModule } from './modules/users/users.module';
import { CustomizationsModule } from './modules/customizations/customizations.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { AiAgentModule } from './modules/ai-agent/ai-agent.module';
import { RealtimeModule } from './modules/realtime/realtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CatalogModule,
    OrdersModule,
    UsersModule,
    CustomizationsModule,
    GamificationModule,
    AiAgentModule,
    RealtimeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
