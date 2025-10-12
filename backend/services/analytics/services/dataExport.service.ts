import { db, withTransaction } from '../../../shared/database/connection';
import { logger } from '../../../shared/utils/logger';
import { AppError } from '../../../shared/middleware/errorHandler';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { Parser } from 'json2csv';
import { create as createXMLBuilder } from 'xmlbuilder2';

export interface ExportRequest {
  name: string;
  exportType: 'medicines' | 'audit_logs' | 'recalls' | 'adverse_events' | 'users' | 'tenants';
  format: 'csv' | 'excel' | 'json' | 'xml';
  filters?: any;
  columns?: string[];
  tenantId?: string;
}

export class DataExportService {
  private static readonly EXPORTS_DIR = path.join(process.cwd(), 'storage', 'exports');

  /**
   * Initialize exports directory
   */
  static async initialize(): Promise<void> {
    if (!fs.existsSync(this.EXPORTS_DIR)) {
      fs.mkdirSync(this.EXPORTS_DIR, { recursive: true });
    }
  }

  /**
   * Request data export
   */
  static async requestExport(request: ExportRequest, userId: string): Promise<any> {
    await this.initialize();

    return withTransaction(async (trx) => {
      // Create export record
      const [exportRecord] = await trx('portal.data_exports')
        .insert({
          name: request.name,
          export_type: request.exportType,
          format: request.format,
          status: 'pending',
          query: this.buildQuery(request),
          filters: request.filters || {},
          columns: request.columns,
          tenant_id: request.tenantId,
          requested_by: userId,
        })
        .returning('*');

      // Process export asynchronously
      this.processExport(exportRecord.id).catch((err) => {
        logger.error(`Export processing failed: ${exportRecord.id}`, err);
      });

      return exportRecord;
    });
  }

