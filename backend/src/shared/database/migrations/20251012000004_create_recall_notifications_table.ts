// File: backend/src/shared/database/migrations/20251012000004_create_recall_notifications_table.ts
// Purpose: Create recall_notifications table for tracking notification delivery

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create recall_notifications table
  await knex.schema.withSchema('portal').createTable('recall_notifications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    
    // Recall reference
    table.uuid('recall_id').notNullable().index();
    
    // Recipient information
    table.enum('recipient_type', ['doctor', 'pharmacist', 'facility', 'patient'])
      .notNullable()
      .index();
    table.uuid('recipient_id').notNullable().index();
    table.string('recipient_name', 255).notNullable();
    table.string('recipient_email', 255);
    table.string('recipient_phone', 50);
    
    // Notification details
    table.enum('channel', ['email', 'sms', 'push', 'portal']).notNullable();
    table.enum('status', ['pending', 'sent', 'delivered', 'failed', 'acknowledged'])
      .notNullable()
      .defaultTo('pending')
      .index();
    
    // Delivery tracking
    table.timestamp('sent_at');
    table.timestamp('delivered_at');
    table.timestamp('acknowledged_at');
    table.text('failure_reason');
    table.integer('retry_count').notNullable().defaultTo(0);
    
    // Timestamps
    table.timestamps(true, true);
    
    // Indexes
    table.index(['recall_id', 'status']);
    table.index(['recipient_type', 'recipient_id']);
  });

  // Create foreign key
  await knex.raw(`
    ALTER TABLE portal.recall_notifications
    ADD CONSTRAINT fk_recall_notifications_recall
    FOREIGN KEY (recall_id)
    REFERENCES portal.recalls(id)
    ON DELETE CASCADE
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema('portal').dropTableIfExists('recall_notifications');
}

