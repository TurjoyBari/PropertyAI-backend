import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Visit, VisitDocument } from './schemas/visit.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';
import { QueryVisitsDto } from './dto/query-visits.dto';
import { LeadSource, LeadStatus, UserRole, VisitStatus } from '../common/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { CustomerBookVisitDto } from './dto/customer-book-visit.dto';

export type VisitActor = {
  id: string;
  role: string;
  email?: string | null;
  name?: string | null;
};

@Injectable()
export class VisitsService {
  constructor(
    @InjectModel(Visit.name)
    private readonly visitModel: Model<VisitDocument>,
    @InjectModel(Lead.name)
    private readonly leadModel: Model<LeadDocument>,
    @InjectModel(Property.name)
    private readonly propertyModel: Model<PropertyDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateVisitDto, userId: string) {
    const leadId = this.requireObjectId(dto.leadId, 'Lead');
    const propertyId = this.requireObjectId(dto.propertyId, 'Property');

    await this.assertLeadExists(leadId);
    await this.assertPropertyExists(propertyId);

    const status = dto.status ?? VisitStatus.SCHEDULED;
    const visit = await this.visitModel.create({
      lead: leadId,
      property: propertyId,
      scheduledAt: new Date(dto.scheduledAt),
      durationMinutes: dto.durationMinutes ?? 60,
      status,
      assignedAgent: this.toObjectId(dto.assignedAgent),
      locationNote: dto.locationNote,
      notes: dto.notes,
      createdBy: this.toObjectId(userId),
      isActive: true,
    });

    if (status === VisitStatus.SCHEDULED) {
      await this.bumpLeadToVisitScheduled(leadId);
    }

    await this.notificationsService.notifyInApp({
      userId,
      title: 'Site visit scheduled',
      body: `Visit booked for ${new Date(dto.scheduledAt).toLocaleString()}`,
    });

    return this.findByIdPopulated(visit.id);
  }

  /** Customer self-booking: find/create lead from session user, then schedule visit. */
  async bookForCustomer(dto: CustomerBookVisitDto, user: VisitActor) {
    const email = user.email?.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Your account needs an email to book a visit');
    }

    const propertyId = this.requireObjectId(dto.propertyId, 'Property');
    await this.assertPropertyExists(propertyId);

    let lead = await this.leadModel.findOne({
      email,
      isActive: true,
    });

    if (!lead) {
      lead = await this.leadModel.create({
        fullName: user.name?.trim() || email.split('@')[0],
        email,
        status: LeadStatus.NEW_LEAD,
        source: LeadSource.WEBSITE,
        interestedProperties: [propertyId],
        notes: [],
        isActive: true,
      });
    } else {
      const already = lead.interestedProperties?.some(
        (id) => String(id) === String(propertyId),
      );
      if (!already) {
        lead.interestedProperties = [
          ...(lead.interestedProperties ?? []),
          propertyId,
        ];
        await lead.save();
      }
    }

