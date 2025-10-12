// File: backend/src/shared/database/migrations/20251012000005_create_adverse_events_table.ts
// Purpose: Create adverse_events table for adverse event reporting

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create adverse_events table
  await knex.schema.withSchema('portal').createTable('adverse_events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    
    // Report identification
    table.string('report_number', 50).notNullable().unique().index();
    
    // Medicine information
    table.uuid('medicine_id').notNullable().index();
    table.string('batch_number', 100);
    
    // Patient information (anonymized)
    table.integer('patient_age');
    table.enum('patient_gender', ['male', 'female', 'other']);
    table.string('patient_weight', 20);
    
    // Event details
    table.enum('severity', ['mild', 'moderate', 'severe', 'life_threatening', 'fatal'])
      .notNullable()
      .index();
    table.date('event_date').notNullable();
    table.text('description').notNullable();
    table.specificType('symptoms', 'text[]');
    table.text('outcome');
    table.boolean('hospitalization_required').defaultTo(false);
    table.integer('hospitalization_days');
    
    // Medical history
    table.text('medical_history');
    table.text('concomitant_medications');
    table.text('allergies');
    
    // Reporter information
    table.enum('reporter_type', ['doctor', 'pharmacist', 'patient', 'other'])
      .notNullable();
    table.string('reporter_name', 255).notNullable();
    table.string('reporter_email', 255);
    table.string('reporter_phone', 50);
    table.string('reporter_facility', 255);
    
    // Status and workflow
    table.enum('status', ['submitted', 'under_review', 'investigated', 'closed'])
      .notNullable()
      .defaultTo('submitted')
      .index();
    table.uuid('reviewed_by');
    table.timestamp('reviewed_at');
    table.text('review_notes');
    table.enum('action_taken', ['none', 'label_update', 'recall', 'investigation'])
      .defaultTo('none');
    
    // Follow-up
    table.boolean('follow_up_required').defaultTo(false);
    table.date('follow_up_date');
    table.text('follow_up_notes');
    
    // Documents
    table.specificType('attachments', 'text[]');
    
    // Timestamps
    table.timestamps(true, true);
    
    // Indexes
    table.index(['medicine_id', 'severity']);
    table.index(['event_date', 'status']);
  });

  // Create index for full-text search
  await knex.raw(`
    CREATE INDEX idx_adverse_events_fulltext 
    ON portal.adverse_events 
    USING gin(to_tsvector('english', report_number || ' ' || description))
  `);

  // Create foreign key
  await knex.raw(`
    ALTER TABLE portal.adverse_events
    ADD CONSTRAINT fk_adverse_events_medicine
    FOREIGN KEY (medicine_id)
    REFERENCES portal.medicines(id)
    ON DELETE RESTRICT
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema('portal').dropTableIfExists('adverse_events');
}

