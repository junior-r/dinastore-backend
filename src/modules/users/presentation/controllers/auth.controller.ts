import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { LoginUserCommand } from '@/modules/users/application/commands/login-user/login-user.command';
import { LoginResult } from '@/modules/users/application/commands/login-user/login-user.handler';
import { RegisterUserCommand } from '@/modules/users/application/commands/register-user/register-user.command';
import { GetUserByIdQuery } from '@/modules/users/application/queries/get-user-by-id/get-user-by-id.query';
import { User } from '@/modules/users/domain/entities/user.entity';
import type { TokenPayload } from '@/modules/users/domain/services/token-service';
import { JwtAuthGuard } from '@/modules/users/infrastructure/auth/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { UserResponseDto } from '../dto/user-response.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    const user = await this.commandBus.execute<RegisterUserCommand, User>(
      new RegisterUserCommand(dto.email, dto.password, dto.name),
    );

    return UserResponseDto.fromDomain(user);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    const result = await this.commandBus.execute<LoginUserCommand, LoginResult>(
      new LoginUserCommand(dto.email, dto.password),
    );

    return AuthResponseDto.fromResult(result);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() currentUser: TokenPayload) {
    const user = await this.queryBus.execute<GetUserByIdQuery, User>(
      new GetUserByIdQuery(currentUser.sub),
    );

    return UserResponseDto.fromDomain(user);
  }
}
