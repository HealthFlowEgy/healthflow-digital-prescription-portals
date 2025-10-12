// File: backend/src/services/eda/controllers/auditLog.controller.ts
// Purpose: Audit log API endpoints

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../../shared/middleware/auth';
import { AuditLogService } from '../services/auditLog.service';
import { AppError } from '../../../shared/middleware/errorHandler';

export class AuditLogController {
  /**
   * GET /api/v2/eda/audit/logs
   * Search audit logs
   */
  static async search(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        startDate,
        endDate,
        userId,
        action,
        resource,
        phiAccessed,
        page,
        limit,
      } = req.query;

      const result = await AuditLogService.search({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        userId: userId as string,
        action: action as string,
        resource: resource as string,
        phiAccessed: phiAccessed === 'true' ? true : phiAccessed === 'false' ? false : undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      res.json({
        success: true,
        data: result.logs,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v2/eda/audit/phi-access
   * Get PHI access summary
   */
  static async getPhiAccessSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { timeRange = '24h' } = req.query;

      if (!['24h', '7d', '30d', '90d'].includes(timeRange as string)) {
        throw new AppError('Invalid time range. Must be 24h, 7d, 30d, or 90d', 400);
      }

      const summary = await AuditLogService.getPhiAccessSummary(
        timeRange as '24h' | '7d' | '30d' | '90d'
      );

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v2/eda/audit/anomalies
   * Detect anomalous access patterns
   */
  static async detectAnomalies(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const anomalies = await AuditLogService.detectAnomalies();

      res.json({
        success: true,
        data: anomalies,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v2/eda/audit/export
   * Export audit logs
   */
  static async export(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { format = 'csv', ...searchParams } = req.body;

      const result = await AuditLogService.search({
        ...searchParams,
        limit: 10000, // Max export limit
      });

      if (format === 'csv') {
        // Convert to CSV
        const csv = this.convertToCSV(result.logs);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
        res.send(csv);
      } else {
        // JSON format
        res.json({
          success: true,
          data: result.logs,
        });
      }
    } catch (error) {
      next(error);
    }
  }

  private static convertToCSV(logs: any[]): string {
    if (logs.length === 0) return '';

    const headers = Object.keys(logs[0]);
    const csvRows = [headers.join(',')];

    for (const log of logs) {
      const values = headers.map((header) => {
        const value = log[header];
        return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }
}

