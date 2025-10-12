// File: backend/src/services/eda/controllers/medicine.controller.ts
// Purpose: Medicine directory API endpoints

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../../shared/middleware/auth';
import { MedicineService, Medicine } from '../services/medicine.service';
import { AppError } from '../../../shared/middleware/errorHandler';
import { AuditLogService } from '../services/auditLog.service';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export class MedicineController {
  /**
   * POST /api/v2/eda/medicines
   * Create a new medicine
   */
  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const medicine: Medicine = req.body;

      // Validate required fields
      if (!medicine.tradeName || !medicine.genericName || !medicine.edaRegistrationNumber) {
        throw new AppError('Missing required fields', 400);
      }

      // Validate dates
      if (new Date(medicine.registrationDate) > new Date()) {
        throw new AppError('Registration date cannot be in the future', 400);
      }

      if (new Date(medicine.expiryDate) <= new Date(medicine.registrationDate)) {
        throw new AppError('Expiry date must be after registration date', 400);
      }

      const created = await MedicineService.create(medicine, req.user!.id);

      // Audit log
      await AuditLogService.log({
        userId: req.user!.id,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: 'CREATE',
        resource: 'medicine',
        resourceId: created.id,
        changes: { medicine: created },
        success: true,
        phiAccessed: false,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({
        success: true,
        message: 'Medicine created successfully',
        data: created,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v2/eda/medicines/bulk
   * Bulk upload medicines from CSV/Excel
   */
  static async bulkUpload(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fileContent, fileType } = req.body;

      if (!fileContent || !fileType) {
        throw new AppError('Missing file content or type', 400);
      }

      let medicines: Medicine[] = [];

      // Parse based on file type
      if (fileType === 'csv') {
        const parsed = Papa.parse(fileContent, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
        });

        medicines = parsed.data.map((row: any) => this.mapRowToMedicine(row));
      } else if (fileType === 'excel') {
        const workbook = XLSX.read(fileContent, { type: 'base64' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);

        medicines = data.map((row: any) => this.mapRowToMedicine(row));
      } else {
        throw new AppError('Invalid file type. Must be csv or excel', 400);
      }

      // Validate all medicines
      const errors = this.validateMedicines(medicines);
      if (errors.length > 0) {
        res.status(400).json({
          success: false,
          message: 'Validation errors found',
          errors: errors.slice(0, 10), // Return first 10 errors
        });
        return;
      }

      // Import medicines
      const result = await MedicineService.bulkUpload(medicines, req.user!.id);

      // Audit log
      await AuditLogService.log({
        userId: req.user!.id,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: 'CREATE',
        resource: 'medicine_bulk',
        changes: { count: medicines.length, result },
        success: true,
        phiAccessed: false,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        message: `Bulk upload completed. ${result.success} succeeded, ${result.failed} failed.`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v2/eda/medicines/:id
   * Get medicine by ID
   */
  static async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const medicine = await MedicineService.getById(id, req.user!.id);

      res.json({
        success: true,
        data: medicine,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v2/eda/medicines
   * Search medicines
   */
  static async search(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        query,
        status,
        therapeuticClass,
        prescriptionRequired,
        page,
        limit,
      } = req.query;

      const result = await MedicineService.search({
        query: query as string,
        status: status as string,
        therapeuticClass: therapeuticClass as string,
        prescriptionRequired: prescriptionRequired === 'true' ? true : prescriptionRequired === 'false' ? false : undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      res.json({
        success: true,
        data: result.medicines,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v2/eda/medicines/:id
   * Update medicine
   */
  static async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const updates: Partial<Medicine> = req.body;

      const updated = await MedicineService.update(id, updates, req.user!.id);

      // Audit log
      await AuditLogService.log({
        userId: req.user!.id,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: 'UPDATE',
        resource: 'medicine',
        resourceId: id,
        changes: { updates },
        success: true,
        phiAccessed: false,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        message: 'Medicine updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v2/eda/medicines/:id
   * Delete medicine
   */
  static async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      await MedicineService.delete(id, req.user!.id);

      // Audit log
      await AuditLogService.log({
        userId: req.user!.id,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: 'DELETE',
        resource: 'medicine',
        resourceId: id,
        success: true,
        phiAccessed: false,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        message: 'Medicine deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Helper: Map CSV/Excel row to Medicine interface
   */
  private static mapRowToMedicine(row: any): Medicine {
    return {
      tradeName: row.tradeName || row.trade_name,
      genericName: row.genericName || row.generic_name,
      edaRegistrationNumber: row.edaRegistrationNumber || row.eda_registration_number,
      manufacturer: row.manufacturer,
      strength: row.strength,
      dosageForm: row.dosageForm || row.dosage_form,
      therapeuticClass: row.therapeuticClass || row.therapeutic_class,
      drugClass: row.drugClass || row.drug_class,
      atcCode: row.atcCode || row.atc_code,
      registrationDate: new Date(row.registrationDate || row.registration_date),
      expiryDate: new Date(row.expiryDate || row.expiry_date),
      prescriptionRequired: row.prescriptionRequired === 'true' || row.prescription_required === 'true',
      controlledSubstance: row.controlledSubstance === 'true' || row.controlled_substance === 'true',
      scheduleClass: row.scheduleClass || row.schedule_class,
      packagingSizes: row.packagingSizes ? row.packagingSizes.split(',') : undefined,
      storageConditions: row.storageConditions || row.storage_conditions,
      warnings: row.warnings ? row.warnings.split(',') : undefined,
      interactions: row.interactions ? row.interactions.split(',') : undefined,
      sideEffects: row.sideEffects ? row.sideEffects.split(',') : undefined,
      priceMin: row.priceMin ? parseFloat(row.priceMin) : undefined,
      priceMax: row.priceMax ? parseFloat(row.priceMax) : undefined,
    };
  }

  /**
   * Helper: Validate medicines array
   */
  private static validateMedicines(medicines: Medicine[]): any[] {
    const errors: any[] = [];

    for (let i = 0; i < medicines.length; i++) {
      const medicine = medicines[i];
      const rowErrors: string[] = [];

      if (!medicine.tradeName) rowErrors.push('Missing trade name');
      if (!medicine.genericName) rowErrors.push('Missing generic name');
      if (!medicine.edaRegistrationNumber) rowErrors.push('Missing EDA registration number');
      if (!medicine.registrationDate) rowErrors.push('Missing registration date');
      if (!medicine.expiryDate) rowErrors.push('Missing expiry date');

      if (rowErrors.length > 0) {
        errors.push({
          row: i + 1,
          edaNumber: medicine.edaRegistrationNumber,
          errors: rowErrors,
        });
      }
    }

    return errors;
  }
}

