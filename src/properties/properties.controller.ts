import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles, Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { UserRole } from '../common/enums';
import { PropertiesService, type PropertyActor } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { QueryPropertiesDto } from './dto/query-properties.dto';

@Controller('api/properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  @Roles([UserRole.ADMIN, UserRole.AGENT])
  findAll(
    @Query() query: QueryPropertiesDto,
    @Session() session: UserSession,
  ) {
    return this.propertiesService.findAll(query, this.toActor(session));
  }

  @Get(':id')
  @Roles([UserRole.ADMIN, UserRole.AGENT])
  findOne(@Param('id') id: string, @Session() session: UserSession) {
    return this.propertiesService.findOne(id, this.toActor(session));
  }

  @Post()
  @Roles([UserRole.ADMIN, UserRole.AGENT])
  create(
    @Body() dto: CreatePropertyDto,
    @Session() session: UserSession,
  ) {
    return this.propertiesService.create(dto, session.user.id);
  }

  @Patch(':id')
  @Roles([UserRole.ADMIN, UserRole.AGENT])
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
    @Session() session: UserSession,
  ) {
    const role = (session.user as { role?: string }).role ?? UserRole.USER;
    return this.propertiesService.update(id, dto, session.user.id, role);
  }

  @Delete(':id')
  @Roles([UserRole.ADMIN, UserRole.AGENT])
  remove(@Param('id') id: string, @Session() session: UserSession) {
    const role = (session.user as { role?: string }).role ?? UserRole.USER;
    return this.propertiesService.remove(id, session.user.id, role);
  }

  private toActor(session: UserSession): PropertyActor {
    return {
      id: session.user.id,
      role: (session.user as { role?: string }).role ?? UserRole.USER,
    };
  }
}
