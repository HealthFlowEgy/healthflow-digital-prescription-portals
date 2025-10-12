// File: backend/src/services/eda/services/adverseEvent.service.ts
// Purpose: Adverse event reporting system

import { db, withTransaction } from '../../../shared/database/connection';
import { cache } from '../../../shared/cache/redis';
import { logger } from '../../../shared/utils/logger';
import { AppError } from '../../../shared/middleware/errorHandler';
import { AuditLogService } from './auditLog.service';
import { esClient } from '../../../shared/search/elasticsearch';
import { config } from '../../../config';

export interface AdverseEvent {
  id?: string;
  reportNumber?: string;
  medicineId: string;
  batchNumber?: string;
  patientAge?: number;
  patientGender?: 'male' | 'female' | 'other';
  patientWeight?: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life_threatening' | 'fatal';
  eventDate: Date | string;
  description: string;
  symptoms?: string[];
  outcome?: string;
  hospitalizationRequired?: boolean;
  hospitalizationDays?: number;
  medicalHistory?: string;
  concomitantMedications?: string;
  allergies?: string;
  reporterType: 'doctor' | 'pharmacist' | 'patient' | 'other';
  reporterName: string;
  reporterEmail?: string;
  reporterPhone?: string;
  reporterFacility?: string;
  status?: 'submitted' | 'under_review' | 'investigated' | 'closed';
  reviewedBy?: string;
  reviewedAt?: Date | string;
  reviewNotes?: string;
  actionTaken?: 'none' | 'label_update' | 'recall' | 'investigation';
  followUpRequired?: boolean;
  followUpDate?: Date | string;
  followUpNotes?: string;
  attachments?: string[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export class AdverseEventService {
  /**
   * Submit a new adverse event report
   */
  static async submitReport(event: AdverseEvent, userId?: string): Promise<AdverseEvent> {
    return withTransaction(async (trx) => {
      // Generate report number
      const year = new Date().getFullYear();
      const count = await trx('portal.adverse_events')
        .where('report_number', 'like', `AE-${year}-%`)
        .count('* as count')
        .first();
      
      const sequence = (parseInt(count?.count as string) || 0) + 1;
      const reportNumber = `AE-${year}-${sequence.toString().padStart(5, '0')}`;

      // Verify medicine exists
      const medicine = await trx('portal.medicines')
        .where({ id: event.medicineId })
        .first();

      if (!medicine) {
        throw new AppError('Medicine not found', 404);
      }

      // Insert adverse event
      const [created] = await trx('portal.adverse_events')
        .insert({
          report_number: reportNumber,
          medicine_id: event.medicineId,
          batch_number: event.batchNumber,
          patient_age: event.patientAge,
          patient_gender: event.patientGender,
          patient_weight: event.patientWeight,
          severity: event.severity,
          event_date: event.eventDate,
          description: event.description,
          symptoms: event.symptoms,
          outcome: event.outcome,
          hospitalization_required: event.hospitalizationRequired || false,
          hospitalization_days: event.hospitalizationDays,
          medical_history: event.medicalHistory,
          concomitant_medications: event.concomitantMedications,
          allergies: event.allergies,
          reporter_type: event.reporterType,
          reporter_name: event.reporterName,
          reporter_email: event.reporterEmail,
          reporter_phone: event.reporterPhone,
          reporter_facility: event.reporterFacility,
          status: 'submitted',
          follow_up_required: event.followUpRequired || false,
          attachments: event.attachments,
        })
        .returning('*');

      // Index in Elasticsearch
      await this.indexAdverseEvent(created);

      // Audit log
      if (userId) {
        await AuditLogService.log({
          userId,
          userEmail: event.reporterEmail || 'unknown',
          userRole: event.reporterType,
          action: 'CREATE',
          resource: 'adverse_event',
          resourceId: created.id,
          changes: { event: created },
          success: true,
          phiAccessed: true,
        });
      }

      logger.info(`Adverse event submitted: ${reportNumber} for medicine ${medicine.trade_name}`);

      return this.mapToAdverseEvent(created);
    });
  }

  /**
   * Update adverse event status
   */
  static async updateStatus(
    eventId: string,
    status: 'under_review' | 'investigated' | 'closed',
    userId: string,
    metadata?: {
      reviewNotes?: string;
      actionTaken?: 'none' | 'label_update' | 'recall' | 'investigation';
      followUpRequired?: boolean;
      followUpDate?: Date;
      followUpNotes?: string;
    }
  ): Promise<AdverseEvent> {
    return withTransaction(async (trx) => {
      const event = await trx('portal.adverse_events')
        .where({ id: eventId })
        .first();

      if (!event) {
        throw new AppError('Adverse event not found', 404);
      }

      const updates: any = {
        status,
        updated_at: new Date(),
      };

      if (status === 'under_review') {
        updates.reviewed_by = userId;
        updates.reviewed_at = new Date();
      }

      if (metadata?.reviewNotes) {
        updates.review_notes = metadata.reviewNotes;
      }

      if (metadata?.actionTaken) {
        updates.action_taken = metadata.actionTaken;
      }

      if (metadata?.followUpRequired !== undefined) {
        updates.follow_up_required = metadata.followUpRequired;
      }

      if (metadata?.followUpDate) {
        updates.follow_up_date = metadata.followUpDate;
      }

      if (metadata?.followUpNotes) {
        updates.follow_up_notes = metadata.followUpNotes;
      }

      const [updated] = await trx('portal.adverse_events')
        .where({ id: eventId })
        .update(updates)
        .returning('*');

      // Update Elasticsearch
      await this.indexAdverseEvent(updated);

      // Audit log
      await AuditLogService.log({
        userId,
        userEmail: 'system',
        userRole: 'eda_officer',
        action: 'UPDATE',
        resource: 'adverse_event',
        resourceId: eventId,
        changes: { status, metadata },
        success: true,
        phiAccessed: true,
      });

      return this.mapToAdverseEvent(updated);
    });
  }

  /**
   * Get adverse event by ID
   */
  static async getById(id: string): Promise<AdverseEvent> {
    const event = await db('portal.adverse_events')
      .where({ id })
      .first();

    if (!event) {
      throw new AppError('Adverse event not found', 404);
    }

    return this.mapToAdverseEvent(event);
  }

  /**
   * Search adverse events
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

    const dbQuery = db('portal.adverse_events')
      .select('portal.adverse_events.*', 'portal.medicines.trade_name as medicine_name')
      .leftJoin('portal.medicines', 'portal.adverse_events.medicine_id', 'portal.medicines.id');

    if (query) {
      dbQuery.whereRaw(
        `to_tsvector('english', report_number || ' ' || description) @@ plainto_tsquery('english', ?)`,
        [query]
      );
    }

    if (severity) {
      dbQuery.where('portal.adverse_events.severity', severity);
    }

    if (status) {
      dbQuery.where('portal.adverse_events.status', status);
    }

    if (medicineId) {
      dbQuery.where('portal.adverse_events.medicine_id', medicineId);
    }

    if (startDate) {
      dbQuery.where('portal.adverse_events.event_date', '>=', startDate);
    }

    if (endDate) {
      dbQuery.where('portal.adverse_events.event_date', '<=', endDate);
    }

    // Get total count
    const countQuery = dbQuery.clone();
    const [{ count }] = await countQuery.count('* as count');

    // Pagination
    const offset = (page - 1) * limit;
    const events = await dbQuery
      .orderBy('portal.adverse_events.event_date', 'desc')
      .limit(limit)
      .offset(offset);

    return {
      events: events.map(e => this.mapToAdverseEvent(e)),
      pagination: {
        total: parseInt(count as string),
        page,
        pages: Math.ceil(parseInt(count as string) / limit),
        limit,
      },
    };
  }

  /**
   * Get adverse event statistics
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

    // Total events
    const totalQuery = db('portal.adverse_events').count('* as count');
    if (startDate) totalQuery.where('event_date', '>=', startDate);
    const [{ count: total }] = await totalQuery;

    // By severity
    const severityQuery = db('portal.adverse_events')
      .select('severity')
      .count('* as count')
      .groupBy('severity');
    if (startDate) severityQuery.where('event_date', '>=', startDate);
    const severityCounts = await severityQuery;

    const bySeverity: any = {
      mild: 0,
      moderate: 0,
      severe: 0,
      life_threatening: 0,
      fatal: 0,
    };

    severityCounts.forEach((row: any) => {
      bySeverity[row.severity] = parseInt(row.count);
    });

    // By status
    const statusQuery = db('portal.adverse_events')
      .select('status')
      .count('* as count')
      .groupBy('status');
    if (startDate) statusQuery.where('event_date', '>=', startDate);
    const statusCounts = await statusQuery;

    const byStatus: any = {
      submitted: 0,
      under_review: 0,
      investigated: 0,
      closed: 0,
    };

    statusCounts.forEach((row: any) => {
      byStatus[row.status] = parseInt(row.count);
    });

    return {
      totalEvents: parseInt(total as string),
      bySeverity,
      byStatus,
    };
  }

  /**
   * Index adverse event in Elasticsearch
   */
  private static async indexAdverseEvent(event: any): Promise<void> {
    try {
      await esClient.index({
        index: `${config.elasticsearch.indexPrefix}adverse_events`,
        id: event.id,
        document: {
          id: event.id,
          reportNumber: event.report_number,
          medicineId: event.medicine_id,
          severity: event.severity,
          description: event.description,
          symptoms: event.symptoms,
          status: event.status,
          eventDate: event.event_date,
        },
      });
    } catch (error) {
      logger.warn('Failed to index adverse event in Elasticsearch:', error);
    }
  }

  /**
   * Map database row to AdverseEvent object
   */
  private static mapToAdverseEvent(row: any): AdverseEvent {
    return {
      id: row.id,
      reportNumber: row.report_number,
      medicineId: row.medicine_id,
      batchNumber: row.batch_number,
      patientAge: row.patient_age,
      patientGender: row.patient_gender,
      patientWeight: row.patient_weight,
      severity: row.severity,
      eventDate: row.event_date,
      description: row.description,
      symptoms: row.symptoms,
      outcome: row.outcome,
      hospitalizationRequired: row.hospitalization_required,
      hospitalizationDays: row.hospitalization_days,
      medicalHistory: row.medical_history,
      concomitantMedications: row.concomitant_medications,
      allergies: row.allergies,
      reporterType: row.reporter_type,
      reporterName: row.reporter_name,
      reporterEmail: row.reporter_email,
      reporterPhone: row.reporter_phone,
      reporterFacility: row.reporter_facility,
      status: row.status,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      reviewNotes: row.review_notes,
      actionTaken: row.action_taken,
      followUpRequired: row.follow_up_required,
      followUpDate: row.follow_up_date,
      followUpNotes: row.follow_up_notes,
      attachments: row.attachments,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

