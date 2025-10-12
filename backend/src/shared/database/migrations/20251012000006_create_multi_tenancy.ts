// File: backend/src/shared/database/migrations/20251012000006_create_multi_tenancy.ts
// Purpose: Multi-tenant architecture with tenant isolation and RBAC

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Enable UUID extension if not already enabled
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // Create tenants table
  await knex.schema.withSchema('portal').createTable('tenants', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name', 200).notNullable();
    table.string('slug', 100).notNullable().unique();
    table.enum('type', ['hospital', 'clinic', 'pharmacy', 'regulatory_agency', 'eda']).notNullable();
    
    // Contact information
    table.string('primary_contact_name', 200);
    table.string('primary_contact_email', 200);
    table.string('primary_contact_phone', 50);
    
    // Address
    table.string('address_line1', 300);
    table.string('address_line2', 300);
    table.string('city', 100);
    table.string('governorate', 100);
    table.string('postal_code', 20);
    table.string('country', 100).defaultTo('Egypt');
    
    // License information
    table.string('license_number', 100);
    table.date('license_expiry');
    table.enum('license_status', ['active', 'expired', 'suspended', 'revoked']).defaultTo('active');
    
    // Settings
    table.jsonb('settings').defaultTo('{}');
    table.jsonb('features_enabled').defaultTo('{}');
    
    // Subscription
    table.enum('subscription_tier', ['basic', 'professional', 'enterprise']).defaultTo('basic');
    table.integer('max_users').defaultTo(10);
    table.integer('current_users').defaultTo(0);
    
    // Status
    table.enum('status', ['active', 'suspended', 'inactive', 'pending_approval']).notNullable().defaultTo('pending_approval');
    table.text('suspension_reason');
    table.timestamp('suspended_at');
    
    // Metadata
    table.string('created_by');
    table.timestamps(true, true);
    table.timestamp('deleted_at');
    
    // Indexes
    table.index('slug');
    table.index('type');
    table.index('status');
    table.index('license_number');
  });

  // Create roles table
  await knex.schema.withSchema('portal').createTable('roles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name', 100).notNullable();
    table.string('slug', 100).notNullable();
    table.text('description');
    
    // Scope: system (global) or tenant (specific to tenant)
    table.enum('scope', ['system', 'tenant']).notNullable().defaultTo('tenant');
    table.uuid('tenant_id').references('id').inTable('portal.tenants').onDelete('CASCADE');
    
    // Permissions (stored as array)
    table.specificType('permissions', 'text[]').notNullable().defaultTo('{}');
    
    // Predefined system roles
    table.boolean('is_system_role').defaultTo(false);
    
    table.timestamps(true, true);
    
    // Unique constraint
    table.unique(['slug', 'tenant_id']);
    table.index('scope');
    table.index('tenant_id');
  });

  // Create user_tenants junction table (users can belong to multiple tenants)
  await knex.schema.withSchema('portal').createTable('user_tenants', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('user_id').notNullable();
    table.uuid('tenant_id').notNullable().references('id').inTable('portal.tenants').onDelete('CASCADE');
    table.uuid('role_id').notNullable().references('id').inTable('portal.roles').onDelete('RESTRICT');
    
    // Status
    table.enum('status', ['active', 'inactive', 'invited', 'suspended']).notNullable().defaultTo('active');
    table.date('joined_at').defaultTo(knex.fn.now());
    table.date('last_active_at');
    
    // Invitation
    table.string('invited_by');
    table.timestamp('invited_at');
    
    table.timestamps(true, true);
    
    // Unique constraint - user can only have one role per tenant
    table.unique(['user_id', 'tenant_id']);
    table.index('user_id');
    table.index('tenant_id');
    table.index('status');
  });

  // Create invitations table
  await knex.schema.withSchema('portal').createTable('invitations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('portal.tenants').onDelete('CASCADE');
    table.string('email', 200).notNullable();
    table.uuid('role_id').notNullable().references('id').inTable('portal.roles').onDelete('RESTRICT');
    
    // Token for email verification
    table.string('token', 100).notNullable().unique();
    
    // Status
    table.enum('status', ['pending', 'accepted', 'expired', 'revoked']).notNullable().defaultTo('pending');
    
    // Metadata
    table.string('invited_by').notNullable();
    table.timestamp('invited_at').defaultTo(knex.fn.now());
    table.timestamp('expires_at').notNullable();
    table.timestamp('accepted_at');
    table.string('accepted_by');
    
    table.timestamps(true, true);
    
    // Indexes
    table.index('token');
    table.index('email');
    table.index('tenant_id');
    table.index('status');
    table.index('expires_at');
  });

  // Create permissions table (for granular permission tracking)
  await knex.schema.withSchema('portal').createTable('permissions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name', 100).notNullable().unique();
    table.string('slug', 100).notNullable().unique();
    table.text('description');
    table.string('category', 50); // e.g., 'medicines', 'recalls', 'users'
    table.timestamps(true, true);
  });

  // Insert system roles
  await knex('portal.roles').insert([
    {
      name: 'Super Admin',
      slug: 'super_admin',
      description: 'Full system access - EDA administrators',
      scope: 'system',
      is_system_role: true,
      permissions: knex.raw("ARRAY['system:*', 'tenants:*', 'users:*', 'roles:*', 'medicines:*', 'recalls:*', 'adverse_events:*', 'audit:*', 'analytics:*']")
    },
    {
      name: 'EDA Officer',
      slug: 'eda_officer',
      description: 'Regulatory officer with oversight capabilities',
      scope: 'system',
      is_system_role: true,
      permissions: knex.raw("ARRAY['medicines:*', 'recalls:*', 'adverse_events:*', 'audit:read', 'analytics:read']")
    },
    {
      name: 'Tenant Admin',
      slug: 'tenant_admin',
      description: 'Administrator for a specific facility',
      scope: 'tenant',
      is_system_role: true,
      permissions: knex.raw("ARRAY['tenant:read', 'tenant:update', 'users:*', 'roles:read', 'medicines:read', 'prescriptions:*', 'analytics:read']")
    },
    {
      name: 'Doctor',
      slug: 'doctor',
      description: 'Medical doctor with prescription capabilities',
      scope: 'tenant',
      is_system_role: true,
      permissions: knex.raw("ARRAY['tenant:read', 'medicines:read', 'prescriptions:create', 'prescriptions:read', 'prescriptions:update', 'patients:*', 'adverse_events:create', 'adverse_events:read']")
    },
    {
      name: 'Pharmacist',
      slug: 'pharmacist',
      description: 'Pharmacist with dispensing capabilities',
      scope: 'tenant',
      is_system_role: true,
      permissions: knex.raw("ARRAY['tenant:read', 'medicines:read', 'prescriptions:read', 'prescriptions:dispense', 'inventory:*', 'adverse_events:create', 'adverse_events:read']")
    },
    {
      name: 'Nurse',
      slug: 'nurse',
      description: 'Nursing staff with limited access',
      scope: 'tenant',
      is_system_role: true,
      permissions: knex.raw("ARRAY['tenant:read', 'medicines:read', 'prescriptions:read', 'patients:read', 'patients:update']")
    },
    {
      name: 'Viewer',
      slug: 'viewer',
      description: 'Read-only access',
      scope: 'tenant',
      is_system_role: true,
      permissions: knex.raw("ARRAY['tenant:read', 'medicines:read', 'analytics:read']")
    }
  ]);

  // Insert permission definitions
  await knex('portal.permissions').insert([
    // System permissions
    { name: 'Manage System', slug: 'system:*', description: 'Full system administration', category: 'system' },
    { name: 'Manage Tenants', slug: 'tenants:*', description: 'Create, read, update, delete tenants', category: 'tenants' },
    { name: 'View Tenants', slug: 'tenants:read', description: 'View tenant information', category: 'tenants' },
    
    // User permissions
    { name: 'Manage Users', slug: 'users:*', description: 'Full user management', category: 'users' },
    { name: 'Create Users', slug: 'users:create', description: 'Create new users', category: 'users' },
    { name: 'View Users', slug: 'users:read', description: 'View user information', category: 'users' },
    { name: 'Update Users', slug: 'users:update', description: 'Update user information', category: 'users' },
    { name: 'Delete Users', slug: 'users:delete', description: 'Delete users', category: 'users' },
    
    // Role permissions
    { name: 'Manage Roles', slug: 'roles:*', description: 'Full role management', category: 'roles' },
    { name: 'View Roles', slug: 'roles:read', description: 'View roles', category: 'roles' },
    
    // Medicine permissions
    { name: 'Manage Medicines', slug: 'medicines:*', description: 'Full medicine management', category: 'medicines' },
    { name: 'View Medicines', slug: 'medicines:read', description: 'View medicine directory', category: 'medicines' },
    
    // Prescription permissions
    { name: 'Manage Prescriptions', slug: 'prescriptions:*', description: 'Full prescription management', category: 'prescriptions' },
    { name: 'Create Prescriptions', slug: 'prescriptions:create', description: 'Create prescriptions', category: 'prescriptions' },
    { name: 'View Prescriptions', slug: 'prescriptions:read', description: 'View prescriptions', category: 'prescriptions' },
    { name: 'Dispense Prescriptions', slug: 'prescriptions:dispense', description: 'Dispense medications', category: 'prescriptions' },
    
    // Recall permissions
    { name: 'Manage Recalls', slug: 'recalls:*', description: 'Full recall management', category: 'recalls' },
    { name: 'View Recalls', slug: 'recalls:read', description: 'View recalls', category: 'recalls' },
    
    // Adverse event permissions
    { name: 'Manage Adverse Events', slug: 'adverse_events:*', description: 'Full adverse event management', category: 'adverse_events' },
    { name: 'Report Adverse Events', slug: 'adverse_events:create', description: 'Report adverse events', category: 'adverse_events' },
    { name: 'View Adverse Events', slug: 'adverse_events:read', description: 'View adverse events', category: 'adverse_events' },
    
    // Audit permissions
    { name: 'View Audit Logs', slug: 'audit:read', description: 'View audit logs', category: 'audit' },
    
    // Analytics permissions
    { name: 'View Analytics', slug: 'analytics:read', description: 'View analytics and reports', category: 'analytics' }
  ]);

  // Add tenant_id to existing tables for multi-tenancy
  await knex.schema.withSchema('portal').alterTable('medicines', (table) => {
    table.uuid('tenant_id').references('id').inTable('portal.tenants').onDelete('SET NULL');
    table.index('tenant_id');
  });

  await knex.schema.withSchema('portal').alterTable('recalls', (table) => {
    table.uuid('tenant_id').references('id').inTable('portal.tenants').onDelete('SET NULL');
    table.index('tenant_id');
  });

  await knex.schema.withSchema('portal').alterTable('adverse_events', (table) => {
    table.uuid('tenant_id').references('id').inTable('portal.tenants').onDelete('SET NULL');
    table.index('tenant_id');
  });

  console.log('✓ Created multi-tenancy schema with RBAC');
}

export async function down(knex: Knex): Promise<void> {
  // Remove tenant_id from existing tables
  await knex.schema.withSchema('portal').alterTable('adverse_events', (table) => {
    table.dropColumn('tenant_id');
  });

  await knex.schema.withSchema('portal').alterTable('recalls', (table) => {
    table.dropColumn('tenant_id');
  });

  await knex.schema.withSchema('portal').alterTable('medicines', (table) => {
    table.dropColumn('tenant_id');
  });

  // Drop tables in reverse order
  await knex.schema.withSchema('portal').dropTableIfExists('invitations');
  await knex.schema.withSchema('portal').dropTableIfExists('user_tenants');
  await knex.schema.withSchema('portal').dropTableIfExists('permissions');
  await knex.schema.withSchema('portal').dropTableIfExists('roles');
  await knex.schema.withSchema('portal').dropTableIfExists('tenants');
}

