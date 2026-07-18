import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lead, LeadDocument } from './schemas/lead.schema';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { AddLeadNoteDto } from './dto/add-lead-note.dto';
import {
  LeadSource,
  LeadStatus,
  LeadTemperature,
} from '../common/enums';

type LeadFilter = {
  isActive: boolean;
  status?: LeadStatus;
  source?: LeadSource;
  temperature?: LeadTemperature;
  preferredLocation?: RegExp;
  assignedAgent?: Types.ObjectId;
  $or?: Array<Record<string, RegExp>>;
};

@Injectable()
export class LeadsService {
  constructor(
    @InjectModel(Lead.name)
    private readonly leadModel: Model<LeadDocument>,
  ) {}

  async create(dto: CreateLeadDto) {
    const lead = await this.leadModel.create({
      ...dto,
      status: dto.status ?? LeadStatus.NEW_LEAD,
      source: dto.source ?? LeadSource.WEBSITE,
      temperature: dto.temperature ?? LeadTemperature.COLD,
      score: dto.score ?? 0,
      assignedAgent: this.toObjectId(dto.assignedAgent),
      interestedProperties: (dto.interestedProperties ?? [])
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id)),
      notes: [],
      isActive: true,
    });

    return lead.toObject();
  }

  async findAll(query: QueryLeadsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const skip = (page - 1) * limit;

    const filter: LeadFilter = { isActive: true };

    if (query.status) filter.status = query.status;
    if (query.source) filter.source = query.source;
    if (query.temperature) filter.temperature = query.temperature;
    if (query.preferredLocation?.trim()) {
      filter.preferredLocation = new RegExp(query.preferredLocation.trim(), 'i');
    }
    if (query.assignedAgent && Types.ObjectId.isValid(query.assignedAgent)) {
      filter.assignedAgent = new Types.ObjectId(query.assignedAgent);
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      filter.$or = [
        { fullName: new RegExp(term, 'i') },
        { email: new RegExp(term, 'i') },
        { phone: new RegExp(term, 'i') },
        { preferredLocation: new RegExp(term, 'i') },
      ];
    }

    const [items, total] = await Promise.all([
      this.leadModel
        .find(filter as never)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.leadModel.countDocuments(filter as never),
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
    const lead = await this.findActiveLean(id);
    return lead;
  }

  async update(id: string, dto: UpdateLeadDto) {
    const lead = await this.findActiveDocument(id);

    if (dto.assignedAgent !== undefined) {
      lead.assignedAgent = this.toObjectId(dto.assignedAgent);
    }

    if (dto.interestedProperties) {
      lead.interestedProperties = dto.interestedProperties
        .filter((item) => Types.ObjectId.isValid(item))
        .map((item) => new Types.ObjectId(item));
    }

    const {
      assignedAgent: _a,
      interestedProperties: _i,
      ...rest
    } = dto;

    Object.assign(lead, rest);
    await lead.save();
    return lead.toObject();
  }

  async remove(id: string) {
    const lead = await this.findActiveDocument(id);
    lead.isActive = false;
    await lead.save();
    return { id: lead.id, deleted: true };
  }

  async addNote(id: string, dto: AddLeadNoteDto, userId: string) {
    const lead = await this.findActiveDocument(id);
    lead.notes.push({
      body: dto.body,
      createdBy: this.toObjectId(userId),
      createdAt: new Date(),
    });
    await lead.save();
    return lead.toObject();
  }

  private async findActiveLean(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Lead not found');
    }

    const lead = await this.leadModel
      .findOne({ _id: id, isActive: true })
      .lean()
      .exec();

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return lead;
  }

  private async findActiveDocument(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Lead not found');
    }

    const lead = await this.leadModel.findOne({ _id: id, isActive: true });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return lead;
  }

  private toObjectId(value?: string) {
    if (!value || !Types.ObjectId.isValid(value)) return undefined;
    return new Types.ObjectId(value);
  }
}
