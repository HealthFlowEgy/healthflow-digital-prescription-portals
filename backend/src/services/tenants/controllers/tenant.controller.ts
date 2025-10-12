// File: backend/src/services/tenants/controllers/tenant.controller.ts
// Purpose: API endpoints for tenant management

import { Request, Response, NextFunction } from 'express';
import { TenantService } from '../services/tenant.service';
import { logger } from '../../../shared/utils/logger';

export class TenantController {
  /**
   * Create a new tenant
   * POST /api/v2/tenants
   */
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const tenant = await TenantService.create(req.body, userId);

      res.status(201).json({
        success: true,
        message: 'Tenant created successfully',
        data: tenant,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get tenant by ID
   * GET /api/v2/tenants/:id
   */
  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const tenant = await TenantService.getById(id);

      res.json({
        success: true,
        data: tenant,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get tenant by slug
   * GET /api/v2/tenants/slug/:slug
   */
  static async getBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const { slug } = req.params;
      const tenant = await TenantService.getBySlug(slug);

      res.json({
        success: true,
        data: tenant,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search tenants
   * GET /api/v2/tenants
   */
  static async search(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        query,
        type,
        status,
        subscriptionTier,
        page,
        limit,
      } = req.query;

      const result = await TenantService.search({
        query: query as string,
        type: type as string,
        status: status as string,
        subscriptionTier: subscriptionTier as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      res.json({
        success: true,
        data: result.tenants,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update tenant
   * PUT /api/v2/tenants/:id
   */
  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;

      const tenant = await TenantService.update(id, req.body, userId);

      res.json({
        success: true,
        message: 'Tenant updated successfully',
        data: tenant,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete tenant
   * DELETE /api/v2/tenants/:id
   */
  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;

      await TenantService.delete(id, userId);

      res.json({
        success: true,
        message: 'Tenant deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get tenant statistics
   * GET /api/v2/tenants/statistics
   */
  static async getStatistics(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await TenantService.getStatistics();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

