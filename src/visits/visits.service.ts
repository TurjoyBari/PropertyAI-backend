import {
  BadRequestException,
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
import { LeadStatus, VisitStatus } from '../common/enums';

type VisitFilter = {
  isActive: boolean;
  status?: VisitStatus;
  lead?: Types.ObjectId;
  property?: Types.ObjectId;
  assignedAgent?: Types.ObjectId;
  scheduledAt?: { $gte?: Date; $lte?: Date };
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

    return this.findOne(visit.id);
  }

  async findAll(query: QueryVisitsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 100;
    const skip = (page - 1) * limit;

    const filter: VisitFilter = { isActive: true };

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
      filter.scheduledAt = {};
      if (query.from) filter.scheduledAt.$gte = new Date(query.from);
      if (query.to) filter.scheduledAt.$lte = new Date(query.to);
    }

    const [items, total] = await Promise.all([
      this.visitModel
        .find(filter as never)
        .populate('lead', 'fullName email phone status')
        .populate('property', 'title location price currency type')
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

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Visit not found');
    }

    const visit = await this.visitModel
      .findOne({ _id: id, isActive: true })
      .populate('lead', 'fullName email phone status')
      .populate('property', 'title location price currency type')
      .lean()
      .exec();

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }

    return visit;
  }

  async update(id: string, dto: UpdateVisitDto) {
    const visit = await this.findActiveDocument(id);

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

    if (visit.status === VisitStatus.SCHEDULED) {
      await this.bumpLeadToVisitScheduled(visit.lead);
    }

    return this.findOne(visit.id);
  }

  async remove(id: string) {
    const visit = await this.findActiveDocument(id);
    visit.isActive = false;
    visit.status = VisitStatus.CANCELLED;
    await visit.save();
    return { id: visit.id, deleted: true };
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
