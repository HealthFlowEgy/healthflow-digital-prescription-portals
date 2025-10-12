// File: backend/src/services/tenants/services/user.service.ts
// Purpose: User management with multi-tenancy and RBAC

import { db, withTransaction } from '../../../shared/database/connection';
import { cache } from '../../../shared/cache/redis';
import { logger } from '../../../shared/utils/logger';
import { AppError } from '../../../shared/middleware/errorHandler';
import { AuditLogService } from '../../eda/services/auditLog.service';
import crypto from 'crypto';

export interface UserTenant {
  id?: string;
  userId: string;
  tenantId: string;
  roleId: string;
  status?: 'active' | 'inactive' | 'invited' | 'suspended';
  joinedAt?: Date | string;
  lastActiveAt?: Date | string;
  invitedBy?: string;
  invitedAt?: Date | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface Invitation {
  id?: string;
  tenantId: string;
  email: string;
  roleId: string;
  token?: string;
  status?: 'pending' | 'accepted' | 'expired' | 'revoked';
  invitedBy: string;
  invitedAt?: Date | string;
  expiresAt: Date | string;
  acceptedAt?: Date | string;
  acceptedBy?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export class UserService {
  /**
   * Add user to tenant
   */
  static async addUserToTenant(
    userId: string,
    tenantId: string,
    roleId: string,
    invitedBy: string
  ): Promise<UserTenant> {
    return withTransaction(async (trx) => {
      // Check if user already belongs to tenant
      const existing = await trx('portal.user_tenants')
        .where({ user_id: userId, tenant_id: tenantId })
        .first();

      if (existing) {
        throw new AppError('User already belongs to this tenant', 400);
      }

      // Verify tenant exists
      const tenant = await trx('portal.tenants')
        .where({ id: tenantId })
        .first();

      if (!tenant) {
        throw new AppError('Tenant not found', 404);
      }

      // Verify role exists and belongs to tenant
      const role = await trx('portal.roles')
        .where({ id: roleId })
        .where((builder) => {
          builder.where({ tenant_id: tenantId }).orWhere({ scope: 'system' });
        })
        .first();

      if (!role) {
        throw new AppError('Role not found or does not belong to tenant', 404);
      }

      // Check user limit
      if (tenant.current_users >= tenant.max_users) {
        throw new AppError('Tenant has reached maximum user limit', 400);
      }

      // Insert user-tenant relationship
      const [created] = await trx('portal.user_tenants')
        .insert({
          user_id: userId,
          tenant_id: tenantId,
          role_id: roleId,
          status: 'active',
          joined_at: new Date(),
          invited_by: invitedBy,
          invited_at: new Date(),
        })
        .returning('*');

      // Update tenant user count
      await trx('portal.tenants')
        .where({ id: tenantId })
        .increment('current_users', 1);

      // Clear cache
      await cache.del(`user:${userId}:tenants`);
      await cache.del(`tenant:${tenantId}:users`);

      // Audit log
      await AuditLogService.log({
        userId: invitedBy,
        userEmail: 'system',
        userRole: 'super_admin',
        action: 'CREATE',
        resource: 'user_tenant',
        resourceId: created.id,
        changes: { userId, tenantId, roleId },
        success: true,
      });

      logger.info(`User ${userId} added to tenant ${tenantId} with role ${roleId}`);

      return this.mapToUserTenant(created);
    });
  }

  /**
   * Remove user from tenant
   */
  static async removeUserFromTenant(
    userId: string,
    tenantId: string,
    removedBy: string
  ): Promise<void> {
    return withTransaction(async (trx) => {
      const userTenant = await trx('portal.user_tenants')
        .where({ user_id: userId, tenant_id: tenantId })
        .first();

      if (!userTenant) {
        throw new AppError('User does not belong to this tenant', 404);
      }

      await trx('portal.user_tenants')
        .where({ user_id: userId, tenant_id: tenantId })
        .delete();

      // Update tenant user count
      await trx('portal.tenants')
        .where({ id: tenantId })
        .decrement('current_users', 1);

      // Clear cache
      await cache.del(`user:${userId}:tenants`);
      await cache.del(`tenant:${tenantId}:users`);

      // Audit log
      await AuditLogService.log({
        userId: removedBy,
        userEmail: 'system',
        userRole: 'super_admin',
        action: 'DELETE',
        resource: 'user_tenant',
        resourceId: userTenant.id,
        changes: { userId, tenantId },
        success: true,
      });

      logger.info(`User ${userId} removed from tenant ${tenantId}`);
    });
  }

  /**
   * Update user role in tenant
   */
  static async updateUserRole(
    userId: string,
    tenantId: string,
    roleId: string,
    updatedBy: string
  ): Promise<UserTenant> {
    return withTransaction(async (trx) => {
      const userTenant = await trx('portal.user_tenants')
        .where({ user_id: userId, tenant_id: tenantId })
        .first();

      if (!userTenant) {
        throw new AppError('User does not belong to this tenant', 404);
      }

      // Verify role exists
      const role = await trx('portal.roles')
        .where({ id: roleId })
        .where((builder) => {
          builder.where({ tenant_id: tenantId }).orWhere({ scope: 'system' });
        })
        .first();

      if (!role) {
        throw new AppError('Role not found or does not belong to tenant', 404);
      }

      const [updated] = await trx('portal.user_tenants')
        .where({ user_id: userId, tenant_id: tenantId })
        .update({
          role_id: roleId,
          updated_at: new Date(),
        })
        .returning('*');

      // Clear cache
      await cache.del(`user:${userId}:tenants`);
      await cache.del(`tenant:${tenantId}:users`);

      // Audit log
      await AuditLogService.log({
        userId: updatedBy,
        userEmail: 'system',
        userRole: 'super_admin',
        action: 'UPDATE',
        resource: 'user_tenant',
        resourceId: userTenant.id,
        changes: { roleId },
        success: true,
      });

      return this.mapToUserTenant(updated);
    });
  }

  /**
   * Get user's tenants
   */
  static async getUserTenants(userId: string): Promise<any[]> {
    const cacheKey = `user:${userId}:tenants`;
    const cached = await cache.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const tenants = await db('portal.user_tenants')
      .select(
        'portal.user_tenants.*',
        'portal.tenants.name as tenant_name',
        'portal.tenants.slug as tenant_slug',
        'portal.tenants.type as tenant_type',
        'portal.roles.name as role_name',
        'portal.roles.slug as role_slug',
        'portal.roles.permissions as permissions'
      )
      .leftJoin('portal.tenants', 'portal.user_tenants.tenant_id', 'portal.tenants.id')
      .leftJoin('portal.roles', 'portal.user_tenants.role_id', 'portal.roles.id')
      .where({ 'portal.user_tenants.user_id': userId })
      .where({ 'portal.user_tenants.status': 'active' });

    await cache.set(cacheKey, JSON.stringify(tenants), 3600);

    return tenants;
  }

  /**
   * Get tenant users
   */
  static async getTenantUsers(tenantId: string): Promise<any[]> {
    const cacheKey = `tenant:${tenantId}:users`;
    const cached = await cache.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const users = await db('portal.user_tenants')
      .select(
        'portal.user_tenants.*',
        'portal.roles.name as role_name',
        'portal.roles.slug as role_slug'
      )
      .leftJoin('portal.roles', 'portal.user_tenants.role_id', 'portal.roles.id')
      .where({ 'portal.user_tenants.tenant_id': tenantId });

    await cache.set(cacheKey, JSON.stringify(users), 3600);

    return users;
  }

  /**
   * Create invitation
   */
  static async createInvitation(
    invitation: Invitation,
    invitedBy: string
  ): Promise<Invitation> {
    return withTransaction(async (trx) => {
      // Generate token
      const token = crypto.randomBytes(32).toString('hex');

      // Set expiry (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const [created] = await trx('portal.invitations')
        .insert({
          tenant_id: invitation.tenantId,
          email: invitation.email,
          role_id: invitation.roleId,
          token,
          status: 'pending',
          invited_by: invitedBy,
          invited_at: new Date(),
          expires_at: expiresAt,
        })
        .returning('*');

      // Audit log
      await AuditLogService.log({
        userId: invitedBy,
        userEmail: 'system',
        userRole: 'super_admin',
        action: 'CREATE',
        resource: 'invitation',
        resourceId: created.id,
        changes: { email: invitation.email, tenantId: invitation.tenantId },
        success: true,
      });

      logger.info(`Invitation created for ${invitation.email} to tenant ${invitation.tenantId}`);

      return this.mapToInvitation(created);
    });
  }

  /**
   * Accept invitation
   */
  static async acceptInvitation(token: string, userId: string): Promise<UserTenant> {
    return withTransaction(async (trx) => {
      const invitation = await trx('portal.invitations')
        .where({ token })
        .where({ status: 'pending' })
        .first();

      if (!invitation) {
        throw new AppError('Invalid or expired invitation', 404);
      }

      // Check if expired
      if (new Date(invitation.expires_at) < new Date()) {
        await trx('portal.invitations')
          .where({ id: invitation.id })
          .update({ status: 'expired' });

        throw new AppError('Invitation has expired', 400);
      }

      // Add user to tenant
      const userTenant = await this.addUserToTenant(
        userId,
        invitation.tenant_id,
        invitation.role_id,
        invitation.invited_by
      );

      // Update invitation status
      await trx('portal.invitations')
        .where({ id: invitation.id })
        .update({
          status: 'accepted',
          accepted_at: new Date(),
          accepted_by: userId,
        });

      logger.info(`Invitation accepted by user ${userId}`);

      return userTenant;
    });
  }

  /**
   * Check user permission
   */
  static async hasPermission(
    userId: string,
    tenantId: string,
    permission: string
  ): Promise<boolean> {
    const userTenants = await this.getUserTenants(userId);
    const userTenant = userTenants.find(ut => ut.tenant_id === tenantId);

    if (!userTenant) {
      return false;
    }

    const permissions: string[] = userTenant.permissions || [];

    // Check for wildcard permissions
    if (permissions.includes('system:*')) {
      return true;
    }

    // Check for exact match
    if (permissions.includes(permission)) {
      return true;
    }

    // Check for category wildcard (e.g., 'medicines:*' matches 'medicines:read')
    const [category] = permission.split(':');
    if (permissions.includes(`${category}:*`)) {
      return true;
    }

    return false;
  }

  /**
   * Map database row to UserTenant object
   */
  private static mapToUserTenant(row: any): UserTenant {
    return {
      id: row.id,
      userId: row.user_id,
      tenantId: row.tenant_id,
      roleId: row.role_id,
      status: row.status,
      joinedAt: row.joined_at,
      lastActiveAt: row.last_active_at,
      invitedBy: row.invited_by,
      invitedAt: row.invited_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map database row to Invitation object
   */
  private static mapToInvitation(row: any): Invitation {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      email: row.email,
      roleId: row.role_id,
      token: row.token,
      status: row.status,
      invitedBy: row.invited_by,
      invitedAt: row.invited_at,
      expiresAt: row.expires_at,
      acceptedAt: row.accepted_at,
      acceptedBy: row.accepted_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

