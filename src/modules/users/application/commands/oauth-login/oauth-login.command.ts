import { OAuthProvider } from '@/modules/users/domain/entities/user.entity';

export class OAuthLoginCommand {
  constructor(
    public readonly provider: OAuthProvider,
    public readonly providerAccountId: string,
    public readonly email: string,
    public readonly name: string,
    public readonly avatarUrl: string | null,
  ) {}
}
