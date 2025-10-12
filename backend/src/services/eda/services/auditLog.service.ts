// File: backend/src/services/eda/services/auditLog.service.ts
// Purpose: Audit logging service

import { db } from '../../../shared/database/connection';
import { logger } from '../../../shared/utils/logger';
import { esClient } from '../../../shared/search/elasticsearch';
import { config } from '../../../config';

export interface AuditLogEntry {
  userId: string;
  userEmail: string;
  userRole: string;
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE';
  resource: string;
  resourceId?: string;
  changes?: any;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  phiAccessed: boolean;
  errorMessage?: string;
}

export class AuditLogService {
  /**
   * Create audit log entry
   */
  static async log(entry: AuditLogEntry): Promise<void> {
    try {
      // Insert into PostgreSQL
      await db('portal.audit_logs').insert({
        user_id: entry.userId,
        user_email: entry.userEmail,
        user_role: entry.userRole,
        action: entry.action,
        resource: entry.resource,
        resource_id: entry.resourceId,
        changes: entry.changes ? JSON.stringify(entry.changes) : null,
        ip_address: entry.ipAddress,
        user_agent: entry.userAgent,
        success: entry.success,
        phi_accessed: entry.phiAccessed,
        error_message: entry.errorMessage,
        timestamp: new Date(),
      });

      // Also index in Elasticsearch for fast searching (optional)
      try {
        await esClient.index({
          index: `${config.elasticsearch.indexPrefix}audit_logs`,
          document: {
            ...entry,
            timestamp: new Date(),
          },
        });
      } catch (esError) {
        logger.warn('Failed to index audit log in Elasticsearch:', esError);
        // Continue - Elasticsearch is optional
      }
    } catch (error) {
      logger.error('Failed to create audit log:', error);
      // Don't throw - audit logging should not break the main flow
    }
  }

  /**
   * Search audit logs
   */
  static async search(params: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    action?: string;
    resource?: string;
    phiAccessed?: boolean;
    page?: number;
    limit?: number;
  }) {
    const {
      startDate,
      endDate,
      userId,
      action,
      resource,
      phiAccessed,
      page = 1,
      limit = 100,
    } = params;

    // Build query
    const query = db('portal.audit_logs').select('*');

    if (startDate) {
      query.where('timestamp', '>=', startDate);
    }

    if (endDate) {
      query.where('timestamp', '<=', endDate);
    }

    if (userId) {
      query.where('user_id', userId);
    }

    if (action) {
      query.where('action', action);
    }

    if (resource) {
      query.where('resource', resource);
    }

    if (phiAccessed !== undefined) {
      query.where('phi_accessed', phiAccessed);
    }

    // Get total count
    const countQuery = query.clone();
    const [{ count }] = await countQuery.count('* as count');

    // Pagination
    const offset = (page - 1) * limit;
    const logs = await query
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .offset(offset);

    return {
      logs,
      pagination: {
        total: parseInt(count as string),
        page,
        pages: Math.ceil(parseInt(count as string) / limit),
        limit,
      },
    };
  }

  /**
   * Get PHI access summary
   */
  static async getPhiAccessSummary(timeRange: '24h' | '7d' | '30d' | '90d') {
    const intervals = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000,
    };

    const startDate = new Date(Date.now() - intervals[timeRange]);

    const summary = await db('portal.audit_logs')
      .where('phi_accessed', true)
      .where('timestamp', '>=', startDate)
      .select(
        db.raw('COUNT(*) as total_accesses'),
        db.raw('COUNT(DISTINCT user_id) as unique_users'),
        db.raw('COUNT(DISTINCT resource_id) as unique_patients')
      )
      .first();

    const byRole = await db('portal.audit_logs')
      .where('phi_accessed', true)
      .where('timestamp', '>=', startDate)
      .groupBy('user_role')
      .select('user_role', db.raw('COUNT(*) as count'))
      .orderBy('count', 'desc');

    const byHour = await db('portal.audit_logs')
      .where('phi_accessed', true)
      .where('timestamp', '>=', startDate)
      .select(db.raw('EXTRACT(HOUR FROM timestamp) as hour'), db.raw('COUNT(*) as count'))
      .groupBy(db.raw('EXTRACT(HOUR FROM timestamp)'))
      .orderBy('hour');

    return {
      summary,
      byRole,
      byHour,
    };
  }

  /**
   * Detect anomalous access patterns
   */
  static async detectAnomalies() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Users with > 100 PHI accesses in last hour
    const heavyUsers = await db('portal.audit_logs')
      .where('phi_accessed', true)
      .where('timestamp', '>=', oneHourAgo)
      .groupBy('user_id', 'user_email', 'user_role')
      .select('user_id', 'user_email', 'user_role', db.raw('COUNT(*) as access_count'))
      .having(db.raw('COUNT(*)'), '>', 100);

    // Access outside work hours (10pm - 6am)
    const afterHoursAccess = await db('portal.audit_logs')
      .where('phi_accessed', true)
      .where('timestamp', '>=', oneHourAgo)
      .whereRaw('EXTRACT(HOUR FROM timestamp) >= 22 OR EXTRACT(HOUR FROM timestamp) < 6')
      .select('user_id', 'user_email', 'timestamp', 'resource', 'resource_id');

    return {
      heavyUsers,
      afterHoursAccess,
    };
  }
}

