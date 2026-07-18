import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { Visit, VisitDocument } from '../visits/schemas/visit.schema';
import { LeadStatus, PropertyStatus } from '../common/enums';
import { estimateRevenue, salesCount } from './reports.helpers';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Property.name)
    private readonly propertyModel: Model<PropertyDocument>,
    @InjectModel(Lead.name)
    private readonly leadModel: Model<LeadDocument>,
    @InjectModel(Visit.name)
    private readonly visitModel: Model<VisitDocument>,
  ) {}

  async getSummary() {
    const [
      closedLeads,
      soldProperties,
      soldAgg,
      leadSources,
      leadStatuses,
      agentPerformance,
      visitStats,
      monthlyClosed,
    ] = await Promise.all([
      this.leadModel.countDocuments({
        isActive: true,
        status: LeadStatus.CLOSED,
      }),
      this.propertyModel.countDocuments({
        isActive: true,
        status: PropertyStatus.SOLD,
      }),
      this.propertyModel.aggregate<{ total: number }>([
        {
          $match: {
            isActive: true,
            status: { $in: [PropertyStatus.SOLD, PropertyStatus.RENTED] },
          },
        },
        { $group: { _id: null, total: { $sum: '$price' } } },
      ]),
      this.leadModel.aggregate<{ _id: string; count: number }>([
        { $match: { isActive: true } },
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.leadModel.aggregate<{ _id: string; count: number }>([
        { $match: { isActive: true } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.leadModel.aggregate<{
        _id: string | null;
        leads: number;
        closed: number;
      }>([
        { $match: { isActive: true, assignedAgent: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: '$assignedAgent',
            leads: { $sum: 1 },
            closed: {
              $sum: {
                $cond: [{ $eq: ['$status', LeadStatus.CLOSED] }, 1, 0],
              },
            },
          },
        },
        { $sort: { closed: -1, leads: -1 } },
        { $limit: 10 },
      ]),
      this.visitModel.aggregate<{ _id: string; count: number }>([
        { $match: { isActive: true } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.closedLeadsByMonth(),
    ]);

    const revenue = estimateRevenue({
      soldInventoryTotal: soldAgg[0]?.total ?? 0,
      closedLeads,
    });
    const sales = salesCount(soldProperties, closedLeads);

    return {
      kpis: {
        revenue,
        sales,
        closedLeads,
        soldProperties,
        currency: 'BDT',
      },
      charts: {
        salesByMonth: monthlyClosed,
        leadSources: leadSources.map((row) => ({
          source: row._id || 'unknown',
          count: row.count,
        })),
        leadStatuses: leadStatuses.map((row) => ({
          status: row._id || 'unknown',
          count: row.count,
        })),
        visitsByStatus: visitStats.map((row) => ({
          status: row._id || 'unknown',
          count: row.count,
        })),
      },
      agentPerformance: agentPerformance.map((row) => ({
        agentId: row._id ? String(row._id) : 'unassigned',
        leads: row.leads,
        closed: row.closed,
        conversionRate:
          row.leads > 0 ? Math.round((row.closed / row.leads) * 100) : 0,
      })),
      meta: {
        generatedAt: new Date().toISOString(),
        dataMode: sales + closedLeads === 0 ? 'empty' : 'live',
      },
    };
  }

  private async closedLeadsByMonth() {
    const start = new Date();
    start.setMonth(start.getMonth() - 5);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const rows = await this.leadModel.aggregate<{
      _id: { year: number; month: number };
      count: number;
    }>([
      {
        $match: {
          isActive: true,
          status: LeadStatus.CLOSED,
          updatedAt: { $gte: start },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$updatedAt' },
            month: { $month: '$updatedAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const months: Array<{ month: string; value: number }> = [];
    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const match = rows.find(
        (row) => row._id.year === year && row._id.month === month,
      );
      months.push({
        month: date.toLocaleString('en', { month: 'short' }),
        value: match?.count ?? 0,
      });
    }

    return months;
  }
}
