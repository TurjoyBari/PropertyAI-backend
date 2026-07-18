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
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { UserRole } from '../common/enums';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { QueryPropertiesDto } from './dto/query-properties.dto';

@Controller('api/properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  findAll(@Query() query: QueryPropertiesDto) {
    return this.propertiesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.propertiesService.findOne(id);
  }

  @Post()
  create(
    @Body() dto: CreatePropertyDto,
    @Session() session: UserSession,
  ) {
    return this.propertiesService.create(dto, session.user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
    @Session() session: UserSession,
  ) {
    const role = (session.user as { role?: string }).role ?? UserRole.USER;
    return this.propertiesService.update(id, dto, session.user.id, role);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Session() session: UserSession) {
    const role = (session.user as { role?: string }).role ?? UserRole.USER;
    return this.propertiesService.remove(id, session.user.id, role);
  }
}
