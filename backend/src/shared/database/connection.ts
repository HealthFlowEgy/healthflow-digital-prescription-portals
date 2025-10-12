// File: backend/src/shared/database/connection.ts
// Purpose: Database connection management with Knex

import knex, { Knex } from 'knex';
import { config } from '../../config';
import { logger } from '../utils/logger';

const knexConfig: Knex.Config = {
  client: 'postgresql',
  connection: config.database.url,
  pool: {
    min: config.database.pool.min,
    max: config.database.pool.max,
  },
  searchPath: [config.database.schema, 'public'],
  acquireConnectionTimeout: 10000,
};

// Create database instance
export const db = knex(knexConfig);

// Test connection
db.raw('SELECT 1')
  .then(() => {
    logger.info('✅ Database connection established');
  })
  .catch((err) => {
    logger.error('❌ Database connection failed:', err);
    // Don't exit in development
    if (config.nodeEnv === 'production') {
      process.exit(1);
    }
  });

// Graceful shutdown
process.on('SIGTERM', async () => {
  await db.destroy();
  logger.info('Database connection closed');
});

// Helper function to execute queries with logging
export async function executeQuery<T>(
  queryBuilder: Knex.QueryBuilder,
  operationName: string
): Promise<T> {
  const startTime = Date.now();
  try {
    const result = await queryBuilder;
    const duration = Date.now() - startTime;
    logger.debug(`Query ${operationName} completed in ${duration}ms`);
    return result as T;
  } catch (error) {
    logger.error(`Query ${operationName} failed:`, error);
    throw error;
  }
}

// Transaction helper
export async function withTransaction<T>(
  callback: (trx: Knex.Transaction) => Promise<T>
): Promise<T> {
  return db.transaction(callback);
}

