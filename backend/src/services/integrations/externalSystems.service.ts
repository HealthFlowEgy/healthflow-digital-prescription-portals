// File: backend/services/integrations/externalSystems.service.ts
// Purpose: Integration with ERP, Lab, Insurance, and Pharmacy POS systems

import axios, { AxiosInstance } from 'axios';
import { db } from '../../shared/database/connection';
import { logger } from '../../shared/utils/logger';
import { cache } from '../../shared/cache/redis';
import crypto from 'crypto';

export interface IntegrationConfig {
  id: string;
  name: string;
  type: 'erp' | 'lab' | 'insurance' | 'pharmacy_pos';
  baseUrl: string;
  apiKey: string;
  apiSecret?: string;
  isActive: boolean;
  settings: any;
}

export class ExternalSystemsService {
  private integrations: Map<string, AxiosInstance> = new Map();

  /**
   * Initialize integrations
   */
  async initialize() {
    const configs = await db('portal.system_integrations')
      .where({ is_active: true });

    for (const config of configs) {
      this.setupIntegration(config);
    }

    logger.info(`Initialized ${configs.length} external integrations`);
  }

  /**
   * Setup integration client
   */
  private setupIntegration(config: any) {
    const client = axios.create({
      baseURL: config.base_url,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.api_key,
      },
    });

    // Add request interceptor for authentication
    client.interceptors.request.use(async (requestConfig) => {
      if (config.api_secret) {
        // Add HMAC signature
        const timestamp = Date.now().toString();
        const signature = this.generateSignature(
          requestConfig.method!,
          requestConfig.url!,
          timestamp,
          config.api_secret
        );

        requestConfig.headers['X-Timestamp'] = timestamp;
        requestConfig.headers['X-Signature'] = signature;
      }

      return requestConfig;
    });

