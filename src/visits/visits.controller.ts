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
import { VisitsService } from './visits.service';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';
import { QueryVisitsDto } from './dto/query-visits.dto';

@Controller('api/visits')
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Get()
  findAll(@Query() query: QueryVisitsDto) {
    return this.visitsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.visitsService.findOne(id);
  }

  @Post()
  @Roles([UserRole.ADMIN, UserRole.AGENT, UserRole.USER])
  create(@Body() dto: CreateVisitDto, @Session() session: UserSession) {
    return this.visitsService.create(dto, session.user.id);
  }

  @Patch(':id')
  @Roles([UserRole.ADMIN, UserRole.AGENT])
  update(@Param('id') id: string, @Body() dto: UpdateVisitDto) {
    return this.visitsService.update(id, dto);
  }

  @Delete(':id')
  @Roles([UserRole.ADMIN, UserRole.AGENT])
  remove(@Param('id') id: string) {
    return this.visitsService.remove(id);
  }
}
