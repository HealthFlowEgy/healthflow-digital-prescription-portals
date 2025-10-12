// File: backend/src/services/eda/services/recall.service.ts
// Purpose: Medicine recall management system

import { db, withTransaction } from '../../../shared/database/connection';
import { cache } from '../../../shared/cache/redis';
import { logger } from '../../../shared/utils/logger';
import { AppError } from '../../../shared/middleware/errorHandler';
import { AuditLogService } from './auditLog.service';
import { esClient } from '../../../shared/search/elasticsearch';
import { config } from '../../../config';

export interface Recall {
  id?: string;
  recallNumber?: string;
  medicineId: string;
  severity: 'class_1' | 'class_2' | 'class_3';
  reason: string;
  description: string;
  batchNumbers: string[];
  affectedQuantity?: number;
  recallDate: Date | string;
  deadline?: Date | string;
  status?: 'initiated' | 'in_progress' | 'completed' | 'cancelled';
  actionRequired: string;
  returnInstructions?: string;
  distributionLevel: 'national' | 'regional' | 'facility_specific';
  affectedFacilities?: string[];
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  initiatedBy?: string;
  completedBy?: string;
  completedAt?: Date | string;
  cancelledBy?: string;
  cancelledAt?: Date | string;
  cancellationReason?: string;
  documents?: string[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export class RecallService {
  /**
   * Initiate a new medicine recall
   */
  static async initiateRecall(recall: Recall, userId: string): Promise<Recall> {
    return withTransaction(async (trx) => {
      // Generate recall number
      const year = new Date().getFullYear();
      const count = await trx('portal.recalls')
        .where('recall_number', 'like', `RCL-${year}-%`)
        .count('* as count')
        .first();
      
      const sequence = (parseInt(count?.count as string) || 0) + 1;
      const recallNumber = `RCL-${year}-${sequence.toString().padStart(5, '0')}`;

      // Verify medicine exists
      const medicine = await trx('portal.medicines')
        .where({ id: recall.medicineId })
        .first();

      if (!medicine) {
        throw new AppError('Medicine not found', 404);
      }

      // Insert recall
      const [created] = await trx('portal.recalls')
        .insert({
          recall_number: recallNumber,
          medicine_id: recall.medicineId,
          severity: recall.severity,
          reason: recall.reason,
          description: recall.description,
          batch_numbers: recall.batchNumbers,
          affected_quantity: recall.affectedQuantity,
          recall_date: recall.recallDate,
          deadline: recall.deadline,
          status: 'initiated',
          action_required: recall.actionRequired,
          return_instructions: recall.returnInstructions,
          distribution_level: recall.distributionLevel,
          affected_facilities: recall.affectedFacilities,
          contact_person: recall.contactPerson,
          contact_phone: recall.contactPhone,
          contact_email: recall.contactEmail,
          initiated_by: userId,
          documents: recall.documents,
        })
        .returning('*');

      // Update medicine status
      await trx('portal.medicines')
        .where({ id: recall.medicineId })
        .update({
          status: recall.severity === 'class_1' ? 'recalled' : 'partial_disabled',
          recall_info: JSON.stringify({
            recallNumber,
            severity: recall.severity,
            batchNumbers: recall.batchNumbers,
          }),
          updated_at: new Date(),
        });

      // Invalidate cache
      await cache.del(`medicine:${recall.medicineId}`);

      // Index in Elasticsearch
      await this.indexRecall(created);

      logger.info(`Recall initiated: ${recallNumber} for medicine ${medicine.trade_name}`);

      return this.mapToRecall(created);
    });
  }

  /**
   * Update recall status
   */
  static async updateStatus(
    recallId: string,
    status: 'in_progress' | 'completed' | 'cancelled',
    userId: string,
    metadata?: {
      completionNotes?: string;
      cancellationReason?: string;
    }
  ): Promise<Recall> {
    return withTransaction(async (trx) => {
      const recall = await trx('portal.recalls')
        .where({ id: recallId })
        .first();

      if (!recall) {
        throw new AppError('Recall not found', 404);
      }

      const updates: any = {
        status,
        updated_at: new Date(),
      };

      if (status === 'completed') {
        updates.completed_by = userId;
        updates.completed_at = new Date();
      } else if (status === 'cancelled') {
        updates.cancelled_by = userId;
        updates.cancelled_at = new Date();
        updates.cancellation_reason = metadata?.cancellationReason;
      }

      const [updated] = await trx('portal.recalls')
        .where({ id: recallId })
        .update(updates)
        .returning('*');

      // Update Elasticsearch
      await this.indexRecall(updated);

      return this.mapToRecall(updated);
    });
  }

  /**
   * Get recall by ID
   */
  static async getById(id: string): Promise<Recall> {
    const recall = await db('portal.recalls')
      .where({ id })
      .first();

    if (!recall) {
      throw new AppError('Recall not found', 404);
    }

    return this.mapToRecall(recall);
  }

  /**
   * Search recalls
   */
  static async search(params: {
    query?: string;
    severity?: string;
    status?: string;
    medicineId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const {
      query,
      severity,
      status,
      medicineId,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = params;

    const dbQuery = db('portal.recalls')
      .select('portal.recalls.*', 'portal.medicines.trade_name as medicine_name')
      .leftJoin('portal.medicines', 'portal.recalls.medicine_id', 'portal.medicines.id');

    if (query) {
      dbQuery.whereRaw(
        `to_tsvector('english', recall_number || ' ' || reason || ' ' || description) @@ plainto_tsquery('english', ?)`,
        [query]
      );
    }

    if (severity) {
      dbQuery.where('portal.recalls.severity', severity);
    }

    if (status) {
      dbQuery.where('portal.recalls.status', status);
    }

    if (medicineId) {
      dbQuery.where('portal.recalls.medicine_id', medicineId);
    }

    if (startDate) {
      dbQuery.where('portal.recalls.recall_date', '>=', startDate);
    }

    if (endDate) {
      dbQuery.where('portal.recalls.recall_date', '<=', endDate);
    }

    // Get total count
    const countQuery = dbQuery.clone();
    const [{ count }] = await countQuery.count('* as count');

    // Pagination
    const offset = (page - 1) * limit;
    const recalls = await dbQuery
      .orderBy('portal.recalls.recall_date', 'desc')
      .limit(limit)
      .offset(offset);

    return {
      recalls: recalls.map(r => this.mapToRecall(r)),
      pagination: {
        total: parseInt(count as string),
        page,
        pages: Math.ceil(parseInt(count as string) / limit),
        limit,
      },
    };
  }

  /**
   * Get recall statistics
   */
  static async getStatistics(timeRange?: '30d' | '90d' | '1y' | 'all') {
    let startDate: Date | undefined;

    if (timeRange && timeRange !== 'all') {
      const intervals = {
        '30d': 30 * 24 * 60 * 60 * 1000,
        '90d': 90 * 24 * 60 * 60 * 1000,
        '1y': 365 * 24 * 60 * 60 * 1000,
      };
      startDate = new Date(Date.now() - intervals[timeRange]);
    }

    // Total recalls
    const totalQuery = db('portal.recalls').count('* as count');
    if (startDate) totalQuery.where('recall_date', '>=', startDate);
    const [{ count: total }] = await totalQuery;

    // Active recalls
    const [{ count: active }] = await db('portal.recalls')
      .whereIn('status', ['initiated', 'in_progress'])
      .count('* as count');

    // Completed recalls
    const completedQuery = db('portal.recalls')
      .where('status', 'completed')
      .count('* as count');
    if (startDate) completedQuery.where('recall_date', '>=', startDate);
    const [{ count: completed }] = await completedQuery;

    // By severity
    const severityQuery = db('portal.recalls')
      .select('severity')
      .count('* as count')
      .groupBy('severity');
    if (startDate) severityQuery.where('recall_date', '>=', startDate);
    const severityCounts = await severityQuery;

    const bySeverity = {
      class1: 0,
      class2: 0,
      class3: 0,
    };

    severityCounts.forEach((row: any) => {
      if (row.severity === 'class_1') bySeverity.class1 = parseInt(row.count);
      if (row.severity === 'class_2') bySeverity.class2 = parseInt(row.count);
      if (row.severity === 'class_3') bySeverity.class3 = parseInt(row.count);
    });

    return {
      totalRecalls: parseInt(total as string),
      activeRecalls: parseInt(active as string),
      completedRecalls: parseInt(completed as string),
      bySeverity,
    };
  }

  /**
   * Index recall in Elasticsearch
   */
  private static async indexRecall(recall: any): Promise<void> {
    try {
      await esClient.index({
        index: `${config.elasticsearch.indexPrefix}recalls`,
        id: recall.id,
        document: {
          id: recall.id,
          recallNumber: recall.recall_number,
          medicineId: recall.medicine_id,
          severity: recall.severity,
          reason: recall.reason,
          description: recall.description,
          batchNumbers: recall.batch_numbers,
          status: recall.status,
          recallDate: recall.recall_date,
        },
      });
    } catch (error) {
      logger.warn('Failed to index recall in Elasticsearch:', error);
    }
  }

  /**
   * Map database row to Recall object
   */
  private static mapToRecall(row: any): Recall {
    return {
      id: row.id,
      recallNumber: row.recall_number,
      medicineId: row.medicine_id,
      severity: row.severity,
      reason: row.reason,
      description: row.description,
      batchNumbers: row.batch_numbers,
      affectedQuantity: row.affected_quantity,
      recallDate: row.recall_date,
      deadline: row.deadline,
      status: row.status,
      actionRequired: row.action_required,
      returnInstructions: row.return_instructions,
      distributionLevel: row.distribution_level,
      affectedFacilities: row.affected_facilities,
      contactPerson: row.contact_person,
      contactPhone: row.contact_phone,
      contactEmail: row.contact_email,
      initiatedBy: row.initiated_by,
      completedBy: row.completed_by,
      completedAt: row.completed_at,
      cancelledBy: row.cancelled_by,
      cancelledAt: row.cancelled_at,
      cancellationReason: row.cancellation_reason,
      documents: row.documents,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