    // Add response interceptor for error handling
    client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error(`Integration error (${config.name}):`, error.message);
        throw error;
      }
    );

    this.integrations.set(config.id, client);
  }

  /**
   * Generate HMAC signature
   */
  private generateSignature(
    method: string,
    url: string,
    timestamp: string,
    secret: string
  ): string {
    const message = `${method}:${url}:${timestamp}`;
    return crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('hex');
  }

  // ========== ERP INTEGRATION ==========

  /**
   * Sync medicine inventory with ERP system
   */
  async syncInventoryWithERP(tenantId: string): Promise<any> {
    const integration = await this.getIntegration(tenantId, 'erp');
    
    if (!integration) {
      throw new Error('ERP integration not configured');
    }

    const client = this.integrations.get(integration.id);
    if (!client) {
      throw new Error('ERP client not initialized');
    }

    try {
      // Fetch inventory from ERP
      const response = await client.get('/api/inventory/medicines');
      const erpInventory = response.data;

      // Update local inventory
      let updated = 0;
      for (const item of erpInventory) {
        const medicine = await db('portal.medicines')
          .where({ eda_number: item.eda_number })
          .orWhere({ barcode: item.barcode })
          .first();

        if (medicine) {
          await db('portal.pharmacy_prices')
            .where({ 
              medicine_id: medicine.id, 
              pharmacy_id: integration.pharmacy_id 
            })
            .update({
              in_stock: item.quantity > 0,
              quantity: item.quantity,
              price: item.price,
              updated_at: new Date(),
            });
          updated++;
        }
      }

      logger.info(`Synced ${updated} medicines from ERP (${integration.name})`);

      return {
        success: true,
        itemsProcessed: erpInventory.length,
        itemsUpdated: updated,
      };
    } catch (error: any) {
      logger.error('Failed to sync with ERP:', error);
      throw error;
    }
  }

  /**
   * Create purchase order in ERP
   */
  async createPurchaseOrder(tenantId: string, orderData: any): Promise<any> {
    const integration = await this.getIntegration(tenantId, 'erp');
    
    if (!integration) {
      throw new Error('ERP integration not configured');
    }

    const client = this.integrations.get(integration.id);
    if (!client) {
      throw new Error('ERP client not initialized');
    }

    try {
      const response = await client.post('/api/purchase-orders', orderData);
      
      logger.info(`Created purchase order in ERP: ${response.data.order_id}`);
      
      return response.data;
    } catch (error: any) {
      logger.error('Failed to create purchase order:', error);
      throw error;
    }
  }

  // ========== LAB SYSTEM INTEGRATION ==========

  /**
   * Fetch lab results
   */
  async fetchLabResults(patientId: string, fromDate?: Date): Promise<any[]> {
    const integration = await this.getActiveIntegration('lab');
    
    if (!integration) {
      return [];
    }

    const cacheKey = `lab:results:${patientId}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const client = this.integrations.get(integration.id);
    if (!client) {
      return [];
    }

    try {
      const response = await client.get('/api/results', {
        params: {
          patient_id: patientId,
          from_date: fromDate?.toISOString(),
        },
      });

      const results = response.data;

      // Cache for 5 minutes
      await cache.set(cacheKey, results, 300);

      return results;
    } catch (error: any) {
      logger.error('Failed to fetch lab results:', error);
      return [];
    }
  }

  /**
   * Submit lab test order
   */
  async submitLabOrder(orderData: any): Promise<any> {
    const integration = await this.getActiveIntegration('lab');
    
    if (!integration) {
      throw new Error('Lab integration not configured');
    }

    const client = this.integrations.get(integration.id);
    if (!client) {
      throw new Error('Lab client not initialized');
    }

    try {
      const response = await client.post('/api/orders', orderData);
      
      logger.info(`Submitted lab order: ${response.data.order_id}`);
      
      return response.data;
    } catch (error: any) {
      logger.error('Failed to submit lab order:', error);
      throw error;
    }
  }

  // ========== INSURANCE INTEGRATION ==========

  /**
   * Verify insurance coverage
   */
  async verifyInsuranceCoverage(
    patientData: any,
    medicineId: string
  ): Promise<any> {
    const integration = await this.getActiveIntegration('insurance');
    
    if (!integration) {
      return {
        covered: false,
        message: 'Insurance integration not available',
      };
    }

    const client = this.integrations.get(integration.id);
    if (!client) {
      return {
        covered: false,
        message: 'Insurance client not initialized',
      };
    }

    try {
      const medicine = await db('portal.medicines')
        .where({ id: medicineId })
        .first();

      const response = await client.post('/api/verify-coverage', {
        policy_number: patientData.insurancePolicyNumber,
        patient_id: patientData.nationalId,
        medicine_code: medicine.eda_number,
        medicine_name: medicine.trade_name,
      });

      return {
        covered: response.data.covered,
        coverage_percentage: response.data.coverage_percentage,
        patient_copay: response.data.patient_copay,
        authorization_required: response.data.authorization_required,
        prior_authorization_status: response.data.prior_authorization_status,
        message: response.data.message,
      };
    } catch (error: any) {
      logger.error('Failed to verify insurance coverage:', error);
      return {
        covered: false,
        message: 'Failed to verify coverage',
        error: error.message,
      };
    }
  }

  /**
   * Submit insurance claim
   */
  async submitInsuranceClaim(claimData: any): Promise<any> {
    const integration = await this.getActiveIntegration('insurance');
    
    if (!integration) {
      throw new Error('Insurance integration not configured');
    }

    const client = this.integrations.get(integration.id);
    if (!client) {
      throw new Error('Insurance client not initialized');
    }

    try {
      const response = await client.post('/api/claims', claimData);
      
      logger.info(`Submitted insurance claim: ${response.data.claim_id}`);
      
      return response.data;
    } catch (error: any) {
      logger.error('Failed to submit insurance claim:', error);
      throw error;
    }
  }

  // ========== PHARMACY POS INTEGRATION ==========

  /**
   * Process sale through POS
   */
  async processPOSSale(saleData: any): Promise<any> {
    const integration = await this.getActiveIntegration('pharmacy_pos');
    
    if (!integration) {
      throw new Error('POS integration not configured');
    }

    const client = this.integrations.get(integration.id);
    if (!client) {
      throw new Error('POS client not initialized');
    }

    try {
      const response = await client.post('/api/sales', saleData);
      
      logger.info(`Processed POS sale: ${response.data.receipt_number}`);
      
      return response.data;
    } catch (error: any) {
      logger.error('Failed to process POS sale:', error);
      throw error;
    }
  }

  /**
   * Sync sales data from POS
   */
  async syncPOSSalesData(pharmacyId: string, fromDate: Date): Promise<any> {
    const integration = await this.getIntegration(pharmacyId, 'pharmacy_pos');
    
    if (!integration) {
      throw new Error('POS integration not configured');
    }

    const client = this.integrations.get(integration.id);
    if (!client) {
      throw new Error('POS client not initialized');
    }

    try {
      const response = await client.get('/api/sales', {
        params: {
          from_date: fromDate.toISOString(),
        },
      });

      const sales = response.data;

      // Process and store sales data
      // ... implementation

      return {
        success: true,
        salesCount: sales.length,
      };
    } catch (error: any) {
      logger.error('Failed to sync POS sales:', error);
      throw error;
    }
  }

  // ========== HELPER METHODS ==========

  /**
   * Get integration by tenant and type
   */
  private async getIntegration(
    tenantId: string,
    type: string
  ): Promise<any> {
    return await db('portal.system_integrations')
      .where({ tenant_id: tenantId, type, is_active: true })
      .first();
  }

  /**
   * Get active integration by type
   */
  private async getActiveIntegration(type: string): Promise<any> {
    return await db('portal.system_integrations')
      .where({ type, is_active: true })
      .first();
  }

  /**
   * Test integration connection
   */
  async testIntegration(integrationId: string): Promise<any> {
    const config = await db('portal.system_integrations')
      .where({ id: integrationId })
      .first();

    if (!config) {
      throw new Error('Integration not found');
    }

    const client = this.integrations.get(integrationId);
    if (!client) {
      this.setupIntegration(config);
    }

    try {
      const response = await client!.get('/api/health');
      
      return {
        success: true,
        status: response.status,
        message: 'Connection successful',
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Connection failed',
        error: error.message,
      };
    }
  }
}

// Initialize service
export const externalSystemsService = new ExternalSystemsService();