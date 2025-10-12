// File: backend/src/services/tenants/services/tenant.service.ts
// Purpose: Complete tenant management system

import { db, withTransaction } from '../../../shared/database/connection';
import { cache } from '../../../shared/cache/redis';
import { logger } from '../../../shared/utils/logger';
import { AppError } from '../../../shared/middleware/errorHandler';
import { AuditLogService } from '../../eda/services/auditLog.service';

export interface Tenant {
  id?: string;
  name: string;
  slug: string;
  type: 'hospital' | 'clinic' | 'pharmacy' | 'regulatory_agency' | 'eda';
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  governorate?: string;
  postalCode?: string;
  country?: string;
  licenseNumber?: string;
  licenseExpiry?: Date | string;
  licenseStatus?: 'active' | 'expired' | 'suspended' | 'revoked';
  settings?: any;
  featuresEnabled?: any;
  subscriptionTier?: 'basic' | 'professional' | 'enterprise';
  maxUsers?: number;
  currentUsers?: number;
  status?: 'active' | 'suspended' | 'inactive' | 'pending_approval';
  suspensionReason?: string;
  suspendedAt?: Date | string;
  createdBy?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface TenantStatistics {
  totalTenants: number;
  activeTenants: number;
  byType: { [key: string]: number };
  bySubscriptionTier: { [key: string]: number };
  totalUsers: number;
  averageUsersPerTenant: number;
}

export class TenantService {
  /**
   * Create a new tenant
   */
  static async create(tenant: Tenant, userId: string): Promise<Tenant> {
    return withTransaction(async (trx) => {
      // Generate slug if not provided
      if (!tenant.slug) {
        tenant.slug = this.generateSlug(tenant.name);
      }

      // Check if slug already exists
      const existing = await trx('portal.tenants')
        .where({ slug: tenant.slug })
        .first();

      if (existing) {
        throw new AppError('Tenant slug already exists', 400);
      }

      // Insert tenant
      const [created] = await trx('portal.tenants')
        .insert({
          name: tenant.name,
          slug: tenant.slug,
          type: tenant.type,
          primary_contact_name: tenant.primaryContactName,
          primary_contact_email: tenant.primaryContactEmail,
          primary_contact_phone: tenant.primaryContactPhone,
          address_line1: tenant.addressLine1,
          address_line2: tenant.addressLine2,
          city: tenant.city,
          governorate: tenant.governorate,
          postal_code: tenant.postalCode,
          country: tenant.country || 'Egypt',
          license_number: tenant.licenseNumber,
          license_expiry: tenant.licenseExpiry,
          license_status: tenant.licenseStatus || 'active',
          settings: tenant.settings || {},
          features_enabled: tenant.featuresEnabled || {},
          subscription_tier: tenant.subscriptionTier || 'basic',
          max_users: tenant.maxUsers || 10,
          current_users: 0,
          status: tenant.status || 'pending_approval',
          created_by: userId,
        })
        .returning('*');

      // Clear cache
      await cache.del('tenants:all');

      // Audit log
      await AuditLogService.log({
        userId,
        userEmail: 'system',
        userRole: 'super_admin',
        action: 'CREATE',
        resource: 'tenant',
        resourceId: created.id,
        changes: { tenant: created },
        success: true,
      });

      logger.info(`Tenant created: ${created.name} (${created.slug})`);

      return this.mapToTenant(created);
    });
  }

  /**
   * Get tenant by ID
   */
  static async getById(id: string): Promise<Tenant> {
    const cacheKey = `tenant:${id}`;
    const cached = await cache.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const tenant = await db('portal.tenants')
      .where({ id })
      .whereNull('deleted_at')
      .first();

    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    const mapped = this.mapToTenant(tenant);
    await cache.set(cacheKey, JSON.stringify(mapped), 3600);

    return mapped;
  }

  /**
   * Get tenant by slug
   */
  static async getBySlug(slug: string): Promise<Tenant> {
    const cacheKey = `tenant:slug:${slug}`;
    const cached = await cache.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const tenant = await db('portal.tenants')
      .where({ slug })
      .whereNull('deleted_at')
      .first();

    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    const mapped = this.mapToTenant(tenant);
    await cache.set(cacheKey, JSON.stringify(mapped), 3600);

    return mapped;
  }

  /**
   * Search tenants
   */
  static async search(params: {
    query?: string;
    type?: string;
    status?: string;
    subscriptionTier?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      query,
      type,
      status,
      subscriptionTier,
      page = 1,
      limit = 50,
    } = params;

    const dbQuery = db('portal.tenants')
      .whereNull('deleted_at');

    if (query) {
      dbQuery.where((builder) => {
        builder
          .where('name', 'ilike', `%${query}%`)
          .orWhere('slug', 'ilike', `%${query}%`)
          .orWhere('license_number', 'ilike', `%${query}%`);
      });
    }

    if (type) {
      dbQuery.where('type', type);
    }

    if (status) {
      dbQuery.where('status', status);
    }

    if (subscriptionTier) {
      dbQuery.where('subscription_tier', subscriptionTier);
    }

    // Get total count
    const countQuery = dbQuery.clone();
    const [{ count }] = await countQuery.count('* as count');

    // Pagination
    const offset = (page - 1) * limit;
    const tenants = await dbQuery
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return {
      tenants: tenants.map(t => this.mapToTenant(t)),
      pagination: {
        total: parseInt(count as string),
        page,
        pages: Math.ceil(parseInt(count as string) / limit),
        limit,
      },
    };
  }

