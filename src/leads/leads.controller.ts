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
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { AddLeadNoteDto } from './dto/add-lead-note.dto';

@Controller('api/leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  findAll(@Query() query: QueryLeadsDto) {
    return this.leadsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.leadsService.findOne(id);
  }

  @Post()
  @Roles([UserRole.ADMIN, UserRole.AGENT])
  create(@Body() dto: CreateLeadDto) {
    return this.leadsService.create(dto);
  }

  @Patch(':id')
  @Roles([UserRole.ADMIN, UserRole.AGENT])
  update(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.leadsService.update(id, dto);
  }

  @Delete(':id')
  @Roles([UserRole.ADMIN, UserRole.AGENT])
  remove(@Param('id') id: string) {
    return this.leadsService.remove(id);
  }

  @Post(':id/notes')
  @Roles([UserRole.ADMIN, UserRole.AGENT])
  addNote(
    @Param('id') id: string,
    @Body() dto: AddLeadNoteDto,
    @Session() session: UserSession,
  ) {
    return this.leadsService.addNote(id, dto, session.user.id);
  }
}
