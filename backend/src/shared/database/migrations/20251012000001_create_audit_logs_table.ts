// File: backend/src/shared/database/migrations/20251012000001_create_audit_logs_table.ts
// Purpose: Create audit_logs table for HIPAA-compliant audit trail

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create schema if it doesn't exist
  await knex.raw('CREATE SCHEMA IF NOT EXISTS portal');

  // Create audit_logs table
  await knex.schema.withSchema('portal').createTable('audit_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    
    // User information
    table.uuid('user_id').notNullable().index();
    table.string('user_email', 255).notNullable();
    table.string('user_role', 50).notNullable().index();
    
    // Action details
    table.enum('action', ['CREATE', 'READ', 'UPDATE', 'DELETE']).notNullable().index();
    table.string('resource', 100).notNullable().index();
    table.string('resource_id', 255).index();
    
    // Change tracking
    table.jsonb('changes');
    
    // Request metadata
    table.string('ip_address', 45);
    table.text('user_agent');
    
    // Status
    table.boolean('success').notNullable().defaultTo(true).index();
    table.boolean('phi_accessed').notNullable().defaultTo(false).index();
    table.text('error_message');
    
    // Timestamp
    table.timestamp('timestamp').notNullable().defaultTo(knex.fn.now()).index();
    
    // Indexes for common queries
    table.index(['timestamp', 'phi_accessed']);
    table.index(['user_id', 'timestamp']);
    table.index(['resource', 'action', 'timestamp']);
  });

  // Create index on timestamp for time-range queries
  await knex.raw(`
    CREATE INDEX idx_audit_logs_timestamp_desc 
    ON portal.audit_logs (timestamp DESC)
  `);

  // Create index for PHI access queries
  await knex.raw(`
    CREATE INDEX idx_audit_logs_phi_access 
    ON portal.audit_logs (phi_accessed, timestamp DESC) 
    WHERE phi_accessed = true
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema('portal').dropTableIfExists('audit_logs');
}

