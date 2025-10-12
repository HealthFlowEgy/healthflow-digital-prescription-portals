// File: backend/src/services/eda/routes/index.ts
// Purpose: EDA portal API routes

import { Router } from 'express';
import { requireRole } from '../../../shared/middleware/auth';
import { AuditLogController } from '../controllers/auditLog.controller';

const router = Router();

// Audit Log Routes (EDA Officers and Admins only)
router.get(
  '/audit/logs',
  requireRole('eda_officer', 'eda_admin', 'system_admin'),
  AuditLogController.search
);

router.get(
  '/audit/phi-access',
  requireRole('eda_officer', 'eda_admin', 'system_admin'),
  AuditLogController.getPhiAccessSummary
);

router.get(
  '/audit/anomalies',
  requireRole('eda_admin', 'system_admin'),
  AuditLogController.detectAnomalies
);

router.post(
  '/audit/export',
  requireRole('eda_officer', 'eda_admin', 'system_admin'),
  AuditLogController.export
);

// Medicine Directory Routes (EDA Officers and Admins only)
import { MedicineController } from '../controllers/medicine.controller';

router.post(
  '/medicines',
  requireRole('eda_officer', 'eda_admin', 'system_admin'),
  MedicineController.create
);

router.post(
  '/medicines/bulk',
  requireRole('eda_officer', 'eda_admin', 'system_admin'),
  MedicineController.bulkUpload
);

router.get(
  '/medicines/:id',
  requireRole('eda_officer', 'eda_admin', 'system_admin', 'pharmacist', 'prescriber'),
  MedicineController.getById
);

router.get(
  '/medicines',
  requireRole('eda_officer', 'eda_admin', 'system_admin', 'pharmacist', 'prescriber'),
  MedicineController.search
);

router.put(
  '/medicines/:id',
  requireRole('eda_officer', 'eda_admin', 'system_admin'),
  MedicineController.update
);

router.delete(
  '/medicines/:id',
  requireRole('eda_admin', 'system_admin'),
  MedicineController.delete
);

export default router;

