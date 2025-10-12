// File: backend/src/shared/database/migrations/20251012000002_create_medicines_table.ts
// Purpose: Create medicines table for EDA medicine directory

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create medicines table
  await knex.schema.withSchema('portal').createTable('medicines', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    
    // Basic information
    table.string('trade_name', 255).notNullable().index();
    table.string('generic_name', 255).notNullable().index();
    table.string('eda_registration_number', 100).notNullable().unique();
    
    // Manufacturer details
    table.string('manufacturer', 255).index();
    table.string('strength', 100);
    table.string('dosage_form', 100);
    
    // Classification
    table.string('therapeutic_class', 100).index();
    table.string('drug_class', 100);
    table.string('atc_code', 20);
    
    // Registration details
    table.date('registration_date').notNullable();
    table.date('expiry_date').notNullable();
    
    // Status management
    table.enum('status', ['active', 'partial_disabled', 'permanently_disabled', 'recalled'])
      .notNullable()
      .defaultTo('active')
      .index();
    
    // Availability flags
    table.boolean('available_for_prescription').notNullable().defaultTo(true);
    table.boolean('available_for_dispensing').notNullable().defaultTo(true);
    table.boolean('prescription_required').notNullable().defaultTo(true);
    
    // Controlled substance tracking
    table.boolean('controlled_substance').notNullable().defaultTo(false);
    table.string('schedule_class', 20);
    
    // Disable/Recall information
    table.text('disable_reason');
    table.timestamp('disabled_at');
    table.jsonb('recall_info');
    
    // Product details
    table.specificType('packaging_sizes', 'text[]');
    table.text('storage_conditions');
    table.specificType('warnings', 'text[]');
    table.specificType('interactions', 'text[]');
    table.specificType('side_effects', 'text[]');
    
    // Pricing
    table.decimal('price_min', 10, 2);
    table.decimal('price_max', 10, 2);
    
    // Metadata
    table.uuid('created_by').notNullable();
    table.uuid('last_modified_by').notNullable();
    table.timestamps(true, true);
    
    // Full-text search index
    table.index(['trade_name', 'generic_name'], 'idx_medicines_search');
  });

  // Create full-text search index for PostgreSQL
  await knex.raw(`
    CREATE INDEX idx_medicines_fulltext 
    ON portal.medicines 
    USING gin(to_tsvector('english', trade_name || ' ' || generic_name || ' ' || COALESCE(manufacturer, '')))
  `);

  // Create index for expiry date monitoring
  await knex.raw(`
    CREATE INDEX idx_medicines_expiry 
    ON portal.medicines (expiry_date) 
    WHERE status = 'active'
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema('portal').dropTableIfExists('medicines');
}

