import { Role } from '@/modules/users/domain/entities/user.entity';

export class UpdateUserRoleCommand {
  constructor(
    public readonly actingUserId: string,
    public readonly targetUserId: string,
    public readonly role: Role,
  ) {}
}