  /**
   * Update tenant
   */
  static async update(
    id: string,
    updates: Partial<Tenant>,
    userId: string
  ): Promise<Tenant> {
    return withTransaction(async (trx) => {
      const existing = await trx('portal.tenants')
        .where({ id })
        .whereNull('deleted_at')
        .first();

      if (!existing) {
        throw new AppError('Tenant not found', 404);
      }

      const updateData: any = {
        updated_at: new Date(),
      };

      if (updates.name) updateData.name = updates.name;
      if (updates.primaryContactName) updateData.primary_contact_name = updates.primaryContactName;
      if (updates.primaryContactEmail) updateData.primary_contact_email = updates.primaryContactEmail;
      if (updates.primaryContactPhone) updateData.primary_contact_phone = updates.primaryContactPhone;
      if (updates.addressLine1) updateData.address_line1 = updates.addressLine1;
      if (updates.addressLine2) updateData.address_line2 = updates.addressLine2;
      if (updates.city) updateData.city = updates.city;
      if (updates.governorate) updateData.governorate = updates.governorate;
      if (updates.postalCode) updateData.postal_code = updates.postalCode;
      if (updates.licenseNumber) updateData.license_number = updates.licenseNumber;
      if (updates.licenseExpiry) updateData.license_expiry = updates.licenseExpiry;
      if (updates.licenseStatus) updateData.license_status = updates.licenseStatus;
      if (updates.settings) updateData.settings = updates.settings;
      if (updates.featuresEnabled) updateData.features_enabled = updates.featuresEnabled;
      if (updates.subscriptionTier) updateData.subscription_tier = updates.subscriptionTier;
      if (updates.maxUsers) updateData.max_users = updates.maxUsers;
      if (updates.status) updateData.status = updates.status;

      const [updated] = await trx('portal.tenants')
        .where({ id })
        .update(updateData)
        .returning('*');

      // Clear cache
      await cache.del(`tenant:${id}`);
      await cache.del(`tenant:slug:${updated.slug}`);
      await cache.del('tenants:all');

      // Audit log
      await AuditLogService.log({
        userId,
        userEmail: 'system',
        userRole: 'super_admin',
        action: 'UPDATE',
        resource: 'tenant',
        resourceId: id,
        changes: { updates },
        success: true,
      });

      return this.mapToTenant(updated);
    });
  }

  /**
   * Delete tenant (soft delete)
   */
  static async delete(id: string, userId: string): Promise<void> {
    return withTransaction(async (trx) => {
      const tenant = await trx('portal.tenants')
        .where({ id })
        .whereNull('deleted_at')
        .first();

      if (!tenant) {
        throw new AppError('Tenant not found', 404);
      }

      await trx('portal.tenants')
        .where({ id })
        .update({
          deleted_at: new Date(),
          status: 'inactive',
        });

      // Clear cache
      await cache.del(`tenant:${id}`);
      await cache.del(`tenant:slug:${tenant.slug}`);
      await cache.del('tenants:all');

      // Audit log
      await AuditLogService.log({
        userId,
        userEmail: 'system',
        userRole: 'super_admin',
        action: 'DELETE',
        resource: 'tenant',
        resourceId: id,
        changes: {},
        success: true,
      });

      logger.info(`Tenant deleted: ${tenant.name}`);
    });
  }

  /**
   * Get tenant statistics
   */
  static async getStatistics(): Promise<TenantStatistics> {
    const cacheKey = 'tenants:statistics';
    const cached = await cache.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Total tenants
    const [{ count: totalTenants }] = await db('portal.tenants')
      .whereNull('deleted_at')
      .count('* as count');

    // Active tenants
    const [{ count: activeTenants }] = await db('portal.tenants')
      .where({ status: 'active' })
      .whereNull('deleted_at')
      .count('* as count');

    // By type
    const typeStats = await db('portal.tenants')
      .select('type')
      .count('* as count')
      .whereNull('deleted_at')
      .groupBy('type');

    const byType: any = {};
    typeStats.forEach((row: any) => {
      byType[row.type] = parseInt(row.count);
    });

    // By subscription tier
    const tierStats = await db('portal.tenants')
      .select('subscription_tier')
      .count('* as count')
      .whereNull('deleted_at')
      .groupBy('subscription_tier');

    const bySubscriptionTier: any = {};
    tierStats.forEach((row: any) => {
      bySubscriptionTier[row.subscription_tier] = parseInt(row.count);
    });

    // Total users
    const [{ count: totalUsers }] = await db('portal.user_tenants')
      .count('* as count');

    const statistics: TenantStatistics = {
      totalTenants: parseInt(totalTenants as string),
      activeTenants: parseInt(activeTenants as string),
      byType,
      bySubscriptionTier,
      totalUsers: parseInt(totalUsers as string),
      averageUsersPerTenant: parseInt(totalTenants as string) > 0
        ? Math.round(parseInt(totalUsers as string) / parseInt(totalTenants as string))
        : 0,
    };

    await cache.set(cacheKey, JSON.stringify(statistics), 300);

    return statistics;
  }

  /**
   * Generate slug from name
   */
  private static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Map database row to Tenant object
   */
  private static mapToTenant(row: any): Tenant {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      type: row.type,
      primaryContactName: row.primary_contact_name,
      primaryContactEmail: row.primary_contact_email,
      primaryContactPhone: row.primary_contact_phone,
      addressLine1: row.address_line1,
      addressLine2: row.address_line2,
      city: row.city,
      governorate: row.governorate,
      postalCode: row.postal_code,
      country: row.country,
      licenseNumber: row.license_number,
      licenseExpiry: row.license_expiry,
      licenseStatus: row.license_status,
      settings: row.settings,
      featuresEnabled: row.features_enabled,
      subscriptionTier: row.subscription_tier,
      maxUsers: row.max_users,
      currentUsers: row.current_users,
      status: row.status,
      suspensionReason: row.suspension_reason,
      suspendedAt: row.suspended_at,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

