import { db } from '../../../shared/database/connection';
import { cache } from '../../../shared/cache/redis';
import { logger } from '../../../shared/utils/logger';
import { AppError } from '../../../shared/middleware/errorHandler';

export interface AnalyticsQuery {
  metric: string;
  tenantId?: string;
  startDate: Date;
  endDate: Date;
  groupBy?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  filters?: any;
}

export interface KPIMetric {
  name: string;
  value: number;
  unit?: string;
  previousValue?: number;
  change?: number;
  changePercentage?: number;
  trend?: 'up' | 'down' | 'stable';
}

export class AnalyticsService {
  /**
   * Get system-wide dashboard metrics
   */
  static async getSystemMetrics(timeRange: '7d' | '30d' | '90d' | '1y' = '30d'): Promise<any> {
    const cacheKey = `analytics:system:${timeRange}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const { startDate, endDate } = this.getDateRange(timeRange);

    const metrics = {
      overview: await this.getOverviewMetrics(startDate, endDate),
      tenants: await this.getTenantMetrics(startDate, endDate),
      users: await this.getUserMetrics(startDate, endDate),
      medicines: await this.getMedicineMetrics(startDate, endDate),
      recalls: await this.getRecallMetrics(startDate, endDate),
      adverseEvents: await this.getAdverseEventMetrics(startDate, endDate),
      auditActivity: await this.getAuditMetrics(startDate, endDate),
    };

    // Cache for 15 minutes
    await cache.set(cacheKey, metrics, 900);

    return metrics;
  }

  /**
   * Get tenant-specific metrics
   */
  static async getTenantDashboard(tenantId: string, timeRange: string = '30d'): Promise<any> {
    const cacheKey = `analytics:tenant:${tenantId}:${timeRange}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const { startDate, endDate } = this.getDateRange(timeRange);

    const metrics = {
      overview: await this.getTenantOverview(tenantId, startDate, endDate),
      users: await this.getTenantUserMetrics(tenantId, startDate, endDate),
      activity: await this.getTenantActivityMetrics(tenantId, startDate, endDate),
      prescriptions: await this.getTenantPrescriptionMetrics(tenantId, startDate, endDate),
      compliance: await this.getTenantComplianceMetrics(tenantId, startDate, endDate),
    };

    // Cache for 15 minutes
    await cache.set(cacheKey, metrics, 900);

    return metrics;
  }

  /**
   * Get overview metrics
   */
  private static async getOverviewMetrics(startDate: Date, endDate: Date): Promise<any> {
    const [totals, growth] = await Promise.all([
      // Current totals
      db.raw(`
        SELECT 
          (SELECT COUNT(*) FROM portal.tenants WHERE status = 'active') as active_tenants,
          (SELECT COUNT(*) FROM public.users) as total_users,
          (SELECT COUNT(*) FROM portal.medicines WHERE status = 'active') as active_medicines,
          (SELECT COUNT(*) FROM portal.recalls WHERE status IN ('initiated', 'in_progress')) as active_recalls
      `),
      // Growth metrics
      db.raw(`
        SELECT
          (SELECT COUNT(*) FROM portal.tenants 
           WHERE created_at >= ? AND created_at <= ?) as new_tenants,
          (SELECT COUNT(*) FROM public.users 
           WHERE created_at >= ? AND created_at <= ?) as new_users,
          (SELECT COUNT(*) FROM portal.adverse_events 
           WHERE created_at >= ? AND created_at <= ?) as new_adverse_events
      `, [startDate, endDate, startDate, endDate, startDate, endDate]),
    ]);

    return {
      totals: totals.rows[0],
      growth: growth.rows[0],
    };
  }

  /**
   * Get tenant metrics
   */
  private static async getTenantMetrics(startDate: Date, endDate: Date): Promise<any> {
    const [byType, byStatus, growth] = await Promise.all([
      // By type
      db('portal.tenants')
        .select('type')
        .count('* as count')
        .whereNull('deleted_at')
        .groupBy('type'),
      
      // By status
      db('portal.tenants')
        .select('status')
        .count('* as count')
        .whereNull('deleted_at')
        .groupBy('status'),
      
      // Growth trend
      db.raw(`
        SELECT 
          DATE_TRUNC('day', created_at) as date,
          COUNT(*) as count
        FROM portal.tenants
        WHERE created_at >= ? AND created_at <= ?
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY date
      `, [startDate, endDate]),
    ]);

    return {
      byType: byType.reduce((acc: any, row: any) => {
        acc[row.type] = parseInt(row.count);
        return acc;
      }, {}),
      byStatus: byStatus.reduce((acc: any, row: any) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {}),
      growth: growth.rows,
    };
  }

