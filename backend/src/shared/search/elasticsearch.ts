// File: backend/src/shared/search/elasticsearch.ts
// Purpose: Elasticsearch client for search functionality

import { Client } from '@elastic/elasticsearch';
import { config } from '../../config';
import { logger } from '../utils/logger';

export const esClient = new Client({
  node: config.elasticsearch.url,
  requestTimeout: 30000,
  maxRetries: 3,
});

// Test connection
esClient
  .ping()
  .then(() => {
    logger.info('✅ Elasticsearch connection established');
  })
  .catch((err) => {
    logger.warn('⚠️  Elasticsearch connection failed, search will be limited:', err.message);
  });

// Helper function to create index if it doesn't exist
export async function ensureIndex(indexName: string, mapping?: any): Promise<void> {
  try {
    const exists = await esClient.indices.exists({ index: indexName });
    
    if (!exists) {
      await esClient.indices.create({
        index: indexName,
        body: mapping,
      });
      logger.info(`Created Elasticsearch index: ${indexName}`);
    }
  } catch (error) {
    logger.error(`Failed to create Elasticsearch index ${indexName}:`, error);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await esClient.close();
  logger.info('Elasticsearch connection closed');
});

