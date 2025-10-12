// File: backend/src/services/tenants/routes/index.ts
// Purpose: Tenant and user management API routes

import { Router } from 'express';
import { requireRole } from '../../../shared/middleware/auth';
import { TenantController } from '../controllers/tenant.controller';
import { UserController } from '../controllers/user.controller';

const router = Router();

// Tenant Management Routes (Super Admin only)
router.post(
  '/tenants',
  requireRole('super_admin'),
  TenantController.create
);

router.get(
  '/tenants/statistics',
  requireRole('super_admin'),
  TenantController.getStatistics
);

router.get(
  '/tenants/slug/:slug',
  requireRole('super_admin', 'eda_officer', 'tenant_admin'),
  TenantController.getBySlug
);

router.get(
  '/tenants/:id',
  requireRole('super_admin', 'eda_officer', 'tenant_admin'),
  TenantController.getById
);

router.get(
  '/tenants',
  requireRole('super_admin', 'eda_officer'),
  TenantController.search
);

router.put(
  '/tenants/:id',
  requireRole('super_admin'),
  TenantController.update
);

router.delete(
  '/tenants/:id',
  requireRole('super_admin'),
  TenantController.delete
);

// User-Tenant Management Routes
router.post(
  '/tenants/:tenantId/users',
  requireRole('super_admin', 'tenant_admin'),
  UserController.addUserToTenant
);

router.delete(
  '/tenants/:tenantId/users/:userId',
  requireRole('super_admin', 'tenant_admin'),
  UserController.removeUserFromTenant
);

router.put(
  '/tenants/:tenantId/users/:userId/role',
  requireRole('super_admin', 'tenant_admin'),
  UserController.updateUserRole
);

router.get(
  '/tenants/:tenantId/users',
  requireRole('super_admin', 'tenant_admin'),
  UserController.getTenantUsers
);

router.get(
  '/users/:userId/tenants',
  requireRole('super_admin', 'tenant_admin'),
  UserController.getUserTenants
);

// Invitation Routes
router.post(
  '/tenants/:tenantId/invitations',
  requireRole('super_admin', 'tenant_admin'),
  UserController.createInvitation
);

router.post(
  '/invitations/:token/accept',
  UserController.acceptInvitation
);

// Permission Check Route
router.post(
  '/users/:userId/permissions/check',
  requireRole('super_admin', 'tenant_admin'),
  UserController.checkPermission
);

export default router;

