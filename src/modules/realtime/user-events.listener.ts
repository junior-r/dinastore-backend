import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { UserDeactivatedEvent } from '../users/application/events/user-deactivated.event';
import { UserRegisteredEvent } from '../users/application/events/user-registered.event';
import { RealtimeGateway } from './realtime.gateway';

// Bridges Users' domain events to live socket pushes without RealtimeModule
// living inside the Users module -- Users only depends on CqrsModule's
// EventBus (already imported everywhere), never on Realtime directly.
@EventsHandler(UserRegisteredEvent)
export class UserRegisteredListener implements IEventHandler<UserRegisteredEvent> {
  constructor(private readonly gateway: RealtimeGateway) {}

  handle(event: UserRegisteredEvent): void {
    this.gateway.notifyUserRegistered(event.user);
  }
}

@EventsHandler(UserDeactivatedEvent)
export class UserDeactivatedListener implements IEventHandler<UserDeactivatedEvent> {
  constructor(private readonly gateway: RealtimeGateway) {}

  handle(event: UserDeactivatedEvent): void {
    this.gateway.notifyUserDeactivated(event.userId);
  }
}
