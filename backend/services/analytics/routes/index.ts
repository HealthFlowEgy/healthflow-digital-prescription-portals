import { Router } from 'express';
import { authMiddleware, requireRole } from '../../../shared/middleware/auth';
import { requirePermission } from '../../../shared/middleware/permission';
import { AnalyticsController } from '../controllers/analytics.controller';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// ========== ANALYTICS ROUTES ==========
router.get(
  '/analytics/system',
  requireRole('super_admin', 'eda_officer'),
  AnalyticsController.getSystemMetrics
);

router.get(
  '/analytics/tenant/:tenantId',
  requirePermission('analytics:read'),
  AnalyticsController.getTenantMetrics
);

router.get(
  '/analytics/kpis',
  requirePermission('analytics:read'),
  AnalyticsController.getKPIs
);

// ========== REPORT ROUTES ==========
router.post(
  '/reports',
  requirePermission('reports:create'),
  AnalyticsController.createReport
);

router.post(
  '/reports/:id/execute',
  requirePermission('reports:execute'),
  AnalyticsController.executeReport
);

router.get(
  '/reports/executions/:id',
  requirePermission('reports:read'),
  AnalyticsController.getExecution
);

router.get(
  '/reports/executions/:id/download',
  requirePermission('reports:read'),
  AnalyticsController.downloadReport
);

router.post(
  '/reports/:id/schedule',
  requirePermission('reports:schedule'),
  AnalyticsController.scheduleReport
);

// ========== DATA EXPORT ROUTES ==========
router.post(
  '/exports',
  requirePermission('exports:create'),
  AnalyticsController.createExport
);

router.get(
  '/exports',
  requirePermission('exports:read'),
  AnalyticsController.listExports
);

router.get(
  '/exports/:id',
  requirePermission('exports:read'),
  AnalyticsController.getExport
);

router.get(
  '/exports/:id/download',
  requirePermission('exports:read'),
  AnalyticsController.downloadExport
);

router.delete(
  '/exports/:id',
  requirePermission('exports:delete'),
  AnalyticsController.deleteExport
);

export default router;