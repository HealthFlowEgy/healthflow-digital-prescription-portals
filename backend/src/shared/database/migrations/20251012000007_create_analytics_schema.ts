import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create dashboards table
  await knex.schema.withSchema('portal').createTable('dashboards', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name', 200).notNullable();
    table.string('slug', 100).notNullable();
    table.text('description');
    
    // Scope
    table.enum('scope', ['system', 'tenant']).notNullable().defaultTo('system');
    table.uuid('tenant_id').references('id').inTable('portal.tenants').onDelete('CASCADE');
    
    // Configuration
    table.jsonb('layout').notNullable().defaultTo('{}');
    table.jsonb('widgets').notNullable().defaultTo('[]');
    table.jsonb('filters').defaultTo('{}');
    table.jsonb('settings').defaultTo('{}');
    
    // Access control
    table.boolean('is_public').defaultTo(false);
    table.boolean('is_default').defaultTo(false);
    table.specificType('shared_with_roles', 'text[]').defaultTo('{}');
    
    // Metadata
    table.uuid('created_by').notNullable().references('id').inTable('public.users');
    table.timestamps(true, true);
    table.timestamp('deleted_at');
    
    // Indexes
    table.unique(['slug', 'tenant_id']);
    table.index('scope');
    table.index('tenant_id');
    table.index('created_by');
    table.index('is_public');
  });

  // Create reports table
  await knex.schema.withSchema('portal').createTable('reports', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name', 200).notNullable();
    table.string('slug', 100).notNullable();
    table.text('description');
    
    // Type and category
    table.enum('type', [
      'audit_summary',
      'medicine_catalog',
      'recall_summary',
      'adverse_event_summary',
      'user_activity',
      'tenant_overview',
      'compliance',
      'custom'
    ]).notNullable();
    table.string('category', 100);
    
    // Scope
    table.enum('scope', ['system', 'tenant']).notNullable().defaultTo('system');
    table.uuid('tenant_id').references('id').inTable('portal.tenants').onDelete('CASCADE');
    
    // Configuration
    table.jsonb('query_config').notNullable();
    table.jsonb('visualization_config').defaultTo('{}');
    table.jsonb('filters').defaultTo('{}');
    table.enum('format', ['pdf', 'excel', 'csv', 'json']).notNullable().defaultTo('pdf');
    
    // Scheduling
    table.boolean('is_scheduled').defaultTo(false);
    table.string('cron_expression', 100);
    table.timestamp('last_run_at');
    table.timestamp('next_run_at');
    
    // Access control
    table.boolean('is_public').defaultTo(false);
    table.specificType('shared_with_roles', 'text[]').defaultTo('{}');
    table.specificType('recipients', 'text[]').defaultTo('{}');
    
    // Metadata
    table.uuid('created_by').notNullable().references('id').inTable('public.users');
    table.timestamps(true, true);
    table.timestamp('deleted_at');
    
    // Indexes
    table.unique(['slug', 'tenant_id']);
    table.index('type');
    table.index('scope');
    table.index('tenant_id');
    table.index('is_scheduled');
    table.index('next_run_at');
  });

  // Create report_executions table
  await knex.schema.withSchema('portal').createTable('report_executions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('report_id').notNullable().references('id').inTable('portal.reports').onDelete('CASCADE');
    
    // Execution details
    table.enum('status', ['pending', 'running', 'completed', 'failed']).notNullable().defaultTo('pending');
    table.timestamp('started_at');
    table.timestamp('completed_at');
    table.integer('duration_ms');
    
    // Results
    table.string('file_path', 500);
    table.string('file_name', 200);
    table.bigInteger('file_size');
    table.string('download_url', 500);
    table.timestamp('expires_at');
    
    // Execution context
    table.jsonb('parameters').defaultTo('{}');
    table.jsonb('filters_applied').defaultTo('{}');
    table.integer('rows_processed');
    
    // Error handling
    table.text('error_message');
    table.jsonb('error_details');
    
    // Triggered by
    table.enum('trigger_type', ['manual', 'scheduled', 'api']).notNullable();
    table.uuid('triggered_by').references('id').inTable('public.users');
    
    table.timestamps(true, true);
    
    // Indexes
    table.index('report_id');
    table.index('status');
    table.index(['report_id', 'created_at']);
    table.index('expires_at');
  });

  // Create data_exports table
  await knex.schema.withSchema('portal').createTable('data_exports', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    // Export details
    table.string('name', 200).notNullable();
    table.enum('export_type', [
      'medicines',
      'audit_logs',
      'recalls',
      'adverse_events',
      'users',
      'tenants',
      'custom_query'
    ]).notNullable();
    
    table.enum('format', ['csv', 'excel', 'json', 'xml']).notNullable().defaultTo('csv');
    table.enum('status', ['pending', 'processing', 'completed', 'failed']).notNullable().defaultTo('pending');
    
    // Query and filters
    table.jsonb('query').notNullable();
    table.jsonb('filters').defaultTo('{}');
    table.specificType('columns', 'text[]');
    
    // Results
    table.string('file_path', 500);
    table.string('file_name', 200);
    table.bigInteger('file_size');
    table.string('download_url', 500);
    table.integer('record_count');
    table.timestamp('expires_at');
    
    // Processing
    table.timestamp('started_at');
    table.timestamp('completed_at');
    table.integer('duration_ms');
    table.text('error_message');
    
    // Metadata
    table.uuid('tenant_id').references('id').inTable('portal.tenants').onDelete('CASCADE');
    table.uuid('requested_by').notNullable().references('id').inTable('public.users');
    table.timestamps(true, true);
    
    // Indexes
    table.index('export_type');
    table.index('status');
    table.index('tenant_id');
    table.index('requested_by');
    table.index('expires_at');
    table.index('created_at');
  });

  // Create analytics_cache table (for performance)
  await knex.schema.withSchema('portal').createTable('analytics_cache', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    // Cache key
    table.string('cache_key', 255).notNullable().unique();
    table.string('category', 100).notNullable();
    
    // Scope
    table.uuid('tenant_id').references('id').inTable('portal.tenants').onDelete('CASCADE');
    
    // Cached data
    table.jsonb('data').notNullable();
    table.jsonb('metadata').defaultTo('{}');
    
    // Cache control
    table.timestamp('computed_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('expires_at').notNullable();
    table.integer('ttl_seconds').notNullable().defaultTo(3600);
    
    // Statistics
    table.integer('hit_count').defaultTo(0);
    table.timestamp('last_accessed_at');
    
    table.timestamps(true, true);
    
    // Indexes
    table.index('category');
    table.index('tenant_id');
    table.index('expires_at');
    table.index(['category', 'tenant_id']);
  });

  // Create kpi_metrics table
  await knex.schema.withSchema('portal').createTable('kpi_metrics', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    // Metric details
    table.string('metric_name', 100).notNullable();
    table.string('metric_type', 50).notNullable(); // count, sum, avg, percentage, etc.
    table.string('category', 100).notNullable();
    
    // Scope
    table.uuid('tenant_id').references('id').inTable('portal.tenants').onDelete('CASCADE');
    
    // Value
    table.decimal('value', 20, 4).notNullable();
    table.string('unit', 50);
    table.jsonb('dimensions').defaultTo('{}');
    
    // Time period
    table.date('metric_date').notNullable();
    table.string('period_type', 20).notNullable(); // daily, weekly, monthly, quarterly, yearly
    
    // Comparison
    table.decimal('previous_value', 20, 4);
    table.decimal('change_amount', 20, 4);
    table.decimal('change_percentage', 10, 2);
    
    table.timestamps(true, true);
    
    // Indexes
    table.index('metric_name');
    table.index('category');
    table.index('tenant_id');
    table.index('metric_date');
    table.index(['metric_name', 'tenant_id', 'metric_date']);
    table.index(['category', 'metric_date']);
  });

  // Create scheduled_jobs table
  await knex.schema.withSchema('portal').createTable('scheduled_jobs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    // Job details
    table.string('job_name', 200).notNullable();
    table.enum('job_type', [
      'report_generation',
      'data_aggregation',
      'cache_refresh',
      'data_cleanup',
      'notification',
      'custom'
    ]).notNullable();
    
    // Scheduling
    table.string('cron_expression', 100).notNullable();
    table.boolean('is_enabled').notNullable().defaultTo(true);
    table.timestamp('last_run_at');
    table.timestamp('next_run_at');
    table.enum('last_status', ['success', 'failed', 'skipped']).defaultTo('success');
    
    // Configuration
    table.jsonb('config').notNullable().defaultTo('{}');
    table.integer('timeout_seconds').defaultTo(3600);
    table.integer('retry_count').defaultTo(0);
    table.integer('max_retries').defaultTo(3);
    
    // Results
    table.integer('execution_count').defaultTo(0);
    table.integer('success_count').defaultTo(0);
    table.integer('failure_count').defaultTo(0);
    table.text('last_error');
    
    // Metadata
    table.uuid('tenant_id').references('id').inTable('portal.tenants').onDelete('CASCADE');
    table.uuid('created_by').notNullable().references('id').inTable('public.users');
    table.timestamps(true, true);
    
    // Indexes
    table.index('job_type');
    table.index('is_enabled');
    table.index('next_run_at');
    table.index('tenant_id');
  });

  console.log('✓ Created Sprint 4 analytics schema');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema('portal').dropTableIfExists('scheduled_jobs');
  await knex.schema.withSchema('portal').dropTableIfExists('kpi_metrics');
  await knex.schema.withSchema('portal').dropTableIfExists('analytics_cache');
  await knex.schema.withSchema('portal').dropTableIfExists('data_exports');
  await knex.schema.withSchema('portal').dropTableIfExists('report_executions');
  await knex.schema.withSchema('portal').dropTableIfExists('reports');
  await knex.schema.withSchema('portal').dropTableIfExists('dashboards');
}