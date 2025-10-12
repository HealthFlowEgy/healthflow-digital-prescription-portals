// File: backend/src/services/tenants/controllers/user.controller.ts
// Purpose: API endpoints for user management

import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { logger } from '../../../shared/utils/logger';

export class UserController {
  /**
   * Add user to tenant
   * POST /api/v2/tenants/:tenantId/users
   */
  static async addUserToTenant(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = req.params;
      const { userId, roleId } = req.body;
      const invitedBy = (req as any).user.id;

      const userTenant = await UserService.addUserToTenant(
        userId,
        tenantId,
        roleId,
        invitedBy
      );

      res.status(201).json({
        success: true,
        message: 'User added to tenant successfully',
        data: userTenant,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove user from tenant
   * DELETE /api/v2/tenants/:tenantId/users/:userId
   */
  static async removeUserFromTenant(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, userId } = req.params;
      const removedBy = (req as any).user.id;

      await UserService.removeUserFromTenant(userId, tenantId, removedBy);

      res.json({
        success: true,
        message: 'User removed from tenant successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user role in tenant
   * PUT /api/v2/tenants/:tenantId/users/:userId/role
   */
  static async updateUserRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, userId } = req.params;
      const { roleId } = req.body;
      const updatedBy = (req as any).user.id;

      const userTenant = await UserService.updateUserRole(
        userId,
        tenantId,
        roleId,
        updatedBy
      );

      res.json({
        success: true,
        message: 'User role updated successfully',
        data: userTenant,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's tenants
   * GET /api/v2/users/:userId/tenants
   */
  static async getUserTenants(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const tenants = await UserService.getUserTenants(userId);

      res.json({
        success: true,
        data: tenants,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get tenant users
   * GET /api/v2/tenants/:tenantId/users
   */
  static async getTenantUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = req.params;
      const users = await UserService.getTenantUsers(tenantId);

      res.json({
        success: true,
        data: users,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create invitation
   * POST /api/v2/tenants/:tenantId/invitations
   */
  static async createInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = req.params;
      const { email, roleId } = req.body;
      const invitedBy = (req as any).user.id;

      const invitation = await UserService.createInvitation(
        { tenantId, email, roleId, invitedBy },
        invitedBy
      );

      res.status(201).json({
        success: true,
        message: 'Invitation created successfully',
        data: invitation,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Accept invitation
   * POST /api/v2/invitations/:token/accept
   */
  static async acceptInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;
      const userId = (req as any).user.id;

      const userTenant = await UserService.acceptInvitation(token, userId);

      res.json({
        success: true,
        message: 'Invitation accepted successfully',
        data: userTenant,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check user permission
   * POST /api/v2/users/:userId/permissions/check
   */
  static async checkPermission(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const { tenantId, permission } = req.body;

      const hasPermission = await UserService.hasPermission(
        userId,
        tenantId,
        permission
      );

      res.json({
        success: true,
        data: { hasPermission },
      });
    } catch (error) {
      next(error);
    }
  }
}

