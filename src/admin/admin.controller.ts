import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { Roles, Session, type UserSession } from '@thallesp/nestjs-better-auth';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PropertyStatus, UserRole } from '../common/enums';
import { AdminUsersService } from './admin-users.service';
import { AdminPropertyInsightsService } from './admin-property-insights.service';

class UpdateRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}

class AdminPropertyMetaDto {
  @IsOptional()
  @IsString()
  adminNotes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  internalTags?: string[];

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  suggestedPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  finalPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  commissionPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  parking?: number;

  @IsOptional()
  @IsEnum(PropertyStatus)
  status?: PropertyStatus;

  @IsOptional()
  @IsString()
  action?:
    | 'approve'
    | 'reject'
    | 'suspend'
    | 'feature'
    | 'unfeature'
    | 'archive'
    | 'restore'
    | 'delete';
}

class SuspendAgentDto {
  @IsBoolean()
  banned: boolean;
}

@Controller('api/admin')
export class AdminController {
  constructor(
    private readonly adminUsersService: AdminUsersService,
    private readonly adminPropertyInsightsService: AdminPropertyInsightsService,
  ) {}

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

  @Get('properties/:id/insights')
  @Roles([UserRole.ADMIN])
  propertyInsights(
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    const role = (session.user as { role?: string }).role ?? UserRole.USER;
    return this.adminPropertyInsightsService.getInsights(id, role);
  }

  @Patch('properties/:id/meta')
  @Roles([UserRole.ADMIN])
  updatePropertyMeta(
    @Param('id') id: string,
    @Body() dto: AdminPropertyMetaDto,
    @Session() session: UserSession,
  ) {
    const role = (session.user as { role?: string }).role ?? UserRole.USER;
    return this.adminPropertyInsightsService.updateAdminMeta(
      id,
      {
        id: session.user.id,
        role,
        name: session.user.name || undefined,
      },
      dto,
    );
  }

  @Patch('users/:id/suspend')
  @Roles([UserRole.ADMIN])
  suspendUser(
    @Param('id') id: string,
    @Body() dto: SuspendAgentDto,
    @Session() session: UserSession,
  ) {
    const role = (session.user as { role?: string }).role ?? UserRole.USER;
    return this.adminPropertyInsightsService.suspendAgent(id, role, dto.banned);
  }
}
