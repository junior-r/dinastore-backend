import { IsEnum } from 'class-validator';
import { Role } from '@/modules/users/domain/entities/user.entity';

export class UpdateRoleDto {
  @IsEnum(Role)
  role!: Role;
}
