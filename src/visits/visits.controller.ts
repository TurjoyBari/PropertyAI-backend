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
import { VisitsService, type VisitActor } from './visits.service';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';
import { QueryVisitsDto } from './dto/query-visits.dto';
import { CustomerBookVisitDto } from './dto/customer-book-visit.dto';

@Controller('api/visits')
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Get()
  findAll(@Query() query: QueryVisitsDto, @Session() session: UserSession) {
    return this.visitsService.findAll(query, this.toActor(session));
  }

  @Post('book')
  @Roles([UserRole.ADMIN, UserRole.AGENT, UserRole.USER])
  bookForCustomer(
    @Body() dto: CustomerBookVisitDto,
    @Session() session: UserSession,
  ) {
    return this.visitsService.bookForCustomer(dto, this.toActor(session));
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Session() session: UserSession) {
    return this.visitsService.findOne(id, this.toActor(session));
  }

  @Post()
  @Roles([UserRole.ADMIN, UserRole.AGENT, UserRole.USER])
  create(@Body() dto: CreateVisitDto, @Session() session: UserSession) {
    return this.visitsService.create(dto, session.user.id);
  }

  @Patch(':id')
  @Roles([UserRole.ADMIN, UserRole.AGENT, UserRole.USER])
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVisitDto,
    @Session() session: UserSession,
  ) {
    return this.visitsService.update(id, dto, this.toActor(session));
  }

  @Delete(':id')
  @Roles([UserRole.ADMIN, UserRole.AGENT, UserRole.USER])
  remove(@Param('id') id: string, @Session() session: UserSession) {
    return this.visitsService.remove(id, this.toActor(session));
  }

  private toActor(session: UserSession): VisitActor {
    const user = session.user as {
      id: string;
      role?: string;
      email?: string | null;
      name?: string | null;
    };
    return {
      id: user.id,
      role: user.role ?? UserRole.USER,
      email: user.email,
      name: user.name,
    };
  }
}
