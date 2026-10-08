import { SetMetadata } from '@nestjs/common';
import { Permission } from '@/modules/users/domain/entities/permission';

export const PERMISSION_KEY = 'permission';
export const RequirePermission = (permission: Permission) =>
  SetMetadata(PERMISSION_KEY, permission);
