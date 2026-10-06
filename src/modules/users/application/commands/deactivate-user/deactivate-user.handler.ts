import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { DomainError } from '@/shared/domain/domain-error';
import { User } from '@/modules/users/domain/entities/user.entity';
import { USER_REPOSITORY } from '@/modules/users/domain/repositories/user.repository';
import type { UserRepository } from '@/modules/users/domain/repositories/user.repository';
import { UserDeactivatedEvent } from '@/modules/users/application/events/user-deactivated.event';
import { DeactivateUserCommand } from './deactivate-user.command';

@CommandHandler(DeactivateUserCommand)
export class DeactivateUserHandler implements ICommandHandler<
  DeactivateUserCommand,
  User
> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: DeactivateUserCommand): Promise<User> {
    // Prevents locking yourself out with no one else around to reactivate you.
    if (command.actingUserId === command.targetUserId) {
      throw new DomainError('You cannot deactivate your own account');
    }

    const user = await this.userRepository.findById(command.targetUserId);
    if (!user) {
      throw new NotFoundException(`User "${command.targetUserId}" not found`);
    }

    const updated = await this.userRepository.update(user.deactivate());
    this.eventBus.publish(new UserDeactivatedEvent(updated.id));
    return updated;
  }
}