  /**
   * Get user metrics
   */
  private static async getUserMetrics(startDate: Date, endDate: Date): Promise<any> {
    const [total, active, byRole, growth] = await Promise.all([
      // Total users
      db('public.users').count('* as count'),
      
      // Active users (logged in recently)
      db('public.users')
        .count('* as count')
        .where('last_login_at', '>=', db.raw("NOW() - INTERVAL '30 days'")),
      
      // By role
      db('portal.user_tenants')
        .select('portal.roles.name as role_name')
        .count('* as count')
        .leftJoin('portal.roles', 'portal.user_tenants.role_id', 'portal.roles.id')
        .where('portal.user_tenants.status', 'active')
        .groupBy('portal.roles.name'),
      
      // Growth trend
      db.raw(`
        SELECT 
          DATE_TRUNC('day', created_at) as date,
          COUNT(*) as count
        FROM public.users
        WHERE created_at >= ? AND created_at <= ?
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY date
      `, [startDate, endDate]),
    ]);

    return {
      total: parseInt(total[0].count),
      active: parseInt(active[0].count),
      byRole: byRole.reduce((acc: any, row: any) => {
        acc[row.role_name] = parseInt(row.count);
        return acc;
      }, {}),
      growth: growth.rows,
    };
  }

  /**
   * Get medicine metrics
   */
  private static async getMedicineMetrics(startDate: Date, endDate: Date): Promise<any> {
    const [total, byStatus, recentlyAdded, popularSearches] = await Promise.all([
      // Total medicines
      db('portal.medicines').count('* as count'),
      
      // By status
      db('portal.medicines')
        .select('status')
        .count('* as count')
        .groupBy('status'),
      
      // Recently added
      db('portal.medicines')
        .count('* as count')
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate),
      
      // Popular searches (would need search tracking)
      Promise.resolve([]),
    ]);

