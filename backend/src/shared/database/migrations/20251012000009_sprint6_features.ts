// File: backend/database/migrations/20260217_create_sprint6_tables.ts
// Purpose: Price comparison, interactions, and integrations schema

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ========== PHARMACIES TABLE ==========
  await knex.schema.withSchema('portal').createTable('pharmacies', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    table.string('name', 200).notNullable();
    table.string('license_number', 100).unique();
    table.text('address');
    table.string('city', 100);
    table.string('governorate', 100);
    table.decimal('latitude', 10, 8);
    table.decimal('longitude', 11, 8);
    table.string('phone', 50);
    table.string('email', 200);
    table.string('website', 300);
    
    table.boolean('delivery_available').defaultTo(false);
    table.decimal('delivery_fee', 10, 2);
    table.string('estimated_delivery_time', 50);
    
    table.decimal('rating', 3, 2);
    table.integer('review_count').defaultTo(0);
    
    table.jsonb('opening_hours').defaultTo('{}');
    table.boolean('open_24_7').defaultTo(false);
    
    table.enum('status', ['active', 'inactive', 'suspended']).defaultTo('active');
    
    table.timestamps(true, true);
    table.timestamp('deleted_at');
    
    // Indexes
    table.index('city');
    table.index('governorate');
    table.index('status');
    table.index(['latitude', 'longitude']);
  });

  // ========== PHARMACY PRICES TABLE ==========
  await knex.schema.withSchema('portal').createTable('pharmacy_prices', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    table.uuid('pharmacy_id').notNullable().references('id').inTable('portal.pharmacies').onDelete('CASCADE');
    table.uuid('medicine_id').notNullable().references('id').inTable('portal.medicines').onDelete('CASCADE');
    
    table.decimal('price', 10, 2).notNullable();
    table.string('currency', 3).defaultTo('EGP');
    
    table.boolean('in_stock').defaultTo(true);
    table.integer('quantity');
    
    table.boolean('is_active').defaultTo(true);
    
    table.timestamps(true, true);
    
    // Indexes
    table.unique(['pharmacy_id', 'medicine_id']);
    table.index('medicine_id');
    table.index('price');
    table.index('in_stock');
  });

  // ========== PRICE HISTORY TABLE ==========
  await knex.schema.withSchema('portal').createTable('price_history', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    table.uuid('medicine_id').notNullable().references('id').inTable('portal.medicines').onDelete('CASCADE');
    table.uuid('pharmacy_id').notNullable().references('id').inTable('portal.pharmacies').onDelete('CASCADE');
    
    table.decimal('old_price', 10, 2);
    table.decimal('new_price', 10, 2).notNullable();
    table.decimal('change_percentage', 6, 2);
    
    table.timestamp('recorded_at').notNullable().defaultTo(knex.fn.now());
    
    // Indexes
    table.index('medicine_id');
    table.index('pharmacy_id');
    table.index('recorded_at');
    table.index(['medicine_id', 'recorded_at']);
  });

  // ========== PRICE ALERTS TABLE ==========
  await knex.schema.withSchema('portal').createTable('price_alerts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    table.uuid('user_id').notNullable().references('id').inTable('public.users').onDelete('CASCADE');
    table.uuid('medicine_id').notNullable().references('id').inTable('portal.medicines').onDelete('CASCADE');
    
    table.decimal('target_price', 10, 2).notNullable();
    table.decimal('current_lowest_price', 10, 2);
    
    table.boolean('is_active').defaultTo(true);
    table.timestamp('triggered_at');
    
    table.timestamps(true, true);
    
    // Indexes
    table.index('user_id');
    table.index('medicine_id');
    table.index('is_active');
  });

  // ========== DRUG INTERACTIONS TABLE ==========
  await knex.schema.withSchema('portal').createTable('drug_interactions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    table.uuid('drug1_id').notNullable().references('id').inTable('portal.medicines');
    table.string('drug1_name', 200).notNullable();
    table.uuid('drug2_id').notNullable().references('id').inTable('portal.medicines');
    table.string('drug2_name', 200).notNullable();
    
    table.enum('severity', ['minor', 'moderate', 'major', 'contraindicated']).notNullable();
    table.text('description').notNullable();
    table.specificType('clinical_effects', 'text[]');
    table.text('mechanism');
    table.text('management');
    
    table.enum('evidence_level', ['theoretical', 'fair', 'good', 'excellent']).defaultTo('fair');
    table.specificType('references', 'text[]');
    
    table.timestamps(true, true);
    
    // Indexes
    table.index('drug1_id');
    table.index('drug2_id');
    table.index('severity');
    table.index(['drug1_id', 'drug2_id']);
  });

  // ========== INGREDIENT INTERACTIONS TABLE ==========
  await knex.schema.withSchema('portal').createTable('ingredient_interactions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    table.string('ingredient1', 200).notNullable();
    table.string('ingredient2', 200).notNullable();
    
    table.enum('severity', ['minor', 'moderate', 'major', 'contraindicated']).notNullable();
    table.text('description').notNullable();
    table.specificType('clinical_effects', 'text[]');
    table.text('mechanism');
    table.text('management');
    
    table.enum('evidence_level', ['theoretical', 'fair', 'good', 'excellent']).defaultTo('fair');
    table.specificType('references', 'text[]');
    
    table.timestamps(true, true);
    
    // Indexes
    table.index('ingredient1');
    table.index('ingredient2');
    table.index('severity');
  });

  // ========== DRUG-FOOD INTERACTIONS TABLE ==========
  await knex.schema.withSchema('portal').createTable('drug_food_interactions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    table.uuid('medicine_id').notNullable().references('id').inTable('portal.medicines').onDelete('CASCADE');
    table.string('food_item', 200).notNullable();
    table.text('effect').notNullable();
    table.enum('severity', ['minor', 'moderate', 'major']).notNullable();
    table.text('management');
    
    table.timestamps(true, true);
    
    // Indexes
    table.index('medicine_id');
    table.index('severity');
  });

  // ========== DRUG-ALCOHOL INTERACTIONS TABLE ==========
  await knex.schema.withSchema('portal').createTable('drug_alcohol_interactions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    table.uuid('medicine_id').notNullable().references('id').inTable('portal.medicines').onDelete('CASCADE');
    table.enum('severity', ['minor', 'moderate', 'major']).notNullable();
    table.specificType('effects', 'text[]').notNullable();
    table.text('recommendation').notNullable();
    
    table.timestamps(true, true);
    
    // Indexes
    table.index('medicine_id');
    table.index('severity');
  });

  // ========== SYSTEM INTEGRATIONS TABLE ==========
  await knex.schema.withSchema('portal').createTable('system_integrations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    table.string('name', 200).notNullable();
    table.enum('type', ['erp', 'lab', 'insurance', 'pharmacy_pos']).notNullable();
    table.uuid('tenant_id').references('id').inTable('portal.tenants').onDelete('CASCADE');
    table.uuid('pharmacy_id').references('id').inTable('portal.pharmacies').onDelete('CASCADE');
    
    table.string('base_url', 500).notNullable();
    table.string('api_key', 500).notNullable();
    table.text('api_secret'); // Encrypted
    
    table.jsonb('settings').defaultTo('{}');
    table.boolean('is_active').defaultTo(true);
    
    table.timestamp('last_sync_at');
    table.jsonb('last_sync_result');
    
    table.timestamps(true, true);
    
    // Indexes
    table.index('type');
    table.index('tenant_id');
    table.index('is_active');
  });

  // ========== PHARMACY INTEGRATIONS TABLE ==========
  await knex.schema.withSchema('portal').createTable('pharmacy_integrations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    table.uuid('pharmacy_id').notNullable().references('id').inTable('portal.pharmacies').onDelete('CASCADE');
    table.string('pharmacy_name', 200).notNullable();
    table.string('location', 300);
    
    table.string('api_url', 500).notNullable();
    table.string('api_key', 500).notNullable();
    
    table.boolean('is_active').defaultTo(true);
    
    table.timestamps(true, true);
    
    // Indexes
    table.index('pharmacy_id');
    table.index('is_active');
  });

  console.log('✓ Created Sprint 6 tables');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema('portal').dropTableIfExists('pharmacy_integrations');
  await knex.schema.withSchema('portal').dropTableIfExists('system_integrations');
  await knex.schema.withSchema('portal').dropTableIfExists('drug_alcohol_interactions');
  await knex.schema.withSchema('portal').dropTableIfExists('drug_food_interactions');
  await knex.schema.withSchema('portal').dropTableIfExists('ingredient_interactions');
  await knex.schema.withSchema('portal').dropTableIfExists('drug_interactions');
  await knex.schema.withSchema('portal').dropTableIfExists('price_alerts');
  await knex.schema.withSchema('portal').dropTableIfExists('price_history');
  await knex.schema.withSchema('portal').dropTableIfExists('pharmacy_prices');
  await knex.schema.withSchema('portal').dropTableIfExists('pharmacies');
}