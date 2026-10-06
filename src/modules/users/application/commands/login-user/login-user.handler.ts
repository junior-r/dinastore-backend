import { Inject, UnauthorizedException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { User } from '@/modules/users/domain/entities/user.entity';
import { PASSWORD_HASHER } from '@/modules/users/domain/services/password-hasher';
import type { PasswordHasher } from '@/modules/users/domain/services/password-hasher';
import { USER_REPOSITORY } from '@/modules/users/domain/repositories/user.repository';
import type { UserRepository } from '@/modules/users/domain/repositories/user.repository';
import { TOKEN_SERVICE } from '@/modules/users/domain/services/token-service';
import type { TokenService } from '@/modules/users/domain/services/token-service';
import { LoginUserCommand } from './login-user.command';

export interface LoginResult {
  accessToken: string;
  user: User;
}

const INVALID_CREDENTIALS = 'Invalid email or password';
const ACCOUNT_DEACTIVATED = 'This account has been deactivated';

@CommandHandler(LoginUserCommand)
export class LoginUserHandler implements ICommandHandler<
  LoginUserCommand,
  LoginResult
> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
  ) {}

  async execute(command: LoginUserCommand): Promise<LoginResult> {
    const email = command.email.trim().toLowerCase();
    const user = await this.userRepository.findByEmail(email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const passwordMatches = await this.passwordHasher.compare(
      command.plainPassword,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    // Checked only after the password is confirmed correct, so a wrong
    // password always looks identical regardless of the account's active
    // status -- doesn't leak "this account exists and is deactivated" to
    // someone who doesn't actually own it.
    if (!user.isActive) {
      throw new UnauthorizedException(ACCOUNT_DEACTIVATED);
    }

    const accessToken = this.tokenService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return { accessToken, user };
  }
}
