// File: backend/src/services/eda/services/medicine.service.ts
// Purpose: Medicine directory CRUD operations

import { db, withTransaction } from '../../../shared/database/connection';
import { cache } from '../../../shared/cache/redis';
import { logger } from '../../../shared/utils/logger';
import { AppError } from '../../../shared/middleware/errorHandler';
import { AuditLogService } from './auditLog.service';
import { esClient } from '../../../shared/search/elasticsearch';
import { config } from '../../../config';

export interface Medicine {
  id?: string;
  tradeName: string;
  genericName: string;
  edaRegistrationNumber: string;
  manufacturer?: string;
  strength?: string;
  dosageForm?: string;
  therapeuticClass?: string;
  drugClass?: string;
  atcCode?: string;
  registrationDate: Date;
  expiryDate: Date;
  status?: 'active' | 'partial_disabled' | 'permanently_disabled' | 'recalled';
  availableForPrescription?: boolean;
  availableForDispensing?: boolean;
  prescriptionRequired?: boolean;
  controlledSubstance?: boolean;
  scheduleClass?: string;
  disableReason?: string;
  disabledAt?: Date;
  recallInfo?: any;
  packagingSizes?: string[];
  storageConditions?: string;
  warnings?: string[];
  interactions?: string[];
  sideEffects?: string[];
  priceMin?: number;
  priceMax?: number;
  createdBy?: string;
  lastModifiedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class MedicineService {
  /**
   * Create a new medicine
   */
  static async create(medicine: Medicine, userId: string): Promise<Medicine> {
    return withTransaction(async (trx) => {
      // Check if EDA number already exists
      const existing = await trx('portal.medicines')
        .where('eda_registration_number', medicine.edaRegistrationNumber)
        .first();

      if (existing) {
        throw new AppError('Medicine with this EDA registration number already exists', 409);
      }

      // Insert medicine
      const [created] = await trx('portal.medicines')
        .insert({
          trade_name: medicine.tradeName,
          generic_name: medicine.genericName,
          eda_registration_number: medicine.edaRegistrationNumber,
          manufacturer: medicine.manufacturer,
          strength: medicine.strength,
          dosage_form: medicine.dosageForm,
          therapeutic_class: medicine.therapeuticClass,
          drug_class: medicine.drugClass,
          atc_code: medicine.atcCode,
          registration_date: medicine.registrationDate,
          expiry_date: medicine.expiryDate,
          status: 'active',
          available_for_prescription: true,
          available_for_dispensing: true,
          prescription_required: medicine.prescriptionRequired ?? true,
          controlled_substance: medicine.controlledSubstance ?? false,
          schedule_class: medicine.scheduleClass,
          packaging_sizes: medicine.packagingSizes,
          storage_conditions: medicine.storageConditions,
          warnings: medicine.warnings,
          interactions: medicine.interactions,
          side_effects: medicine.sideEffects,
          price_min: medicine.priceMin,
          price_max: medicine.priceMax,
          created_by: userId,
          last_modified_by: userId,
        })
        .returning('*');

      // Index in Elasticsearch
      await this.indexMedicine(created);

      // Invalidate cache
      await cache.invalidatePattern('medicines:*');

      logger.info(`Medicine created: ${created.id} - ${created.trade_name}`);

      return this.mapToMedicine(created);
    });
  }

  /**
   * Get medicine by ID
   */
  static async getById(id: string, userId: string): Promise<Medicine> {
    // Try cache first
    const cacheKey = `medicines:${id}`;
    const cached = await cache.get<Medicine>(cacheKey);
    if (cached) {
      return cached;
    }

    const medicine = await db('portal.medicines')
      .where('id', id)
      .first();

    if (!medicine) {
      throw new AppError('Medicine not found', 404);
    }

    const mapped = this.mapToMedicine(medicine);

    // Cache for 1 hour
    await cache.set(cacheKey, mapped, 3600);

    return mapped;
  }

  /**
   * Search medicines
   */
  static async search(params: {
    query?: string;
    status?: string;
    therapeuticClass?: string;
    prescriptionRequired?: boolean;
    page?: number;
    limit?: number;
  }) {
    const {
      query,
      status,
      therapeuticClass,
      prescriptionRequired,
      page = 1,
      limit = 50,
    } = params;

    // Build query
    const dbQuery = db('portal.medicines').select('*');

    // Full-text search
    if (query) {
      dbQuery.whereRaw(
        `to_tsvector('english', trade_name || ' ' || generic_name || ' ' || COALESCE(manufacturer, '')) @@ plainto_tsquery('english', ?)`,
        [query]
      );
    }

    if (status) {
      dbQuery.where('status', status);
    }

    if (therapeuticClass) {
      dbQuery.where('therapeutic_class', therapeuticClass);
    }

    if (prescriptionRequired !== undefined) {
      dbQuery.where('prescription_required', prescriptionRequired);
    }

    // Get total count
    const countQuery = dbQuery.clone();
    const [{ count }] = await countQuery.count('* as count');

    // Pagination
    const offset = (page - 1) * limit;
    const medicines = await dbQuery
      .orderBy('trade_name', 'asc')
      .limit(limit)
      .offset(offset);

    return {
      medicines: medicines.map(m => this.mapToMedicine(m)),
      pagination: {
        total: parseInt(count as string),
        page,
        pages: Math.ceil(parseInt(count as string) / limit),
        limit,
      },
    };
  }

  /**
   * Update medicine
   */
  static async update(id: string, updates: Partial<Medicine>, userId: string): Promise<Medicine> {
    return withTransaction(async (trx) => {
      const existing = await trx('portal.medicines')
        .where('id', id)
        .first();

      if (!existing) {
        throw new AppError('Medicine not found', 404);
      }

      const [updated] = await trx('portal.medicines')
        .where('id', id)
        .update({
          trade_name: updates.tradeName,
          generic_name: updates.genericName,
          manufacturer: updates.manufacturer,
          strength: updates.strength,
          dosage_form: updates.dosageForm,
          therapeutic_class: updates.therapeuticClass,
          drug_class: updates.drugClass,
          atc_code: updates.atcCode,
          expiry_date: updates.expiryDate,
          prescription_required: updates.prescriptionRequired,
          controlled_substance: updates.controlledSubstance,
          schedule_class: updates.scheduleClass,
          packaging_sizes: updates.packagingSizes,
          storage_conditions: updates.storageConditions,
          warnings: updates.warnings,
          interactions: updates.interactions,
          side_effects: updates.sideEffects,
          price_min: updates.priceMin,
          price_max: updates.priceMax,
          last_modified_by: userId,
          updated_at: new Date(),
        })
        .returning('*');

      // Update Elasticsearch
      await this.indexMedicine(updated);

      // Invalidate cache
      await cache.del(`medicines:${id}`);
      await cache.invalidatePattern('medicines:*');

      logger.info(`Medicine updated: ${id}`);

      return this.mapToMedicine(updated);
    });
  }

  /**
   * Delete medicine
   */
  static async delete(id: string, userId: string): Promise<void> {
    return withTransaction(async (trx) => {
      const existing = await trx('portal.medicines')
        .where('id', id)
        .first();

      if (!existing) {
        throw new AppError('Medicine not found', 404);
      }

      await trx('portal.medicines')
        .where('id', id)
        .delete();

      // Remove from Elasticsearch
      try {
        await esClient.delete({
          index: `${config.elasticsearch.indexPrefix}medicines`,
          id: id,
        });
      } catch (error) {
        logger.warn('Failed to delete from Elasticsearch:', error);
      }

      // Invalidate cache
      await cache.del(`medicines:${id}`);
      await cache.invalidatePattern('medicines:*');

      logger.info(`Medicine deleted: ${id}`);
    });
  }

  /**
   * Bulk upload medicines
   */
  static async bulkUpload(
    medicines: Medicine[],
    userId: string
  ): Promise<{ success: number; failed: number; errors: any[] }> {
    let success = 0;
    let failed = 0;
    const errors: any[] = [];

    for (const medicine of medicines) {
      try {
        await this.create(medicine, userId);
        success++;
      } catch (error: any) {
        failed++;
        errors.push({
          medicine: medicine.edaRegistrationNumber,
          error: error.message,
        });
      }
    }

    return { success, failed, errors };
  }

  /**
   * Index medicine in Elasticsearch
   */
  private static async indexMedicine(medicine: any): Promise<void> {
    try {
      await esClient.index({
        index: `${config.elasticsearch.indexPrefix}medicines`,
        id: medicine.id,
        document: {
          id: medicine.id,
          tradeName: medicine.trade_name,
          genericName: medicine.generic_name,
          edaRegistrationNumber: medicine.eda_registration_number,
          manufacturer: medicine.manufacturer,
          therapeuticClass: medicine.therapeutic_class,
          status: medicine.status,
        },
      });
    } catch (error) {
      logger.warn('Failed to index medicine in Elasticsearch:', error);
    }
  }

  /**
   * Map database row to Medicine interface
   */
  private static mapToMedicine(row: any): Medicine {
    return {
      id: row.id,
      tradeName: row.trade_name,
      genericName: row.generic_name,
      edaRegistrationNumber: row.eda_registration_number,
      manufacturer: row.manufacturer,
      strength: row.strength,
      dosageForm: row.dosage_form,
      therapeuticClass: row.therapeutic_class,
      drugClass: row.drug_class,
      atcCode: row.atc_code,
      registrationDate: row.registration_date,
      expiryDate: row.expiry_date,
      status: row.status,
      availableForPrescription: row.available_for_prescription,
      availableForDispensing: row.available_for_dispensing,
      prescriptionRequired: row.prescription_required,
      controlledSubstance: row.controlled_substance,
      scheduleClass: row.schedule_class,
      disableReason: row.disable_reason,
      disabledAt: row.disabled_at,
      recallInfo: row.recall_info,
      packagingSizes: row.packaging_sizes,
      storageConditions: row.storage_conditions,
      warnings: row.warnings,
      interactions: row.interactions,
      sideEffects: row.side_effects,
      priceMin: row.price_min ? parseFloat(row.price_min) : undefined,
      priceMax: row.price_max ? parseFloat(row.price_max) : undefined,
      createdBy: row.created_by,
      lastModifiedBy: row.last_modified_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

