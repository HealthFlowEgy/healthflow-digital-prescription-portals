import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../../shared/middleware/auth';
import { AnalyticsService } from '../services/analytics.service';
import { ReportService } from '../services/report.service';
import { DataExportService } from '../services/dataExport.service';

export class AnalyticsController {
  /**
   * GET /api/v2/analytics/system
   */
  static async getSystemMetrics(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const timeRange = (req.query.timeRange as any) || '30d';
      const metrics = await AnalyticsService.getSystemMetrics(timeRange);

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v2/analytics/tenant/:tenantId
   */
  static async getTenantMetrics(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tenantId } = req.params;
      const timeRange = (req.query.timeRange as string) || '30d';

      const metrics = await AnalyticsService.getTenantDashboard(tenantId, timeRange);

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v2/analytics/kpis
   */
  static async getKPIs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { category, tenantId } = req.query;

      const kpis = await AnalyticsService.calculateKPIs(
        category as string,
        tenantId as string,
        new Date()
      );

      res.json({
        success: true,
        data: kpis,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v2/reports
   */
  static async createReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await ReportService.createReport(req.body, req.user!.id);

      res.status(201).json({
        success: true,
        message: 'Report created successfully',
        data: report,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v2/reports/:id/execute
   */
  static async executeReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const execution = await ReportService.executeReport(id, req.body.parameters, req.user!.id);

      res.json({
        success: true,
        message: 'Report execution started',
        data: execution,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v2/reports/executions/:id
   */
  static async getExecution(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const execution = await ReportService.getExecution(id);

      res.json({
        success: true,
        data: execution,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v2/reports/executions/:id/download
   */
  static async downloadReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { filePath, fileName } = await ReportService.downloadReport(id);

      res.download(filePath, fileName);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v2/reports/:id/schedule
   */
  static async scheduleReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { cronExpression, recipients } = req.body;

      const report = await ReportService.scheduleReport(
        id,
        cronExpression,
        recipients,
        req.user!.id
      );

      res.json({
        success: true,
        message: 'Report scheduled successfully',
        data: report,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v2/exports
   */
  static async createExport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const exportRecord = await DataExportService.requestExport(req.body, req.user!.id);

      res.status(201).json({
        success: true,
        message: 'Export request created successfully',
        data: exportRecord,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v2/exports
   */
  static async listExports(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const exports = await DataExportService.listExports(req.user!.id, 50);

      res.json({
        success: true,
        data: exports,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v2/exports/:id
   */
  static async getExport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const exportRecord = await DataExportService.getExport(id);

      res.json({
        success: true,
        data: exportRecord,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v2/exports/:id/download
   */
  static async downloadExport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { filePath, fileName } = await DataExportService.downloadExport(id);

      res.download(filePath, fileName);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v2/exports/:id
   */
  static async deleteExport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const exportRecord = await DataExportService.getExport(id);

      // Delete file
      const fs = require('fs');
      if (exportRecord.file_path && fs.existsSync(exportRecord.file_path)) {
        fs.unlinkSync(exportRecord.file_path);
      }

      // Delete record
      await require('../../../shared/database/connection').db('portal.data_exports')
        .where({ id })
        .delete();

      res.json({
        success: true,
        message: 'Export deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}