import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { LeadStatus, PropertyStatus } from '../common/enums';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Property.name)
    private readonly propertyModel: Model<PropertyDocument>,
    @InjectModel(Lead.name)
    private readonly leadModel: Model<LeadDocument>,
  ) {}

  async getStats() {
    const [
      totalProperties,
      availableProperties,
      activeLeads,
      closedLeads,
    ] = await Promise.all([
      this.propertyModel.countDocuments({ isActive: true }),
      this.propertyModel.countDocuments({
        isActive: true,
        status: PropertyStatus.AVAILABLE,
      }),
      this.leadModel.countDocuments({
        isActive: true,
        status: { $ne: LeadStatus.CLOSED },
      }),
      this.leadModel.countDocuments({
        isActive: true,
        status: LeadStatus.CLOSED,
      }),
    ]);

    // Revenue/sales become real once deals module exists — keep a clear placeholder shape.
    const revenue = closedLeads * 250000;
    const sales = closedLeads;

    return {
      kpis: {
        totalProperties,
        availableProperties,
        activeLeads,
        sales,
        revenue,
        currency: 'BDT',
      },
      charts: {
        salesTrend: this.buildTrendSeries(sales),
        leadTrend: this.buildTrendSeries(activeLeads),
      },
      notifications: this.buildNotifications({
        totalProperties,
        activeLeads,
        closedLeads,
      }),
      meta: {
        generatedAt: new Date().toISOString(),
        dataMode: totalProperties + activeLeads + closedLeads === 0 ? 'empty' : 'live',
      },
    };
  }

  private buildTrendSeries(seed: number) {
    const months = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
    return months.map((month, index) => ({
      month,
      value: Math.max(0, Math.round(seed * (0.35 + index * 0.12))),
    }));
  }

  private buildNotifications(input: {
    totalProperties: number;
    activeLeads: number;
    closedLeads: number;
  }) {
    if (
      input.totalProperties === 0 &&
      input.activeLeads === 0 &&
      input.closedLeads === 0
    ) {
      return [] as Array<{
        id: string;
        title: string;
        body: string;
        type: 'info' | 'success' | 'warning';
        createdAt: string;
      }>;
    }

    return [
      {
        id: 'n1',
        title: 'Pipeline update',
        body: `You have ${input.activeLeads} active lead(s) in progress.`,
        type: 'info' as const,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'n2',
        title: 'Inventory snapshot',
        body: `${input.totalProperties} active propert${input.totalProperties === 1 ? 'y' : 'ies'} in the catalog.`,
        type: 'success' as const,
        createdAt: new Date().toISOString(),
      },
    ];
  }
}
