import { db, withTransaction } from '../../../shared/database/connection';
import { logger } from '../../../shared/utils/logger';
import { AppError } from '../../../shared/middleware/errorHandler';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface ReportConfig {
  name: string;
  type: string;
  query: any;
  format: 'pdf' | 'excel' | 'csv' | 'json';
  filters?: any;
  parameters?: any;
}

export interface ReportExecution {
  id: string;
  reportId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  filePath?: string;
  fileName?: string;
  downloadUrl?: string;
  error?: string;
}

export class ReportService {
  private static readonly REPORTS_DIR = path.join(process.cwd(), 'storage', 'reports');

  /**
   * Initialize reports directory
   */
  static async initialize(): Promise<void> {
    if (!fs.existsSync(this.REPORTS_DIR)) {
      fs.mkdirSync(this.REPORTS_DIR, { recursive: true });
    }
  }

  /**
   * Create a new report definition
   */
  static async createReport(report: ReportConfig, userId: string): Promise<any> {
    return withTransaction(async (trx) => {
      const [created] = await trx('portal.reports')
        .insert({
          name: report.name,
          slug: this.generateSlug(report.name),
          type: report.type,
          query_config: report.query,
          format: report.format,
          filters: report.filters || {},
          created_by: userId,
        })
        .returning('*');

      logger.info(`Report created: ${created.name} (${created.id})`);

      return this.mapToReport(created);
    });
  }

  /**
   * Execute a report
   */
  static async executeReport(
    reportId: string,
    parameters: any = {},
    userId: string
  ): Promise<ReportExecution> {
    await this.initialize();

    // Get report definition
    const report = await db('portal.reports').where({ id: reportId }).first();

    if (!report) {
      throw new AppError('Report not found', 404);
    }

    // Create execution record
    const [execution] = await db('portal.report_executions')
      .insert({
        report_id: reportId,
        status: 'pending',
        trigger_type: 'manual',
        triggered_by: userId,
        parameters,
      })
      .returning('*');

    // Execute report asynchronously
    this.generateReport(execution.id, report, parameters).catch((err) => {
      logger.error(`Report execution failed: ${execution.id}`, err);
    });

    return {
      id: execution.id,
      reportId: execution.report_id,
      status: execution.status,
    };
  }

