import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ActivateUserCommand } from '@/modules/users/application/commands/activate-user/activate-user.command';
import { DeactivateUserCommand } from '@/modules/users/application/commands/deactivate-user/deactivate-user.command';
import { UpdateUserPermissionsCommand } from '@/modules/users/application/commands/update-user-permissions/update-user-permissions.command';
import { UpdateUserRoleCommand } from '@/modules/users/application/commands/update-user-role/update-user-role.command';
import { GetUserDetailQuery } from '@/modules/users/application/queries/get-user-detail/get-user-detail.query';
import { PaginatedUsers } from '@/modules/users/application/queries/get-users/get-users.handler';
import { GetUsersQuery } from '@/modules/users/application/queries/get-users/get-users.query';
import { Permission } from '@/modules/users/domain/entities/permission';
import { Role, User } from '@/modules/users/domain/entities/user.entity';
import type { UserDetail } from '@/modules/users/domain/repositories/user.repository';
import type { TokenPayload } from '@/modules/users/domain/services/token-service';
import { JwtAuthGuard } from '@/modules/users/infrastructure/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/users/infrastructure/auth/permissions.guard';
import { RolesGuard } from '@/modules/users/infrastructure/auth/roles.guard';
import { CurrentUser } from '@/modules/users/presentation/decorators/current-user.decorator';
import { RequirePermission } from '@/modules/users/presentation/decorators/require-permission.decorator';
import { Roles } from '@/modules/users/presentation/decorators/roles.decorator';
import { ListUsersDto } from '@/modules/users/presentation/dto/admin/list-users.dto';
import { UpdatePermissionsDto } from '@/modules/users/presentation/dto/admin/update-permissions.dto';
import { UpdateRoleDto } from '@/modules/users/presentation/dto/admin/update-role.dto';
import { UserDetailResponseDto } from '@/modules/users/presentation/dto/admin/user-detail-response.dto';
import { UserResponseDto } from '@/modules/users/presentation/dto/user-response.dto';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.STAFF)
export class AdminUsersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @RequirePermission(Permission.USERS_VIEW)
  async list(@Query() query: ListUsersDto) {
    const result = await this.queryBus.execute<GetUsersQuery, PaginatedUsers>(
      new GetUsersQuery(query.search, query.page, query.pageSize),
    );

    return {
      items: result.items.map((user) => UserResponseDto.fromDomain(user)),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }

  @Get(':id')
  @RequirePermission(Permission.USERS_VIEW)
  async detail(@Param('id') id: string) {
    const detail = await this.queryBus.execute<GetUserDetailQuery, UserDetail>(
      new GetUserDetailQuery(id),
    );
    return UserDetailResponseDto.fromDetail(detail);
  }

  // Role/permission changes are ADMIN-only regardless of USERS_MANAGE --
  // overrides the class-level @Roles so STAFF can never self-escalate via a
  // USERS_MANAGE grant (see update-user-role.handler.ts / RolesGuard).
  @Patch(':id/role')
  @Roles(Role.ADMIN)
  async updateRole(
    @CurrentUser() currentUser: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    const user = await this.commandBus.execute<UpdateUserRoleCommand, User>(
      new UpdateUserRoleCommand(currentUser.sub, id, dto.role),
    );
    return UserResponseDto.fromDomain(user);
  }

  @Patch(':id/permissions')
  @Roles(Role.ADMIN)
  async updatePermissions(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionsDto,
  ) {
    const user = await this.commandBus.execute<
      UpdateUserPermissionsCommand,
      User
    >(new UpdateUserPermissionsCommand(id, dto.permissions));
    return UserResponseDto.fromDomain(user);
  }

  @Patch(':id/deactivate')
  @RequirePermission(Permission.USERS_MANAGE)
  async deactivate(
    @CurrentUser() currentUser: TokenPayload,
    @Param('id') id: string,
  ) {
    const user = await this.commandBus.execute<DeactivateUserCommand, User>(
      new DeactivateUserCommand(currentUser.sub, id),
    );
    return UserResponseDto.fromDomain(user);
  }

  @Patch(':id/activate')
  @RequirePermission(Permission.USERS_MANAGE)
  async activate(@Param('id') id: string) {
    const user = await this.commandBus.execute<ActivateUserCommand, User>(
      new ActivateUserCommand(id),
    );
    return UserResponseDto.fromDomain(user);
  }
}