    return {
      total: parseInt(total[0].count),
      byStatus: byStatus.reduce((acc: any, row: any) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {}),
      recentlyAdded: parseInt(recentlyAdded[0].count),
      popularSearches,
    };
  }

  /**
   * Get recall metrics
   */
  private static async getRecallMetrics(startDate: Date, endDate: Date): Promise<any> {
    const [total, bySeverity, byStatus, recent, notifications] = await Promise.all([
      // Total recalls
      db('portal.recalls').count('* as count'),
      
      // By severity
      db('portal.recalls')
        .select('severity')
        .count('* as count')
        .groupBy('severity'),
      
      // By status
      db('portal.recalls')
        .select('status')
        .count('* as count')
        .groupBy('status'),
      
      // Recent recalls
      db('portal.recalls')
        .count('* as count')
        .where('recall_date', '>=', startDate)
        .where('recall_date', '<=', endDate),
      
      // Notification stats
      db('portal.recall_notifications')
        .select('status')
        .count('* as count')
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate)
        .groupBy('status'),
    ]);

    return {
      total: parseInt(total[0].count),
      bySeverity: bySeverity.reduce((acc: any, row: any) => {
        acc[row.severity] = parseInt(row.count);
        return acc;
      }, {}),
      byStatus: byStatus.reduce((acc: any, row: any) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {}),
      recent: parseInt(recent[0].count),
      notifications: notifications.reduce((acc: any, row: any) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {}),
    };
  }

  /**
   * Get adverse event metrics
   */
  private static async getAdverseEventMetrics(startDate: Date, endDate: Date): Promise<any> {
    const [total, bySeverity, byOutcome, recent, trend] = await Promise.all([
      // Total adverse events
      db('portal.adverse_events').count('* as count'),
      
      // By severity
      db('portal.adverse_events')
        .select('severity')
        .count('* as count')
        .groupBy('severity'),
      
      // By outcome
      db('portal.adverse_events')
        .select('outcome')
        .count('* as count')
        .groupBy('outcome'),
      
      // Recent events
      db('portal.adverse_events')
        .count('* as count')
        .where('event_date', '>=', startDate)
        .where('event_date', '<=', endDate),
      
      // Trend
      db.raw(`
        SELECT 
          DATE_TRUNC('week', event_date) as week,
          COUNT(*) as count
        FROM portal.adverse_events
        WHERE event_date >= ? AND event_date <= ?
        GROUP BY DATE_TRUNC('week', event_date)
        ORDER BY week
      `, [startDate, endDate]),
    ]);

    return {
      total: parseInt(total[0].count),
      bySeverity: bySeverity.reduce((acc: any, row: any) => {
        acc[row.severity] = parseInt(row.count);
        return acc;
      }, {}),
      byOutcome: byOutcome.reduce((acc: any, row: any) => {
        acc[row.outcome] = parseInt(row.count);
        return acc;
      }, {}),
      recent: parseInt(recent[0].count),
      trend: trend.rows,
    };
  }

  /**
   * Get audit metrics
   */
  private static async getAuditMetrics(startDate: Date, endDate: Date): Promise<any> {
    const [total, byAction, topUsers, phiAccess] = await Promise.all([
      // Total audit logs
      db('portal.audit_logs')
        .count('* as count')
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate),
      
      // By action
      db('portal.audit_logs')
        .select('action')
        .count('* as count')
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate)
        .groupBy('action'),
      
      // Top users by activity
      db('portal.audit_logs')
        .select('user_email')
        .count('* as count')
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate)
        .groupBy('user_email')
        .orderBy('count', 'desc')
        .limit(10),
      
      // PHI access
      db('portal.audit_logs')
        .count('* as count')
        .where('phi_accessed', true)
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate),
    ]);

    return {
      total: parseInt(total[0].count),
      byAction: byAction.reduce((acc: any, row: any) => {
        acc[row.action] = parseInt(row.count);
        return acc;
      }, {}),
      topUsers: topUsers.map((row: any) => ({
        email: row.user_email,
        count: parseInt(row.count),
      })),
      phiAccess: parseInt(phiAccess[0].count),
    };
  }

  /**
   * Get tenant overview
   */
  private static async getTenantOverview(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const tenant = await db('portal.tenants').where({ id: tenantId }).first();
    
    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    const [userCount, activityCount, prescriptionCount] = await Promise.all([
      db('portal.user_tenants')
        .count('* as count')
        .where({ tenant_id: tenantId, status: 'active' }),
      
      db('portal.audit_logs')
        .count('* as count')
        .where({ tenant_id: tenantId })
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate),
      
      // Prescription count would need prescription table
      Promise.resolve([{ count: 0 }]),
    ]);

    return {
      tenant,
      users: parseInt(userCount[0].count),
      activity: parseInt(activityCount[0].count),
      prescriptions: parseInt(prescriptionCount[0].count),
    };
  }

  /**
   * Get tenant user metrics
   */
  private static async getTenantUserMetrics(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const [byRole, recent, active] = await Promise.all([
      // Users by role
      db('portal.user_tenants')
        .select('portal.roles.name as role_name')
        .count('* as count')
        .leftJoin('portal.roles', 'portal.user_tenants.role_id', 'portal.roles.id')
        .where({ 'portal.user_tenants.tenant_id': tenantId, 'portal.user_tenants.status': 'active' })
        .groupBy('portal.roles.name'),
      
      // Recently joined
      db('portal.user_tenants')
        .count('* as count')
        .where({ tenant_id: tenantId })
        .where('joined_at', '>=', startDate)
        .where('joined_at', '<=', endDate),
      
      // Active users
      db('portal.user_tenants')
        .count('* as count')
        .where({ tenant_id: tenantId, status: 'active' })
        .where('last_active_at', '>=', db.raw("NOW() - INTERVAL '7 days'")),
    ]);

    return {
      byRole: byRole.reduce((acc: any, row: any) => {
        acc[row.role_name] = parseInt(row.count);
        return acc;
      }, {}),
      recentlyJoined: parseInt(recent[0].count),
      activeLastWeek: parseInt(active[0].count),
    };
  }

  /**
   * Get tenant activity metrics
   */
  private static async getTenantActivityMetrics(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const [byAction, trend, topUsers] = await Promise.all([
      // Activity by action
      db('portal.audit_logs')
        .select('action')
        .count('* as count')
        .where({ tenant_id: tenantId })
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate)
        .groupBy('action'),
      
      // Daily trend
      db.raw(`
        SELECT 
          DATE_TRUNC('day', created_at) as date,
          COUNT(*) as count
        FROM portal.audit_logs
        WHERE tenant_id = ? AND created_at >= ? AND created_at <= ?
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY date
      `, [tenantId, startDate, endDate]),
      
      // Top active users
      db('portal.audit_logs')
        .select('user_email')
        .count('* as count')
        .where({ tenant_id: tenantId })
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate)
        .groupBy('user_email')
        .orderBy('count', 'desc')
        .limit(5),
    ]);

    return {
      byAction: byAction.reduce((acc: any, row: any) => {
        acc[row.action] = parseInt(row.count);
        return acc;
      }, {}),
      trend: trend.rows,
      topUsers: topUsers.map((row: any) => ({
        email: row.user_email,
        count: parseInt(row.count),
      })),
    };
  }

  /**
   * Get tenant prescription metrics (placeholder)
   */
  private static async getTenantPrescriptionMetrics(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    // This would be implemented when prescription feature is added
    return {
      total: 0,
      trend: [],
      topMedicines: [],
    };
  }

  /**
   * Get tenant compliance metrics
   */
  private static async getTenantComplianceMetrics(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const [auditLogs, phiAccess, licenseStatus] = await Promise.all([
      db('portal.audit_logs')
        .count('* as count')
        .where({ tenant_id: tenantId })
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate),
      
      db('portal.audit_logs')
        .count('* as count')
        .where({ tenant_id: tenantId, phi_accessed: true })
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate),
      
      db('portal.tenants')
        .select('license_status', 'license_expiry')
        .where({ id: tenantId })
        .first(),
    ]);

    return {
      auditLogCount: parseInt(auditLogs[0].count),
      phiAccessCount: parseInt(phiAccess[0].count),
      licenseStatus: licenseStatus?.license_status,
      licenseExpiry: licenseStatus?.license_expiry,
      isCompliant: licenseStatus?.license_status === 'active',
    };
  }

  /**
   * Helper: Get date range from time range string
   */
  private static getDateRange(timeRange: string): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    const startDate = new Date();

    switch (timeRange) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    return { startDate, endDate };
  }

  /**
   * Calculate KPI metrics
   */
  static async calculateKPIs(
    category: string,
    tenantId?: string,
    date: Date = new Date()
  ): Promise<KPIMetric[]> {
    const cacheKey = `kpi:${category}:${tenantId || 'system'}:${date.toISOString().split('T')[0]}`;
    const cached = await cache.get<KPIMetric[]>(cacheKey);
    if (cached) {
      return cached;
    }

    let kpis: KPIMetric[] = [];

    switch (category) {
      case 'system':
        kpis = await this.calculateSystemKPIs(date);
        break;
      case 'tenant':
        if (tenantId) {
          kpis = await this.calculateTenantKPIs(tenantId, date);
        }
        break;
      case 'safety':
        kpis = await this.calculateSafetyKPIs(tenantId, date);
        break;
      case 'compliance':
        kpis = await this.calculateComplianceKPIs(tenantId, date);
        break;
      default:
        throw new AppError('Invalid KPI category', 400);
    }

    // Cache for 1 hour
    await cache.set(cacheKey, kpis, 3600);

    return kpis;
  }

  /**
   * Calculate system-wide KPIs
   */
  private static async calculateSystemKPIs(date: Date): Promise<KPIMetric[]> {
    // Implementation would calculate various system KPIs
    return [];
  }

  /**
   * Calculate tenant-specific KPIs
   */
  private static async calculateTenantKPIs(tenantId: string, date: Date): Promise<KPIMetric[]> {
    // Implementation would calculate tenant KPIs
    return [];
  }

  /**
   * Calculate safety KPIs
   */
  private static async calculateSafetyKPIs(tenantId: string | undefined, date: Date): Promise<KPIMetric[]> {
    // Implementation would calculate safety-related KPIs
    return [];
  }

  /**
   * Calculate compliance KPIs
   */
  private static async calculateComplianceKPIs(
    tenantId: string | undefined,
    date: Date
  ): Promise<KPIMetric[]> {
    // Implementation would calculate compliance KPIs
    return [];
  }
}