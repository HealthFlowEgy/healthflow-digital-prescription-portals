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

// Recall Management Routes (Sprint 2)
import { RecallController } from '../controllers/recall.controller';

router.post(
  '/recalls',
  requireRole('eda_officer', 'eda_admin', 'system_admin'),
  RecallController.initiateRecall
);

router.get(
  '/recalls/statistics',
  requireRole('eda_officer', 'eda_admin', 'system_admin'),
  RecallController.getStatistics
);

router.get(
  '/recalls/:id',
  requireRole('eda_officer', 'eda_admin', 'system_admin', 'pharmacist', 'prescriber'),
  RecallController.getRecallById
);

router.get(
  '/recalls',
  requireRole('eda_officer', 'eda_admin', 'system_admin', 'pharmacist', 'prescriber'),
  RecallController.searchRecalls
);

router.put(
  '/recalls/:id/status',
  requireRole('eda_officer', 'eda_admin', 'system_admin'),
  RecallController.updateStatus
);

// Adverse Event Reporting Routes (Sprint 2)
import { AdverseEventController } from '../controllers/adverseEvent.controller';

router.post(
  '/adverse-events',
  requireRole('eda_officer', 'eda_admin', 'system_admin', 'doctor', 'pharmacist'),
  AdverseEventController.submitReport
);

router.get(
  '/adverse-events/statistics',
  requireRole('eda_officer', 'eda_admin', 'system_admin'),
  AdverseEventController.getStatistics
);

router.get(
  '/adverse-events/:id',
  requireRole('eda_officer', 'eda_admin', 'system_admin'),
  AdverseEventController.getEventById
);

router.get(
  '/adverse-events',
  requireRole('eda_officer', 'eda_admin', 'system_admin'),
  AdverseEventController.searchEvents
);

router.put(
  '/adverse-events/:id/status',
  requireRole('eda_officer', 'eda_admin', 'system_admin'),
  AdverseEventController.updateStatus
);

export default router;

