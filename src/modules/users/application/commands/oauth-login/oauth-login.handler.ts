import { Inject, UnauthorizedException } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { User } from '@/modules/users/domain/entities/user.entity';
import { USER_REPOSITORY } from '@/modules/users/domain/repositories/user.repository';
import type { UserRepository } from '@/modules/users/domain/repositories/user.repository';
import { TOKEN_SERVICE } from '@/modules/users/domain/services/token-service';
import type { TokenService } from '@/modules/users/domain/services/token-service';
import { UserRegisteredEvent } from '@/modules/users/application/events/user-registered.event';
import { LoginResult } from '../login-user/login-user.handler';
import { OAuthLoginCommand } from './oauth-login.command';

@CommandHandler(OAuthLoginCommand)
export class OAuthLoginHandler implements ICommandHandler<
  OAuthLoginCommand,
  LoginResult
> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: OAuthLoginCommand): Promise<LoginResult> {
    const existing = await this.userRepository.findByProviderAccount(
      command.provider,
      command.providerAccountId,
    );
    if (existing) {
      // Backfills the avatar for accounts created before this field existed,
      // or before the provider had a photo to offer — a no-op otherwise.
      await this.userRepository.setAvatarUrlIfMissing(
        existing.id,
        command.avatarUrl,
      );
      return this.signIn(existing);
    }

    const email = command.email.trim().toLowerCase();
    const byEmail = await this.userRepository.findByEmail(email);
    if (byEmail) {
      await this.userRepository.linkOAuthAccount(
        byEmail.id,
        command.provider,
        command.providerAccountId,
      );
      await this.userRepository.setAvatarUrlIfMissing(
        byEmail.id,
        command.avatarUrl,
      );
      return this.signIn(byEmail);
    }

    const user = User.createFromOAuth({
      email,
      name: command.name,
      avatarUrl: command.avatarUrl,
    });
    const created = await this.userRepository.createFromOAuth(
      user,
      command.provider,
      command.providerAccountId,
    );
    this.eventBus.publish(new UserRegisteredEvent(created));
    return this.signIn(created);
  }

  private signIn(user: User): LoginResult {
    // Checked here so it covers every sign-in path uniformly (existing
    // provider account, link-by-email) -- brand-new accounts are always
    // active so this never fires on that branch.
    if (!user.isActive) {
      throw new UnauthorizedException('This account has been deactivated');
    }

    const accessToken = this.tokenService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return { accessToken, user };
  }
}
