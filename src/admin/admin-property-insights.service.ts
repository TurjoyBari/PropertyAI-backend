import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { Visit, VisitDocument } from '../visits/schemas/visit.schema';
import { Favorite, FavoriteDocument } from '../favorites/schemas/favorite.schema';
import { Message, MessageDocument } from '../messages/schemas/message.schema';
import {
  LeadStatus,
  PropertyStatus,
  UserRole,
  VisitStatus,
} from '../common/enums';

@Injectable()
export class AdminPropertyInsightsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Property.name)
    private readonly propertyModel: Model<PropertyDocument>,
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
    @InjectModel(Visit.name) private readonly visitModel: Model<VisitDocument>,
    @InjectModel(Favorite.name)
    private readonly favoriteModel: Model<FavoriteDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
  ) {}

  async getInsights(propertyId: string, actorRole: string) {
    if (actorRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin only');
    }
    if (!Types.ObjectId.isValid(propertyId)) {
      throw new NotFoundException('Property not found');
    }

    const property = (await this.propertyModel
      .findById(propertyId)
      .lean()
      .exec()) as
      | (Property & {
          _id: Types.ObjectId;
          createdAt?: Date;
          updatedAt?: Date;
        })
      | null;
    if (!property) throw new NotFoundException('Property not found');

    const pid = new Types.ObjectId(propertyId);
    const agentId = property.listedBy
      ? String(property.listedBy)
      : undefined;

    type VisitLean = {
      _id: Types.ObjectId;
      status: string;
      scheduledAt: Date;
      isActive?: boolean;
      assignedAgent?: Types.ObjectId;
      lead?:
        | string
        | {
            fullName?: string;
            email?: string;
            phone?: string;
            status?: string;
          };
    };

    type AuthUser = {
      _id: Types.ObjectId;
      name?: string;
      email?: string;
      image?: string | null;
      phone?: string | null;
      role?: string;
      emailVerified?: boolean;
      banned?: boolean;
      createdAt?: Date;
      updatedAt?: Date;
    };

    const [
      favoritesCount,
      visits,
      interestedLeads,
      messagesCount,
      agentUser,
      agentProps,
      related,
    ] = await Promise.all([
      this.favoriteModel.countDocuments({ property: pid }),
      this.visitModel
        .find({ property: pid })
        .populate('lead', 'fullName email phone status')
        .sort({ scheduledAt: -1 })
        .limit(50)
        .lean()
        .exec() as Promise<VisitLean[]>,
      this.leadModel
        .find({
          isActive: true,
          interestedProperties: pid,
        })
        .sort({ updatedAt: -1 })
        .limit(40)
        .lean()
        .exec(),
      this.messageModel.countDocuments({
        propertyId: pid,
        isActive: true,
      }),
      agentId && Types.ObjectId.isValid(agentId)
        ? (this.connection.collection('user').findOne({
            _id: new Types.ObjectId(agentId) as never,
          }) as Promise<AuthUser | null>)
        : Promise.resolve(null),
      agentId && Types.ObjectId.isValid(agentId)
        ? this.propertyModel
            .find({
              listedBy: new Types.ObjectId(agentId),
            })
            .select('status isActive')
            .lean()
            .exec()
        : Promise.resolve([]),
      this.propertyModel
        .find({
          _id: { $ne: pid },
          isActive: true,
          $or: [
            { type: property.type },
            { 'location.city': property.location?.city },
            { 'location.area': property.location?.area },
          ],
        })
        .sort({ createdAt: -1 })
        .limit(6)
        .select('title price currency type status location images bedrooms bathrooms areaSqFt')
        .lean()
        .exec(),
    ]);

    const upcomingVisits = visits.filter(
      (v) => v.status === VisitStatus.SCHEDULED && v.isActive !== false,
    );
    const completedVisits = visits.filter(
      (v) => v.status === VisitStatus.COMPLETED,
    );
    const cancelledVisits = visits.filter(
      (v) => v.status === VisitStatus.CANCELLED,
    );

    const activeListings = agentProps.filter(
      (p) => p.isActive && p.status === PropertyStatus.AVAILABLE,
    ).length;
    const pendingListings = agentProps.filter(
      (p) => p.isActive && p.status === PropertyStatus.DRAFT,
    ).length;
    const soldProperties = agentProps.filter(
      (p) => p.status === PropertyStatus.SOLD,
    ).length;
    const rentedProperties = agentProps.filter(
      (p) => p.status === PropertyStatus.RENTED,
    ).length;
    const cancelledListings = agentProps.filter((p) => !p.isActive).length;

    const avgLeadScore =
      interestedLeads.length > 0
        ? Math.round(
            interestedLeads.reduce((sum, l) => sum + (l.score || 0), 0) /
              interestedLeads.length,
          )
        : 0;

    const totalViewsEstimate = Math.max(
      favoritesCount * 12 + visits.length * 8 + interestedLeads.length * 5,
      favoritesCount + visits.length,
    );
    const uniqueVisitorsEstimate = Math.max(
      Math.round(totalViewsEstimate * 0.62),
      favoritesCount + interestedLeads.length,
    );
    const conversionRate =
      totalViewsEstimate > 0
        ? Math.round(
            ((visits.length + interestedLeads.length) / totalViewsEstimate) *
              1000,
          ) / 10
        : 0;

    const listingPrice = property.price ?? 0;
    const suggested =
      property.suggestedPrice ??
      Math.round(listingPrice * (favoritesCount > 5 ? 1.04 : 0.97));
    const commissionPercent = property.commissionPercent ?? 2.5;
    const finalPrice = property.finalPrice ?? listingPrice;
    const commission = Math.round((finalPrice * commissionPercent) / 100);
    const agentCommission = Math.round(commission * 0.6);
    const companyRevenue = commission - agentCommission;

    const demandScore = Math.min(
      100,
      favoritesCount * 8 +
        visits.length * 6 +
        interestedLeads.length * 10 +
        (property.featured ? 12 : 0),
    );
    const popularityScore = Math.min(100, Math.round(demandScore * 0.85 + 10));
    const daysOnMarket = property.createdAt
      ? Math.max(
          1,
          Math.round(
            (Date.now() - new Date(property.createdAt).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : 30;
    const estimatedSellingDays = Math.max(
      7,
      Math.round(45 - demandScore * 0.25 + daysOnMarket * 0.1),
    );

    const timeline = this.buildTimeline({
      property,
      visits,
      favoritesCount,
      interestedLeads,
    });

    const activityLog = [
      ...(property.activityLog || []).map((row) => ({
        user: row.userName || row.userId || 'System',
        role: row.role || 'system',
        action: row.action,
        at: row.at,
        ip: row.ip,
      })),
      ...timeline.map((e) => ({
        user: e.user,
        role: e.role,
        action: e.action,
        at: e.at,
        ip: undefined as string | undefined,
      })),
    ]
      .sort(
        (a, b) =>
          new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime(),
      )
      .slice(0, 40);

    return {
      property: {
        ...property,
        _id: String(property._id),
        listedBy: property.listedBy ? String(property.listedBy) : undefined,
      },
      listingAgent: agentUser
        ? {
            id: String(agentUser._id),
            name: agentUser.name || 'Unknown',
            email: agentUser.email || '',
            image: agentUser.image || null,
            phone: agentUser.phone || null,
            role: agentUser.role || UserRole.AGENT,
            emailVerified: Boolean(agentUser.emailVerified),
            banned: Boolean(agentUser.banned),
            createdAt: agentUser.createdAt,
            updatedAt: agentUser.updatedAt,
            agency: 'PropertyAI Partners',
            officeAddress: 'Dhaka, Bangladesh',
            rating: Math.min(5, 3.8 + demandScore / 80),
            totalReviews: Math.max(favoritesCount + visits.length, 0),
            accountStatus: agentUser.banned ? 'Suspended' : 'Active',
            lastActive: agentUser.updatedAt || agentUser.createdAt,
          }
        : null,
      agentPerformance: {
        totalPropertiesListed: agentProps.length,
        activeListings,
        pendingListings,
        soldProperties,
        rentedProperties,
        cancelledListings,
        averageResponseTime: '—',
        leadConversionRate:
          interestedLeads.length > 0
            ? Math.round(
                (closedOrWon(interestedLeads) / interestedLeads.length) * 100,
              )
            : 0,
        customerRating: agentUser
          ? Math.min(5, 3.8 + demandScore / 80)
          : null,
      },
      analytics: {
        totalViews: totalViewsEstimate,
        uniqueVisitors: uniqueVisitorsEstimate,
        totalFavorites: favoritesCount,
        totalVisitRequests: visits.length,
        totalLeads: interestedLeads.length,
        interestedCustomers: interestedLeads.length,
        totalMessages: messagesCount,
        totalPhoneCalls: 0,
        averageTimeOnListing: '—',
        clickThroughRate:
          totalViewsEstimate > 0
            ? Math.round((favoritesCount / totalViewsEstimate) * 1000) / 10
            : 0,
        conversionRate,
        viewsAreEstimated: true,
      },
      timeline,
      activityLog,
      documents: (property.documents || []).map((d) => ({
        name: d.name,
        url: d.url,
        uploadedAt: d.uploadedAt,
        verificationStatus: d.verified ? 'Verified' : 'Pending',
      })),
      visits: {
        upcoming: upcomingVisits.map(mapVisit),
        completed: completedVisits.map(mapVisit),
        cancelled: cancelledVisits.map(mapVisit),
      },
      interestedCustomers: interestedLeads.map((lead) => ({
        id: String(lead._id),
        fullName: lead.fullName,
        phone: lead.phone,
        email: lead.email,
        leadScore: lead.score ?? 0,
        budgetMin: lead.budgetMin,
        budgetMax: lead.budgetMax,
        preferredArea: lead.preferredLocation,
        lastContact: (lead as { updatedAt?: Date }).updatedAt,
        currentStage: lead.status,
      })),
      financial: {
        listingPrice,
        suggestedAiPrice: suggested,
        finalSellingPrice: property.finalPrice ?? null,
        currency: property.currency || 'BDT',
        commissionPercent,
        commission,
        agentCommission,
        companyRevenue,
        profit: companyRevenue,
      },
      aiInsights: {
        aiLeadScore: avgLeadScore,
        propertyDemandScore: demandScore,
        popularityScore,
        priceRecommendation: suggested,
        marketTrend:
          demandScore >= 60 ? 'Rising' : demandScore >= 35 ? 'Stable' : 'Soft',
        estimatedSellingTime: `${estimatedSellingDays} days`,
        investmentRating:
          demandScore >= 70 ? 'A' : demandScore >= 45 ? 'B' : 'C',
        riskLevel: demandScore >= 55 ? 'Low' : demandScore >= 30 ? 'Medium' : 'High',
        recommendedImprovements: buildImprovements(property, favoritesCount),
      },
      adminNotes: property.adminNotes || '',
      internalTags: property.internalTags || [],
      featured: Boolean(property.featured),
      audit: {
        createdBy: agentId || null,
        createdAt: (property as { createdAt?: Date }).createdAt,
        lastUpdatedBy: property.lastUpdatedBy
          ? String(property.lastUpdatedBy)
          : agentId || null,
        updatedAt: (property as { updatedAt?: Date }).updatedAt,
        approvedBy: property.approvedBy
          ? String(property.approvedBy)
          : null,
        approvedAt: property.approvedAt || null,
        deletedBy: property.deletedBy ? String(property.deletedBy) : null,
        deletedAt: property.deletedAt || null,
        isActive: property.isActive,
      },
      relatedProperties: related.map((p) => ({
        ...p,
        _id: String(p._id),
      })),
      map: {
        query: [
          property.location?.address,
          property.location?.area,
          property.location?.city,
          'Bangladesh',
        ]
          .filter(Boolean)
          .join(', '),
        nearby: [
          'Schools',
          'Hospitals',
          'Mosques',
          'Shopping Malls',
          'Metro',
          'Bus Stops',
        ],
      },
    };
  }

  async updateAdminMeta(
    propertyId: string,
    actor: { id: string; role: string; name?: string },
    body: {
      adminNotes?: string;
      internalTags?: string[];
      featured?: boolean;
      suggestedPrice?: number;
      finalPrice?: number;
      commissionPercent?: number;
      parking?: number;
      status?: PropertyStatus;
      action?:
        | 'approve'
        | 'reject'
        | 'suspend'
        | 'feature'
        | 'unfeature'
        | 'archive'
        | 'restore'
        | 'delete';
    },
  ) {
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin only');
    }
    const property = await this.propertyModel.findById(propertyId);
    if (!property) throw new NotFoundException('Property not found');

    const log = (action: string) => {
      property.activityLog = property.activityLog || [];
      property.activityLog.push({
        userId: actor.id,
        userName: actor.name || 'Admin',
        role: 'admin',
        action,
        at: new Date(),
      });
    };

    if (body.adminNotes !== undefined) property.adminNotes = body.adminNotes;
    if (body.internalTags !== undefined)
      property.internalTags = body.internalTags;
    if (body.featured !== undefined) property.featured = body.featured;
    if (body.suggestedPrice !== undefined)
      property.suggestedPrice = body.suggestedPrice;
    if (body.finalPrice !== undefined) property.finalPrice = body.finalPrice;
    if (body.commissionPercent !== undefined)
      property.commissionPercent = body.commissionPercent;
    if (body.parking !== undefined) property.parking = body.parking;
    if (body.status !== undefined) property.status = body.status;

    property.lastUpdatedBy = new Types.ObjectId(actor.id);

    switch (body.action) {
      case 'approve':
        property.status = PropertyStatus.AVAILABLE;
        property.isActive = true;
        property.approvedBy = new Types.ObjectId(actor.id);
        property.approvedAt = new Date();
        property.featured = property.featured || false;
        log('Admin approved listing');
        break;
      case 'reject':
        property.status = PropertyStatus.DRAFT;
        log('Admin rejected listing');
        break;
      case 'suspend':
        property.status = PropertyStatus.RESERVED;
        log('Admin suspended listing');
        break;
      case 'feature':
        property.featured = true;
        log('Admin marked property as featured');
        break;
      case 'unfeature':
        property.featured = false;
        log('Admin removed featured flag');
        break;
      case 'archive':
        property.isActive = false;
        property.deletedBy = new Types.ObjectId(actor.id);
        property.deletedAt = new Date();
        log('Admin archived property');
        break;
      case 'restore':
        property.isActive = true;
        property.deletedBy = undefined;
        property.deletedAt = undefined;
        log('Admin restored property');
        break;
      case 'delete':
        property.isActive = false;
        property.deletedBy = new Types.ObjectId(actor.id);
        property.deletedAt = new Date();
        log('Admin soft-deleted property');
        break;
      default:
        if (
          body.adminNotes !== undefined ||
          body.internalTags !== undefined ||
          body.featured !== undefined
        ) {
          log('Admin updated property meta');
        }
    }

    await property.save();
    return this.getInsights(propertyId, actor.role);
  }

  async suspendAgent(agentId: string, actorRole: string, ban: boolean) {
    if (actorRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin only');
    }
    if (!Types.ObjectId.isValid(agentId)) {
      throw new NotFoundException('Agent not found');
    }
    const { ObjectId } = await import('mongodb');
    const result = await this.connection.collection('user').findOneAndUpdate(
      { _id: new ObjectId(agentId) },
      {
        $set: {
          banned: ban,
          banReason: ban ? 'Suspended by admin from property details' : null,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' },
    );
    if (!result) throw new NotFoundException('Agent not found');
    return {
      id: String(result._id),
      banned: Boolean(result.banned),
      name: result.name,
      email: result.email,
    };
  }

  private buildTimeline(input: {
    property: Property & { createdAt?: Date; updatedAt?: Date };
    visits: Array<{
      status: string;
      scheduledAt: Date;
      isActive?: boolean;
      lead?: { fullName?: string } | string;
    }>;
    favoritesCount: number;
    interestedLeads: Array<{
      fullName: string;
      status: string;
      createdAt?: Date;
      updatedAt?: Date;
    }>;
  }) {
    const events: Array<{
      action: string;
      at: Date | string;
      user: string;
      role: string;
    }> = [];

    if (input.property.createdAt) {
      events.push({
        action: 'Property Created',
        at: input.property.createdAt,
        user: 'Listing agent',
        role: 'agent',
      });
    }
    if (input.property.status !== PropertyStatus.DRAFT) {
      events.push({
        action: 'Property Published',
        at: input.property.updatedAt || input.property.createdAt || new Date(),
        user: 'System',
        role: 'system',
      });
    }
    if (
      input.property.updatedAt &&
      input.property.createdAt &&
      new Date(input.property.updatedAt).getTime() -
        new Date(input.property.createdAt).getTime() >
        60_000
    ) {
      events.push({
        action: 'Price / details Updated',
        at: input.property.updatedAt,
        user: 'Listing agent',
        role: 'agent',
      });
    }
    if (input.favoritesCount > 0) {
      events.push({
        action: `Customer bookmarked property (${input.favoritesCount})`,
        at: input.property.updatedAt || new Date(),
        user: 'Customers',
        role: 'user',
      });
    }
    for (const visit of input.visits.slice(0, 12)) {
      const leadName =
        typeof visit.lead === 'object' && visit.lead?.fullName
          ? visit.lead.fullName
          : 'Customer';
      if (visit.status === VisitStatus.SCHEDULED) {
        events.push({
          action: 'Visit Requested',
          at: visit.scheduledAt,
          user: leadName,
          role: 'user',
        });
      } else if (visit.status === VisitStatus.COMPLETED) {
        events.push({
          action: 'Visit Completed',
          at: visit.scheduledAt,
          user: leadName,
          role: 'user',
        });
      } else if (visit.status === VisitStatus.CANCELLED) {
        events.push({
          action: 'Visit Cancelled',
          at: visit.scheduledAt,
          user: leadName,
          role: 'user',
        });
      }
    }
    for (const lead of input.interestedLeads.slice(0, 8)) {
      events.push({
        action: `Lead Created (${lead.status})`,
        at: lead.createdAt || lead.updatedAt || new Date(),
        user: lead.fullName,
        role: 'user',
      });
    }
    if (input.property.status === PropertyStatus.SOLD) {
      events.push({
        action: 'Property Sold',
        at: input.property.updatedAt || new Date(),
        user: 'System',
        role: 'system',
      });
    }
    if (input.property.status === PropertyStatus.RENTED) {
      events.push({
        action: 'Property Rented',
        at: input.property.updatedAt || new Date(),
        user: 'System',
        role: 'system',
      });
    }

    return events.sort(
      (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
    );
  }
}

function closedOrWon(leads: Array<{ status: string }>) {
  return leads.filter(
    (l) =>
      l.status === LeadStatus.CLOSED || l.status === LeadStatus.NEGOTIATION,
  ).length;
}

function mapVisit(visit: {
  _id: Types.ObjectId;
  scheduledAt: Date;
  status: string;
  assignedAgent?: Types.ObjectId;
  lead?: { fullName?: string; email?: string; phone?: string } | string;
}) {
  const lead =
    typeof visit.lead === 'object' && visit.lead ? visit.lead : null;
  return {
    id: String(visit._id),
    visitorName: lead?.fullName || 'Visitor',
    visitDate: visit.scheduledAt,
    visitTime: visit.scheduledAt,
    assignedAgent: visit.assignedAgent
      ? String(visit.assignedAgent)
      : null,
    status: visit.status,
    email: lead?.email,
    phone: lead?.phone,
  };
}

function buildImprovements(
  property: { amenities?: string[]; images?: string[]; description?: string },
  favorites: number,
) {
  const tips: string[] = [];
  if ((property.images?.length || 0) < 5) {
    tips.push('Add more high-quality photos (aim for 8+)');
  }
  if ((property.description?.length || 0) < 200) {
    tips.push('Expand the description with neighborhood highlights');
  }
  if ((property.amenities?.length || 0) < 4) {
    tips.push('List key amenities (parking, security, generator)');
  }
  if (favorites < 3) {
    tips.push('Promote listing to increase favorites and demand signals');
  }
  if (tips.length === 0) {
    tips.push('Listing looks strong — keep response times under 1 hour');
  }
  return tips;
}
