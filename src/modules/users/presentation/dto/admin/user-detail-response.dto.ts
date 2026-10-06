import type { UserDetail } from '@/modules/users/domain/repositories/user.repository';
import { UserResponseDto } from '../user-response.dto';

export class OAuthAccountResponseDto {
  provider: string;
  providerAccountId: string;
  createdAt: Date;
}

export class UserDetailResponseDto extends UserResponseDto {
  hasPassword: boolean;
  oauthAccounts: OAuthAccountResponseDto[];

  static fromDetail(detail: UserDetail): UserDetailResponseDto {
    const dto = new UserDetailResponseDto();
    Object.assign(dto, UserResponseDto.fromDomain(detail.user));
    dto.hasPassword = detail.hasPassword;
    dto.oauthAccounts = detail.oauthAccounts.map((account) => ({
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      createdAt: account.createdAt,
    }));
    return dto;
  }
}
