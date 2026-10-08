import { User } from '@/modules/users/domain/entities/user.entity';

export class UserResponseDto {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  // Only meaningful for STAFF (empty for CUSTOMER/ADMIN) -- lets the
  // frontend gate individual /admin pages without a separate API call.
  permissions: string[];
  // Needed by the admin users list/detail views to render status and gate
  // the deactivate/activate action; harmless to expose on /auth/me too.
  isActive: boolean;
  createdAt: Date;

  static fromDomain(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.name = user.name;
    dto.avatarUrl = user.avatarUrl;
    dto.role = user.role;
    dto.permissions = user.permissions;
    dto.isActive = user.isActive;
    dto.createdAt = user.createdAt;
    return dto;
  }
}
