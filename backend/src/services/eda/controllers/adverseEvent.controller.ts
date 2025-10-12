// File: backend/src/services/eda/controllers/adverseEvent.controller.ts
// Purpose: API endpoints for adverse event reporting

import { Request, Response, NextFunction } from 'express';
import { AdverseEventService } from '../services/adverseEvent.service';
import { logger } from '../../../shared/utils/logger';

export class AdverseEventController {
  /**
   * Submit a new adverse event report
   * POST /api/v2/eda/adverse-events
   */
  static async submitReport(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      const event = await AdverseEventService.submitReport(req.body, userId);

      res.status(201).json({
        success: true,
        message: 'Adverse event report submitted successfully',
        data: event,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get adverse event by ID
   * GET /api/v2/eda/adverse-events/:id
   */
  static async getEventById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const event = await AdverseEventService.getById(id);

      res.json({
        success: true,
        data: event,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search adverse events
   * GET /api/v2/eda/adverse-events
   */
  static async searchEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        query,
        severity,
        status,
        medicineId,
        startDate,
        endDate,
        page,
        limit,
      } = req.query;

      const result = await AdverseEventService.search({
        query: query as string,
        severity: severity as string,
        status: status as string,
        medicineId: medicineId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      res.json({
        success: true,
        data: result.events,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update adverse event status
   * PUT /api/v2/eda/adverse-events/:id/status
   */
  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, ...metadata } = req.body;
      const userId = (req as any).user.id;

      const event = await AdverseEventService.updateStatus(id, status, userId, metadata);

      res.json({
        success: true,
        message: 'Adverse event status updated successfully',
        data: event,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get adverse event statistics
   * GET /api/v2/eda/adverse-events/statistics
   */
  static async getStatistics(req: Request, res: Response, next: NextFunction) {
    try {
      const { timeRange } = req.query;
      const stats = await AdverseEventService.getStatistics(timeRange as any);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

