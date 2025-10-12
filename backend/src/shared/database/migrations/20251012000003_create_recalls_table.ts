// File: backend/src/shared/database/migrations/20251012000003_create_recalls_table.ts
// Purpose: Create recalls table for medicine recall management

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create recalls table
  await knex.schema.withSchema('portal').createTable('recalls', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    
    // Recall identification
    table.string('recall_number', 50).notNullable().unique().index();
    table.uuid('medicine_id').notNullable().index();
    
    // Severity and classification
    table.enum('severity', ['class_1', 'class_2', 'class_3']).notNullable().index();
    table.string('reason', 255).notNullable();
    table.text('description').notNullable();
    
    // Affected products
    table.specificType('batch_numbers', 'text[]').notNullable();
    table.integer('affected_quantity');
    
    // Dates
    table.date('recall_date').notNullable().index();
    table.date('deadline');
    
    // Status
    table.enum('status', ['initiated', 'in_progress', 'completed', 'cancelled'])
      .notNullable()
      .defaultTo('initiated')
      .index();
    
    // Action details
    table.text('action_required').notNullable();
    table.text('return_instructions');
    
    // Distribution
    table.enum('distribution_level', ['national', 'regional', 'facility_specific'])
      .notNullable()
      .defaultTo('national');
    table.specificType('affected_facilities', 'text[]');
    
    // Contact information
    table.string('contact_person', 255);
    table.string('contact_phone', 50);
    table.string('contact_email', 255);
    
    // Workflow tracking
    table.uuid('initiated_by').notNullable();
    table.uuid('approved_by');
    table.uuid('completed_by');
    table.timestamp('completed_at');
    table.uuid('cancelled_by');
    table.timestamp('cancelled_at');
    table.text('cancellation_reason');
    
    // Documents
    table.specificType('documents', 'text[]');
    
    // Timestamps
    table.timestamps(true, true);
    
    // Indexes
    table.index(['medicine_id', 'status']);
    table.index(['recall_date', 'severity']);
  });

  // Create index for full-text search
  await knex.raw(`
    CREATE INDEX idx_recalls_fulltext 
    ON portal.recalls 
    USING gin(to_tsvector('english', recall_number || ' ' || reason || ' ' || description))
  `);

  // Create foreign key
  await knex.raw(`
    ALTER TABLE portal.recalls
    ADD CONSTRAINT fk_recalls_medicine
    FOREIGN KEY (medicine_id)
    REFERENCES portal.medicines(id)
    ON DELETE RESTRICT
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema('portal').dropTableIfExists('recalls');
}

