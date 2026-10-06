import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { UsersModule } from '../users/users.module';
import { RealtimeGateway } from './realtime.gateway';
import {
  UserDeactivatedListener,
  UserRegisteredListener,
} from './user-events.listener';

@Module({
  imports: [CqrsModule, UsersModule],
  providers: [RealtimeGateway, UserRegisteredListener, UserDeactivatedListener],
})
export class RealtimeModule {}
