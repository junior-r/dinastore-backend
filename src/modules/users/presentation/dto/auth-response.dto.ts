import { LoginResult } from '@/modules/users/application/commands/login-user/login-user.handler';
import { UserResponseDto } from './user-response.dto';

export class AuthResponseDto {
  accessToken: string;
  user: UserResponseDto;

  static fromResult(result: LoginResult): AuthResponseDto {
    const dto = new AuthResponseDto();
    dto.accessToken = result.accessToken;
    dto.user = UserResponseDto.fromDomain(result.user);
    return dto;
  }
}
