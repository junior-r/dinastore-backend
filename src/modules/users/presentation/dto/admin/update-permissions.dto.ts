import { IsArray, IsEnum } from 'class-validator';
import { Permission } from '@/modules/users/domain/entities/permission';

export class UpdatePermissionsDto {
  @IsArray()
  @IsEnum(Permission, { each: true })
  permissions!: Permission[];
}