  /**
   * Generate report file
   */
  private static async generateReport(
    executionId: string,
    report: any,
    parameters: any
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Update status to running
      await db('portal.report_executions')
        .where({ id: executionId })
        .update({
          status: 'running',
          started_at: new Date(),
        });

      // Fetch data based on report type
      const data = await this.fetchReportData(report, parameters);

      // Generate file based on format
      let filePath: string;
      let fileName: string;

      switch (report.format) {
        case 'excel':
          ({ filePath, fileName } = await this.generateExcel(report, data, executionId));
          break;
        case 'csv':
          ({ filePath, fileName } = await this.generateCSV(report, data, executionId));
          break;
        case 'pdf':
          ({ filePath, fileName } = await this.generatePDF(report, data, executionId));
          break;
        case 'json':
          ({ filePath, fileName } = await this.generateJSON(report, data, executionId));
          break;
        default:
          throw new AppError('Unsupported report format', 400);
      }

      const fileStats = fs.statSync(filePath);
      const duration = Date.now() - startTime;

      // Update execution record
      await db('portal.report_executions')
        .where({ id: executionId })
        .update({
          status: 'completed',
          completed_at: new Date(),
          duration_ms: duration,
          file_path: filePath,
          file_name: fileName,
          file_size: fileStats.size,
          download_url: `/api/v2/reports/executions/${executionId}/download`,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          rows_processed: data.length,
        });

      logger.info(
        `Report generated successfully: ${executionId} (${duration}ms, ${fileStats.size} bytes)`
      );
    } catch (error: any) {
      const duration = Date.now() - startTime;

      await db('portal.report_executions')
        .where({ id: executionId })
        .update({
          status: 'failed',
          completed_at: new Date(),
          duration_ms: duration,
          error_message: error.message,
          error_details: { stack: error.stack },
        });

      logger.error(`Report generation failed: ${executionId}`, error);
      throw error;
    }
  }

  /**
   * Fetch report data
   */
  private static async fetchReportData(report: any, parameters: any): Promise<any[]> {
    const queryConfig = report.query_config;

    switch (report.type) {
      case 'audit_summary':
        return this.fetchAuditSummary(queryConfig, parameters);
      case 'medicine_catalog':
        return this.fetchMedicineCatalog(queryConfig, parameters);
      case 'recall_summary':
        return this.fetchRecallSummary(queryConfig, parameters);
      case 'adverse_event_summary':
        return this.fetchAdverseEventSummary(queryConfig, parameters);
      case 'user_activity':
        return this.fetchUserActivity(queryConfig, parameters);
      case 'tenant_overview':
        return this.fetchTenantOverview(queryConfig, parameters);
      case 'custom':
        return this.executeCustomQuery(queryConfig, parameters);
      default:
        throw new AppError('Unknown report type', 400);
    }
  }

  /**
   * Fetch audit summary data
   */
  private static async fetchAuditSummary(config: any, params: any): Promise<any[]> {
    const query = db('portal.audit_logs')
      .select(
        'id',
        'user_email',
        'action',
        'resource',
        'resource_id',
        'phi_accessed',
        'created_at'
      )
      .orderBy('created_at', 'desc');

    if (params.startDate) {
      query.where('created_at', '>=', params.startDate);
    }

    if (params.endDate) {
      query.where('created_at', '<=', params.endDate);
    }

    if (params.tenantId) {
      query.where('tenant_id', params.tenantId);
    }

    if (params.userId) {
      query.where('user_id', params.userId);
    }

    const results = await query;
    return results;
  }

  /**
   * Fetch medicine catalog data
   */
  private static async fetchMedicineCatalog(config: any, params: any): Promise<any[]> {
    const query = db('portal.medicines')
      .select(
        'id',
        'eda_number',
        'trade_name',
        'scientific_name',
        'manufacturer',
        'dosage_form',
        'strength',
        'status',
        'created_at'
      )
      .orderBy('trade_name', 'asc');

    if (params.status) {
      query.where('status', params.status);
    }

    if (params.manufacturer) {
      query.where('manufacturer', 'ilike', `%${params.manufacturer}%`);
    }

    const results = await query;
    return results;
  }

  /**
   * Fetch recall summary data
   */
  private static async fetchRecallSummary(config: any, params: any): Promise<any[]> {
    const query = db('portal.recalls')
      .select(
        'portal.recalls.*',
        'portal.medicines.trade_name as medicine_name'
      )
      .leftJoin('portal.medicines', 'portal.recalls.medicine_id', 'portal.medicines.id')
      .orderBy('portal.recalls.recall_date', 'desc');

    if (params.startDate) {
      query.where('portal.recalls.recall_date', '>=', params.startDate);
    }

    if (params.endDate) {
      query.where('portal.recalls.recall_date', '<=', params.endDate);
    }

    if (params.severity) {
      query.where('portal.recalls.severity', params.severity);
    }

    const results = await query;
    return results;
  }

  /**
   * Fetch adverse event summary data
   */
  private static async fetchAdverseEventSummary(config: any, params: any): Promise<any[]> {
    const query = db('portal.adverse_events')
      .select(
        'portal.adverse_events.*',
        'portal.medicines.trade_name as medicine_name'
      )
      .leftJoin('portal.medicines', 'portal.adverse_events.medicine_id', 'portal.medicines.id')
      .orderBy('portal.adverse_events.event_date', 'desc');

    if (params.startDate) {
      query.where('portal.adverse_events.event_date', '>=', params.startDate);
    }

    if (params.endDate) {
      query.where('portal.adverse_events.event_date', '<=', params.endDate);
    }

    if (params.severity) {
      query.where('portal.adverse_events.severity', params.severity);
    }

    const results = await query;
    return results;
  }

  /**
   * Fetch user activity data
   */
  private static async fetchUserActivity(config: any, params: any): Promise<any[]> {
    const query = db('portal.audit_logs')
      .select(
        'user_email',
        db.raw('COUNT(*) as action_count'),
        db.raw('COUNT(DISTINCT action) as unique_actions'),
        db.raw('MAX(created_at) as last_activity')
      )
      .groupBy('user_email')
      .orderBy('action_count', 'desc');

    if (params.startDate) {
      query.where('created_at', '>=', params.startDate);
    }

    if (params.endDate) {
      query.where('created_at', '<=', params.endDate);
    }

    const results = await query;
    return results;
  }

  /**
   * Fetch tenant overview data
   */
  private static async fetchTenantOverview(config: any, params: any): Promise<any[]> {
    const results = await db('portal.tenants')
      .select(
        'portal.tenants.*',
        db.raw('COUNT(DISTINCT portal.user_tenants.user_id) as user_count')
      )
      .leftJoin('portal.user_tenants', 'portal.tenants.id', 'portal.user_tenants.tenant_id')
      .groupBy('portal.tenants.id')
      .orderBy('portal.tenants.name', 'asc');

    return results;
  }

  /**
   * Execute custom query
   */
  private static async executeCustomQuery(config: any, params: any): Promise<any[]> {
    // Execute custom SQL query with parameter substitution
    const query = config.sql;
    const results = await db.raw(query, params);
    return results.rows;
  }

  /**
   * Generate Excel report
   */
  private static async generateExcel(
    report: any,
    data: any[],
    executionId: string
  ): Promise<{ filePath: string; fileName: string }> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(report.name);

    // Add title
    worksheet.mergeCells('A1:F1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = report.name;
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center' };

    // Add metadata
    worksheet.getCell('A2').value = 'Generated:';
    worksheet.getCell('B2').value = new Date().toLocaleString();
    worksheet.getCell('A3').value = 'Report Type:';
    worksheet.getCell('B3').value = report.type;

    // Add headers
    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      worksheet.addRow([]); // Empty row
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

    const fileName = `${report.slug}_${executionId}.xlsx`;
    const filePath = path.join(this.REPORTS_DIR, fileName);

    await workbook.xlsx.writeFile(filePath);

    return { filePath, fileName };
  }

  /**
   * Generate CSV report
   */
  private static async generateCSV(
    report: any,
    data: any[],
    executionId: string
  ): Promise<{ filePath: string; fileName: string }> {
    const fileName = `${report.slug}_${executionId}.csv`;
    const filePath = path.join(this.REPORTS_DIR, fileName);

    if (data.length === 0) {
      fs.writeFileSync(filePath, 'No data available');
      return { filePath, fileName };
    }

    const headers = Object.keys(data[0]);
    const csvRows = [];

    // Add headers
    csvRows.push(headers.join(','));

    // Add data rows
    data.forEach((row) => {
      const values = headers.map((header) => {
        const value = row[header];
        // Escape quotes and wrap in quotes if contains comma
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvRows.push(values.join(','));
    });

    fs.writeFileSync(filePath, csvRows.join('\n'));

    return { filePath, fileName };
  }

  /**
   * Generate PDF report
   */
  private static async generatePDF(
    report: any,
    data: any[],
    executionId: string
  ): Promise<{ filePath: string; fileName: string }> {
    const fileName = `${report.slug}_${executionId}.pdf`;
    const filePath = path.join(this.REPORTS_DIR, fileName);

    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    // Add title
    doc.fontSize(20).text(report.name, { align: 'center' });
    doc.moveDown();

    // Add metadata
    doc.fontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`);
    doc.text(`Report Type: ${report.type}`);
    doc.text(`Records: ${data.length}`);
    doc.moveDown();

    // Add data (simplified table)
    if (data.length > 0) {
      const headers = Object.keys(data[0]);

      doc.fontSize(8);

      // Headers
      headers.forEach((header, i) => {
        doc.text(header, 50 + i * 100, doc.y, { width: 90, continued: i < headers.length - 1 });
      });

      doc.moveDown();

      // Data rows (limit to first 100 for PDF)
      data.slice(0, 100).forEach((row) => {
        headers.forEach((header, i) => {
          const value = row[header]?.toString().substring(0, 30) || '';
          doc.text(value, 50 + i * 100, doc.y, { width: 90, continued: i < headers.length - 1 });
        });
        doc.moveDown(0.5);
      });

      if (data.length > 100) {
        doc.moveDown();
        doc.text(`... and ${data.length - 100} more records`, { align: 'center' });
      }
    }

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve({ filePath, fileName }));
      stream.on('error', reject);
    });
  }

  /**
   * Generate JSON report
   */
  private static async generateJSON(
    report: any,
    data: any[],
    executionId: string
  ): Promise<{ filePath: string; fileName: string }> {
    const fileName = `${report.slug}_${executionId}.json`;
    const filePath = path.join(this.REPORTS_DIR, fileName);

    const output = {
      report: {
        name: report.name,
        type: report.type,
        generated_at: new Date().toISOString(),
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
   * Get report execution status
   */
  static async getExecution(executionId: string): Promise<any> {
    const execution = await db('portal.report_executions')
      .where({ id: executionId })
      .first();

    if (!execution) {
      throw new AppError('Report execution not found', 404);
    }

    return execution;
  }

  /**
   * Download report file
   */
  static async downloadReport(executionId: string): Promise<{ filePath: string; fileName: string }> {
    const execution = await this.getExecution(executionId);

    if (execution.status !== 'completed') {
      throw new AppError('Report is not ready for download', 400);
    }

    if (!execution.file_path || !fs.existsSync(execution.file_path)) {
      throw new AppError('Report file not found', 404);
    }

    return {
      filePath: execution.file_path,
      fileName: execution.file_name,
    };
  }

  /**
   * List report executions
   */
  static async listExecutions(reportId: string, limit: number = 50): Promise<any[]> {
    const executions = await db('portal.report_executions')
      .where({ report_id: reportId })
      .orderBy('created_at', 'desc')
      .limit(limit);

    return executions;
  }

  /**
   * Schedule a report
   */
  static async scheduleReport(
    reportId: string,
    cronExpression: string,
    recipients: string[],
    userId: string
  ): Promise<any> {
    const report = await db('portal.reports').where({ id: reportId }).first();

    if (!report) {
      throw new AppError('Report not found', 404);
    }

    const [updated] = await db('portal.reports')
      .where({ id: reportId })
      .update({
        is_scheduled: true,
        cron_expression: cronExpression,
        recipients,
        updated_at: new Date(),
      })
      .returning('*');

    logger.info(`Report scheduled: ${reportId} with cron: ${cronExpression}`);

    return this.mapToReport(updated);
  }

  /**
   * Helper: Generate slug from name
   */
  private static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Helper: Map database row to Report object
   */
  private static mapToReport(row: any): any {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      type: row.type,
      category: row.category,
      scope: row.scope,
      tenantId: row.tenant_id,
      queryConfig: row.query_config,
      visualizationConfig: row.visualization_config,
      filters: row.filters,
      format: row.format,
      isScheduled: row.is_scheduled,
      cronExpression: row.cron_expression,
      lastRunAt: row.last_run_at,
      nextRunAt: row.next_run_at,
      isPublic: row.is_public,
      sharedWithRoles: row.shared_with_roles,
      recipients: row.recipients,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}