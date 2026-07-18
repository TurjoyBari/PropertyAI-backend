import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { Roles, Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { IsEnum } from 'class-validator';
import { UserRole } from '../common/enums';
import { AdminUsersService } from './admin-users.service';

class UpdateRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}

@Controller('api/admin')
export class AdminController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get('users')
  @Roles([UserRole.ADMIN])
  listUsers() {
    return this.adminUsersService.listUsers();
  }

  @Patch('users/:id/role')
  @Roles([UserRole.ADMIN])
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @Session() session: UserSession,
  ) {
    const actorRole = (session.user as { role?: string }).role ?? UserRole.USER;
    return this.adminUsersService.updateRole(id, dto.role, actorRole);
  }
}
