-- Add Analytics Permissions for Sprint 4
-- This script adds analytics, reports, and exports permissions to the system

-- Add analytics permissions
INSERT INTO portal.permissions (name, slug, description, category, created_at, updated_at) VALUES
  ('View Analytics', 'analytics:read', 'View analytics and dashboards', 'analytics', NOW(), NOW()),
  ('Create Dashboards', 'dashboards:create', 'Create custom dashboards', 'analytics', NOW(), NOW()),
  ('Edit Dashboards', 'dashboards:update', 'Edit dashboards', 'analytics', NOW(), NOW()),
  ('Delete Dashboards', 'dashboards:delete', 'Delete dashboards', 'analytics', NOW(), NOW()),
  ('Create Reports', 'reports:create', 'Create custom reports', 'reports', NOW(), NOW()),
  ('Execute Reports', 'reports:execute', 'Execute and generate reports', 'reports', NOW(), NOW()),
  ('Schedule Reports', 'reports:schedule', 'Schedule automated reports', 'reports', NOW(), NOW()),
  ('Delete Reports', 'reports:delete', 'Delete reports', 'reports', NOW(), NOW()),
  ('Create Exports', 'exports:create', 'Create data exports', 'exports', NOW(), NOW()),
  ('Read Exports', 'exports:read', 'View and download exports', 'exports', NOW(), NOW()),
  ('Delete Exports', 'exports:delete', 'Delete data exports', 'exports', NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;

-- Update Super Admin role with all analytics permissions
UPDATE portal.roles 
SET permissions = array_cat(permissions, ARRAY[
  'analytics:read',
  'dashboards:create',
  'dashboards:update',
  'dashboards:delete',
  'reports:create',
  'reports:execute',
  'reports:schedule',
  'reports:delete',
  'exports:create',
  'exports:read',
  'exports:delete'
])
WHERE slug = 'super_admin'
AND NOT 'analytics:read' = ANY(permissions);

-- Update EDA Officer role with analytics permissions
UPDATE portal.roles 
SET permissions = array_cat(permissions, ARRAY[
  'analytics:read',
  'dashboards:create',
  'dashboards:update',
  'reports:create',
  'reports:execute',
  'reports:schedule',
  'exports:create',
  'exports:read'
])
WHERE slug = 'eda_officer'
AND NOT 'analytics:read' = ANY(permissions);

-- Update Tenant Admin role with read-only analytics permissions
UPDATE portal.roles 
SET permissions = array_cat(permissions, ARRAY[
  'analytics:read',
  'reports:execute',
  'exports:create',
  'exports:read'
])
WHERE slug = 'tenant_admin'
AND NOT 'analytics:read' = ANY(permissions);

-- Verify permissions were added
SELECT 
  r.name as role_name,
  r.slug as role_slug,
  array_length(r.permissions, 1) as permission_count,
  (SELECT COUNT(*) FROM unnest(r.permissions) p WHERE p LIKE 'analytics:%' OR p LIKE 'reports:%' OR p LIKE 'exports:%') as analytics_permissions
FROM portal.roles r
WHERE r.slug IN ('super_admin', 'eda_officer', 'tenant_admin')
ORDER BY r.name;