    return this.create(
      {
        leadId: String(lead._id),
        propertyId: dto.propertyId,
        scheduledAt: dto.scheduledAt,
        durationMinutes: dto.durationMinutes,
        locationNote: dto.locationNote,
        notes: dto.notes,
        status: VisitStatus.SCHEDULED,
      },
      user.id,
    );
  }

  async findAll(query: QueryVisitsDto, actor: VisitActor) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 100;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { isActive: true };

    if (query.status) filter.status = query.status;
    if (query.leadId && Types.ObjectId.isValid(query.leadId)) {
      filter.lead = new Types.ObjectId(query.leadId);
    }
    if (query.propertyId && Types.ObjectId.isValid(query.propertyId)) {
      filter.property = new Types.ObjectId(query.propertyId);
    }
    if (query.assignedAgent && Types.ObjectId.isValid(query.assignedAgent)) {
      filter.assignedAgent = new Types.ObjectId(query.assignedAgent);
    }

    if (query.from || query.to) {
      const scheduledAt: { $gte?: Date; $lte?: Date } = {};
      if (query.from) scheduledAt.$gte = new Date(query.from);
      if (query.to) scheduledAt.$lte = new Date(query.to);
      filter.scheduledAt = scheduledAt;
    }

    Object.assign(filter, await this.scopeFilter(actor));

    const [items, total] = await Promise.all([
      this.visitModel
        .find(filter as never)
        .populate('lead', 'fullName email phone status')
        .populate('property', 'title location price currency type images')
        .populate('assignedAgent', 'name email phone')
        .sort({ scheduledAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.visitModel.countDocuments(filter as never),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(id: string, actor: VisitActor) {
    const visit = await this.findOnePopulated(id);
    this.assertCanAccess(visit, actor);
    return visit;
  }

  async update(id: string, dto: UpdateVisitDto, actor: VisitActor) {
    const visit = await this.findActiveDocument(id);
    const populated = await this.findOnePopulated(id);
    this.assertCanAccess(populated, actor);

    const isCustomer = actor.role === UserRole.USER;

    if (isCustomer) {
      // Customers may only reschedule details or cancel — not reassign ownership.
      if (dto.leadId !== undefined || dto.propertyId !== undefined) {
        throw new ForbiddenException('You cannot change the property or lead');
      }
      if (dto.assignedAgent !== undefined) {
        throw new ForbiddenException('You cannot assign an agent');
      }
      if (dto.status !== undefined && dto.status !== VisitStatus.CANCELLED) {
        throw new ForbiddenException('You can only cancel your visit');
      }
    }

    if (dto.leadId !== undefined) {
      const leadId = this.requireObjectId(dto.leadId, 'Lead');
      await this.assertLeadExists(leadId);
      visit.lead = leadId;
    }

    if (dto.propertyId !== undefined) {
      const propertyId = this.requireObjectId(dto.propertyId, 'Property');
      await this.assertPropertyExists(propertyId);
      visit.property = propertyId;
    }

    if (dto.scheduledAt !== undefined) {
      visit.scheduledAt = new Date(dto.scheduledAt);
    }

    if (dto.durationMinutes !== undefined) {
      visit.durationMinutes = dto.durationMinutes;
    }

    if (dto.status !== undefined) {
      visit.status = dto.status;
      if (dto.status === VisitStatus.CANCELLED) {
        visit.isActive = false;
      }
    }

    if (dto.assignedAgent !== undefined) {
      visit.assignedAgent = this.toObjectId(dto.assignedAgent);
    }

    if (dto.locationNote !== undefined) {
      visit.locationNote = dto.locationNote;
    }

    if (dto.notes !== undefined) {
      visit.notes = dto.notes;
    }

    await visit.save();

    if (visit.status === VisitStatus.SCHEDULED && visit.isActive) {
      await this.bumpLeadToVisitScheduled(visit.lead);
    }

    return this.findByIdPopulated(visit.id);
  }

  async remove(id: string, actor: VisitActor) {
    const populated = await this.findOnePopulated(id);
    this.assertCanAccess(populated, actor);

    const visit = await this.findActiveDocument(id);
    visit.isActive = false;
    visit.status = VisitStatus.CANCELLED;
    await visit.save();
    return { id: visit.id, deleted: true };
  }

  private async scopeFilter(actor: VisitActor): Promise<Record<string, unknown>> {
    if (actor.role === UserRole.ADMIN) {
      return {};
    }

    if (actor.role === UserRole.AGENT) {
      if (!Types.ObjectId.isValid(actor.id)) {
        return { _id: { $exists: false } };
      }
      return { assignedAgent: new Types.ObjectId(actor.id) };
    }

    // Customers: visits they booked, or visits tied to their lead email.
    const clauses: Record<string, unknown>[] = [];
    if (Types.ObjectId.isValid(actor.id)) {
      clauses.push({ createdBy: new Types.ObjectId(actor.id) });
    }

    const email = actor.email?.trim().toLowerCase();
    if (email) {
      const leadIds = await this.leadModel
        .find({ email, isActive: true })
        .distinct('_id')
        .exec();
      if (leadIds.length > 0) {
        clauses.push({ lead: { $in: leadIds } });
      }
    }

    if (clauses.length === 0) {
      return { _id: { $exists: false } };
    }

    return { $or: clauses };
  }

  private assertCanAccess(
    visit: {
      createdBy?: Types.ObjectId | string | null;
      assignedAgent?:
        | Types.ObjectId
        | string
        | { _id?: Types.ObjectId | string }
        | null;
      lead?:
        | Types.ObjectId
        | string
        | { email?: string }
        | null;
    },
    actor: VisitActor,
  ) {
    if (actor.role === UserRole.ADMIN) return;

    if (actor.role === UserRole.AGENT) {
      const agentId = this.refId(visit.assignedAgent);
      if (agentId && agentId === actor.id) return;
      throw new ForbiddenException('You cannot access this visit');
    }

    // Customer ownership: createdBy or matching lead email.
    const ownerId = this.refId(visit.createdBy);
    if (ownerId && ownerId === actor.id) return;

    const leadEmail =
      visit.lead && typeof visit.lead === 'object' && 'email' in visit.lead
        ? visit.lead.email?.trim().toLowerCase()
        : undefined;
    const actorEmail = actor.email?.trim().toLowerCase();
    if (leadEmail && actorEmail && leadEmail === actorEmail) return;

    throw new ForbiddenException('You cannot access this visit');
  }

  private refId(
    value?:
      | Types.ObjectId
      | string
      | { _id?: Types.ObjectId | string }
      | null,
  ) {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (value instanceof Types.ObjectId) return String(value);
    if (typeof value === 'object' && value._id) return String(value._id);
    return null;
  }

  private async findOnePopulated(id: string) {
    const visit = await this.findByIdPopulated(id);
    if (!visit.isActive) {
      throw new NotFoundException('Visit not found');
    }
    return visit;
  }

  private async findByIdPopulated(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Visit not found');
    }

    const visit = await this.visitModel
      .findById(id)
      .populate('lead', 'fullName email phone status')
      .populate('property', 'title location price currency type images')
      .populate('assignedAgent', 'name email phone')
      .lean()
      .exec();

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }

    return visit;
  }

  private async bumpLeadToVisitScheduled(leadId: Types.ObjectId) {
    const lead = await this.leadModel.findOne({ _id: leadId, isActive: true });
    if (!lead) return;

    // Don't pull leads backward from late-pipeline stages.
    if (
      lead.status === LeadStatus.NEGOTIATION ||
      lead.status === LeadStatus.CLOSED ||
      lead.status === LeadStatus.VISIT_SCHEDULED
    ) {
      return;
    }

    lead.status = LeadStatus.VISIT_SCHEDULED;
    await lead.save();
  }

  private async assertLeadExists(id: Types.ObjectId) {
    const exists = await this.leadModel.exists({ _id: id, isActive: true });
    if (!exists) throw new NotFoundException('Lead not found');
  }

  private async assertPropertyExists(id: Types.ObjectId) {
    const exists = await this.propertyModel.exists({ _id: id, isActive: true });
    if (!exists) throw new NotFoundException('Property not found');
  }

  private async findActiveDocument(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Visit not found');
    }

    const visit = await this.visitModel.findOne({ _id: id, isActive: true });
    if (!visit) {
      throw new NotFoundException('Visit not found');
    }

    return visit;
  }

  private requireObjectId(value: string, label: string) {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`Invalid ${label} id`);
    }
    return new Types.ObjectId(value);
  }

  private toObjectId(value?: string) {
    if (!value || !Types.ObjectId.isValid(value)) return undefined;
    return new Types.ObjectId(value);
  }
}
