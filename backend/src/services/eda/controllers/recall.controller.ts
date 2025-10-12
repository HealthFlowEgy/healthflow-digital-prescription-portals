// File: backend/src/services/eda/controllers/recall.controller.ts
// Purpose: API endpoints for recall management

import { Request, Response, NextFunction } from 'express';
import { RecallService } from '../services/recall.service';
import { logger } from '../../../shared/utils/logger';

export class RecallController {
  /**
   * Initiate a new recall
   * POST /api/v2/eda/recalls
   */
  static async initiateRecall(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const recall = await RecallService.initiateRecall(req.body, userId);

      res.status(201).json({
        success: true,
        message: 'Recall initiated successfully',
        data: recall,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get recall by ID
   * GET /api/v2/eda/recalls/:id
   */
  static async getRecallById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const recall = await RecallService.getById(id);

      res.json({
        success: true,
        data: recall,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search recalls
   * GET /api/v2/eda/recalls
   */
  static async searchRecalls(req: Request, res: Response, next: NextFunction) {
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

      const result = await RecallService.search({
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
        data: result.recalls,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update recall status
   * PUT /api/v2/eda/recalls/:id/status
   */
  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, ...metadata } = req.body;
      const userId = (req as any).user.id;

      const recall = await RecallService.updateStatus(id, status, userId, metadata);

      res.json({
        success: true,
        message: 'Recall status updated successfully',
        data: recall,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get recall statistics
   * GET /api/v2/eda/recalls/statistics
   */
  static async getStatistics(req: Request, res: Response, next: NextFunction) {
    try {
      const { timeRange } = req.query;
      const stats = await RecallService.getStatistics(timeRange as any);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