  /**
   * Process export
   */
  private static async processExport(exportId: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Update status
      await db('portal.data_exports')
        .where({ id: exportId })
        .update({
          status: 'processing',
          started_at: new Date(),
        });

      // Get export record
      const exportRecord = await db('portal.data_exports')
        .where({ id: exportId })
        .first();

      // Fetch data
      const data = await this.fetchExportData(exportRecord);

      // Generate file
      let filePath: string;
      let fileName: string;

      switch (exportRecord.format) {
        case 'excel':
          ({ filePath, fileName } = await this.generateExcelExport(exportRecord, data));
          break;
        case 'csv':
          ({ filePath, fileName } = await this.generateCSVExport(exportRecord, data));
          break;
        case 'json':
          ({ filePath, fileName } = await this.generateJSONExport(exportRecord, data));
          break;
        case 'xml':
          ({ filePath, fileName } = await this.generateXMLExport(exportRecord, data));
          break;
        default:
          throw new AppError('Unsupported export format', 400);
      }

      const fileStats = fs.statSync(filePath);
      const duration = Date.now() - startTime;

      // Update export record
      await db('portal.data_exports')
        .where({ id: exportId })
        .update({
          status: 'completed',
          completed_at: new Date(),
          duration_ms: duration,
          file_path: filePath,
          file_name: fileName,
          file_size: fileStats.size,
          download_url: `/api/v2/exports/${exportId}/download`,
          record_count: data.length,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        });

      logger.info(`Export completed: ${exportId} (${duration}ms, ${data.length} records)`);
    } catch (error: any) {
      const duration = Date.now() - startTime;

      await db('portal.data_exports')
        .where({ id: exportId })
        .update({
          status: 'failed',
          completed_at: new Date(),
          duration_ms: duration,
          error_message: error.message,
        });

      logger.error(`Export failed: ${exportId}`, error);
      throw error;
    }
  }

  /**
   * Fetch export data
   */
  private static async fetchExportData(exportRecord: any): Promise<any[]> {
    const query = exportRecord.query;
    const filters = exportRecord.filters;
    const columns = exportRecord.columns;

    let dbQuery: any;

    switch (exportRecord.export_type) {
      case 'medicines':
        dbQuery = db('portal.medicines').select(columns || '*');
        if (filters.status) dbQuery.where('status', filters.status);
        if (filters.manufacturer) dbQuery.where('manufacturer', 'ilike', `%${filters.manufacturer}%`);
        break;

      case 'audit_logs':
        dbQuery = db('portal.audit_logs').select(columns || '*');
        if (filters.startDate) dbQuery.where('created_at', '>=', filters.startDate);
        if (filters.endDate) dbQuery.where('created_at', '<=', filters.endDate);
        if (filters.userId) dbQuery.where('user_id', filters.userId);
        if (exportRecord.tenant_id) dbQuery.where('tenant_id', exportRecord.tenant_id);
        break;

      case 'recalls':
        dbQuery = db('portal.recalls')
          .select(columns || 'portal.recalls.*')
          .leftJoin('portal.medicines', 'portal.recalls.medicine_id', 'portal.medicines.id');
        if (filters.severity) dbQuery.where('portal.recalls.severity', filters.severity);
        if (filters.status) dbQuery.where('portal.recalls.status', filters.status);
        break;

      case 'adverse_events':
        dbQuery = db('portal.adverse_events')
          .select(columns || 'portal.adverse_events.*')
          .leftJoin('portal.medicines', 'portal.adverse_events.medicine_id', 'portal.medicines.id');
        if (filters.severity) dbQuery.where('portal.adverse_events.severity', filters.severity);
        break;

      case 'users':
        dbQuery = db('public.users').select(columns || '*');
        if (filters.status) dbQuery.where('status', filters.status);
        break;

      case 'tenants':
        dbQuery = db('portal.tenants').select(columns || '*');
        if (filters.type) dbQuery.where('type', filters.type);
        if (filters.status) dbQuery.where('status', filters.status);
        break;

      default:
        throw new AppError('Unknown export type', 400);
    }

    const results = await dbQuery;
    return results;
  }

  /**
   * Build query object
   */
  private static buildQuery(request: ExportRequest): any {
    return {
      type: request.exportType,
      filters: request.filters,
      columns: request.columns,
    };
  }

  /**
   * Generate Excel export
   */
  private static async generateExcelExport(
    exportRecord: any,
    data: any[]
  ): Promise<{ filePath: string; fileName: string }> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data');

    if (data.length > 0) {
      const headers = Object.keys(data[0]);

      // Add headers
      const headerRow = worksheet.addRow(headers);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1976D2' },
      };
      headerRow.font = { color: { argb: 'FFFFFFFF' }, bold: true };

      // Add data
      data.forEach((row) => {
        const values = headers.map((header) => row[header]);
        worksheet.addRow(values);
      });

      // Auto-fit columns
      worksheet.columns.forEach((column) => {
        let maxLength = 0;
        column.eachCell!({ includeEmpty: true }, (cell) => {
          const length = cell.value ? cell.value.toString().length : 10;
          if (length > maxLength) {
            maxLength = length;
          }
        });
        column.width = Math.min(maxLength + 2, 50);
      });
    }

    const fileName = `${exportRecord.export_type}_${exportRecord.id}_${Date.now()}.xlsx`;
    const filePath = path.join(this.EXPORTS_DIR, fileName);

    await workbook.xlsx.writeFile(filePath);

    return { filePath, fileName };
  }

  /**
   * Generate CSV export
   */
  private static async generateCSVExport(
    exportRecord: any,
    data: any[]
  ): Promise<{ filePath: string; fileName: string }> {
    const fileName = `${exportRecord.export_type}_${exportRecord.id}_${Date.now()}.csv`;
    const filePath = path.join(this.EXPORTS_DIR, fileName);

    if (data.length === 0) {
      fs.writeFileSync(filePath, 'No data available');
      return { filePath, fileName };
    }

    const fields = Object.keys(data[0]);
    const parser = new Parser({ fields });
    const csv = parser.parse(data);

    fs.writeFileSync(filePath, csv);

    return { filePath, fileName };
  }

  /**
   * Generate JSON export
   */
  private static async generateJSONExport(
    exportRecord: any,
    data: any[]
  ): Promise<{ filePath: string; fileName: string }> {
    const fileName = `${exportRecord.export_type}_${exportRecord.id}_${Date.now()}.json`;
    const filePath = path.join(this.EXPORTS_DIR, fileName);

    const output = {
      export: {
        type: exportRecord.export_type,
        generated_at: new Date().toISOString(),
        filters: exportRecord.filters,
      },
      data,
      summary: {
        total_records: data.length,
      },
    };

    fs.writeFileSync(filePath, JSON.stringify(output, null, 2));

    return { filePath, fileName };
  }

  /**
   * Generate XML export
   */
  private static async generateXMLExport(
    exportRecord: any,
    data: any[]
  ): Promise<{ filePath: string; fileName: string }> {
    const fileName = `${exportRecord.export_type}_${exportRecord.id}_${Date.now()}.xml`;
    const filePath = path.join(this.EXPORTS_DIR, fileName);

    const root = createXMLBuilder({ version: '1.0', encoding: 'UTF-8' })
      .ele('export')
      .ele('metadata')
      .ele('type').txt(exportRecord.export_type).up()
      .ele('generated_at').txt(new Date().toISOString()).up()
      .ele('total_records').txt(data.length.toString()).up()
      .up()
      .ele('data');

    data.forEach((item) => {
      const record = root.ele('record');
      Object.entries(item).forEach(([key, value]) => {
        record.ele(key).txt(String(value ?? ''));
      });
    });

    const xml = root.end({ prettyPrint: true });

    fs.writeFileSync(filePath, xml);

    return { filePath, fileName };
  }

  /**
   * Get export status
   */
  static async getExport(exportId: string): Promise<any> {
    const exportRecord = await db('portal.data_exports')
      .where({ id: exportId })
      .first();

    if (!exportRecord) {
      throw new AppError('Export not found', 404);
    }

    return exportRecord;
  }

  /**
   * Download export file
   */
  static async downloadExport(exportId: string): Promise<{ filePath: string; fileName: string }> {
    const exportRecord = await this.getExport(exportId);

    if (exportRecord.status !== 'completed') {
      throw new AppError('Export is not ready for download', 400);
    }

    if (!exportRecord.file_path || !fs.existsSync(exportRecord.file_path)) {
      throw new AppError('Export file not found', 404);
    }

    return {
      filePath: exportRecord.file_path,
      fileName: exportRecord.file_name,
    };
  }

  /**
   * List user exports
   */
  static async listExports(userId: string, limit: number = 50): Promise<any[]> {
    const exports = await db('portal.data_exports')
      .where({ requested_by: userId })
      .orderBy('created_at', 'desc')
      .limit(limit);

    return exports;
  }

  /**
   * Delete expired exports (cron job)
   */
  static async cleanupExpiredExports(): Promise<number> {
    const expired = await db('portal.data_exports')
      .where('expires_at', '<', new Date())
      .where('status', 'completed');

    let deletedCount = 0;

    for (const exportRecord of expired) {
      if (exportRecord.file_path && fs.existsSync(exportRecord.file_path)) {
        fs.unlinkSync(exportRecord.file_path);
      }

      await db('portal.data_exports').where({ id: exportRecord.id }).delete();
      deletedCount++;
    }

    if (deletedCount > 0) {
      logger.info(`Cleaned up ${deletedCount} expired exports`);
    }

    return deletedCount;
  }
}