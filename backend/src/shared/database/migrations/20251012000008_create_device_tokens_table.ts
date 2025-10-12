// File: backend/database/migrations/20260203_create_device_tokens.ts
// Purpose: Store FCM/APNs device tokens

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.withSchema('portal').createTable('device_tokens', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    table.uuid('user_id').notNullable().references('id').inTable('public.users').onDelete('CASCADE');
    table.string('token', 500).notNullable().unique();
    table.enum('platform', ['ios', 'android']).notNullable();
    table.string('device_id', 200);
    table.string('device_model', 100);
    table.string('os_version', 50);
    table.string('app_version', 50);
    
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('last_used_at');
    
    table.timestamps(true, true);
    
    // Indexes
    table.index('user_id');
    table.index('platform');
    table.index('is_active');
    table.index(['user_id', 'is_active']);
  });

  console.log('✓ Created device_tokens table');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema('portal').dropTableIfExists('device_tokens');
}