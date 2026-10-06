import { ConflictException, Inject } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { User } from '@/modules/users/domain/entities/user.entity';
import { PASSWORD_HASHER } from '@/modules/users/domain/services/password-hasher';
import type { PasswordHasher } from '@/modules/users/domain/services/password-hasher';
import { USER_REPOSITORY } from '@/modules/users/domain/repositories/user.repository';
import type { UserRepository } from '@/modules/users/domain/repositories/user.repository';
import { UserRegisteredEvent } from '@/modules/users/application/events/user-registered.event';
import { RegisterUserCommand } from './register-user.command';

@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler implements ICommandHandler<
  RegisterUserCommand,
  User
> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RegisterUserCommand): Promise<User> {
    const email = command.email.trim().toLowerCase();
    if (await this.userRepository.emailExists(email)) {
      throw new ConflictException(
        `A user with email "${email}" already exists`,
      );
    }

    const passwordHash = await this.passwordHasher.hash(command.plainPassword);
    const user = User.create({ email, passwordHash, name: command.name });

    const created = await this.userRepository.create(user);
    this.eventBus.publish(new UserRegisteredEvent(created));
    return created;
  }
}
