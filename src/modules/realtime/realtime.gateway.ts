import { Inject, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { ENV_DEFAULTS } from '@/shared/infrastructure/config/env';
import { Role, User } from '../users/domain/entities/user.entity';
import { Permission } from '../users/domain/entities/permission';
import { USER_REPOSITORY } from '../users/domain/repositories/user.repository';
import type { UserRepository } from '../users/domain/repositories/user.repository';
import type { TokenPayload } from '../users/domain/services/token-service';
import { UserResponseDto } from '../users/presentation/dto/user-response.dto';

function userRoom(userId: string): string {
  return `user:${userId}`;
}

// Any socket whose owner can see the admin users list joins this room, so
// DeactivateUserHandler/RegisterUserHandler's events reach exactly the
// clients allowed to know about them.
const ADMINS_USERS_ROOM = 'admins:users';

@WebSocketGateway({
  cors: {
    // A function, so the allowed origin is read per connection. As a plain
    // value here it was evaluated when this file was first imported, which
    // is before ConfigModule has loaded the .env file: a FRONTEND_URL set
    // only in .env was silently ignored and the default used instead.
    origin: (
      _origin: string | undefined,
      callback: (error: Error | null, origin: string) => void,
    ) => callback(null, process.env.FRONTEND_URL ?? ENV_DEFAULTS.FRONTEND_URL),
  },
  namespace: '/realtime',
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      const payload = await this.jwtService.verifyAsync<TokenPayload>(token);
      const user = await this.userRepository.findById(payload.sub);
      if (!user || !user.isActive) {
        client.disconnect(true);
        return;
      }

      await client.join(userRoom(user.id));
      if (this.canViewUsers(user)) {
        await client.join(ADMINS_USERS_ROOM);
      }
    } catch (error) {
      this.logger.debug(
        `Rejected socket handshake: ${(error as Error).message}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(): void {
    // No per-connection state is tracked outside socket.io's own rooms, so
    // there's nothing to clean up here.
  }

  private canViewUsers(user: User): boolean {
    return (
      user.role === Role.ADMIN ||
      user.permissions.includes(Permission.USERS_VIEW)
    );
  }

  private extractToken(client: Socket): string {
    const fromAuth = client.handshake.auth?.token as string | undefined;
    if (fromAuth) {
      return fromAuth;
    }
    const header = client.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      return header.slice('Bearer '.length);
    }
    throw new Error('No token provided');
  }

  notifyUserDeactivated(userId: string): void {
    this.server.to(userRoom(userId)).emit('user.deactivated', {
      message: 'Your account has been deactivated by an administrator.',
      supportUrl: '/support',
    });
  }

  notifyUserRegistered(user: User): void {
    this.server
      .to(ADMINS_USERS_ROOM)
      .emit('user.registered', UserResponseDto.fromDomain(user));
  }
}
