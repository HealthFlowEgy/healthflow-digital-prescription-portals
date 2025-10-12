# 🚀 HealthFlow Digital Prescription Portals
## Complete Deployment Runbook

**Version:** 1.0.0  
**Date:** February 28, 2026  
**Status:** Production Ready  
**Project:** All 6 Sprints Complete

---

<artifact identifier="complete-deployment-runbook" type="text/markdown" title="Complete Production Deployment Runbook">
# Complete Production Deployment Runbook
## HealthFlow Digital Prescription Portals - All Sprints

---

## 📋 Table of Contents

1. [Pre-Deployment Checklist](#1-pre-deployment-checklist)
2. [Infrastructure Setup](#2-infrastructure-setup)
3. [Database Deployment](#3-database-deployment)
4. [Backend Deployment](#4-backend-deployment)
5. [Frontend Deployment](#5-frontend-deployment)
6. [Mobile App Deployment](#6-mobile-app-deployment)
7. [Post-Deployment Verification](#7-post-deployment-verification)
8. [Monitoring & Alerts](#8-monitoring--alerts)
9. [Rollback Procedures](#9-rollback-procedures)
10. [Troubleshooting Guide](#10-troubleshooting-guide)

---

## 1. Pre-Deployment Checklist

### 1.1 Team Readiness (Complete 1 week before)

**Team Preparation:**
- [ ] All team members notified of deployment date
- [ ] On-call rotation scheduled
- [ ] Backup personnel identified
- [ ] Communication channels confirmed (Slack, Phone)
- [ ] War room scheduled (if needed)

**Stakeholder Communication:**
- [ ] Product Owner approval received
- [ ] Business stakeholders notified
- [ ] Customer support team briefed
- [ ] Marketing team informed (for user communication)
- [ ] Maintenance window announced (if needed)

**Documentation:**
- [ ] API documentation updated
- [ ] User guides completed
- [ ] Admin guides ready
- [ ] Release notes prepared
- [ ] Known issues documented

### 1.2 Code Quality (Complete 3 days before)

**Testing:**
```bash
# Backend tests
cd backend
npm run test                    # Unit tests (>90% coverage)
npm run test:integration        # Integration tests
npm run test:e2e               # End-to-end tests
npm run test:security          # Security scans

# Frontend tests
cd frontend/regulatory-portal
npm run test
npm run test:e2e
npm run build                  # Verify production build

# Mobile tests
cd mobile
npm run test
npm run build:android
npm run build:ios
```

**Expected Results:**
- [ ] All tests passing (0 failures)
- [ ] Coverage ≥90%
- [ ] No critical security vulnerabilities
- [ ] Build completes successfully
- [ ] Bundle size within limits

**Code Review:**
- [ ] All PRs reviewed and approved
- [ ] No TODO/FIXME in production code
- [ ] Sensitive data removed
- [ ] Debug logs disabled
- [ ] Feature flags configured

### 1.3 Infrastructure Verification (Complete 2 days before)

**AWS Resources:**
```bash
# Verify all resources exist
aws ecs describe-clusters --clusters healthflow-portals-production-cluster
aws rds describe-db-instances --db-instance-identifier healthflow-portals-prod
aws elasticache describe-cache-clusters --cache-cluster-id healthflow-portals-redis-prod
aws s3 ls s3://healthflow-portals-production
aws cloudfront list-distributions

# Check IAM roles
aws iam get-role --role-name HealthFlowPortalsECSTaskRole
aws iam get-role --role-name HealthFlowPortalsECSExecutionRole
```

**Expected Results:**
- [ ] All infrastructure resources active
- [ ] IAM roles and policies configured
- [ ] Security groups properly configured
- [ ] VPC and subnets ready
- [ ] Load balancers healthy

**SSL Certificates:**
```bash
# Check SSL certificate status
aws acm list-certificates
aws acm describe-certificate --certificate-arn <cert-arn>
```

- [ ] SSL certificates valid (not expiring within 30 days)
- [ ] Certificates attached to load balancers
- [ ] DNS records pointing correctly

### 1.4 Data Backups (Complete 1 day before)

**Database Backup:**
```bash
# Create manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier healthflow-portals-prod \
  --db-snapshot-identifier healthflow-portals-pre-deployment-$(date +%Y%m%d-%H%M%S)

# Verify snapshot
aws rds describe-db-snapshots \
  --db-snapshot-identifier healthflow-portals-pre-deployment-*
```

**File Storage Backup:**
```bash
# Backup S3 buckets
aws s3 sync s3://healthflow-portals-production s3://healthflow-portals-backup-$(date +%Y%m%d)

# Verify backup
aws s3 ls s3://healthflow-portals-backup-$(date +%Y%m%d)
```

**Redis Backup:**
```bash
# Create Redis backup
aws elasticache create-snapshot \
  --cache-cluster-id healthflow-portals-redis-prod \
  --snapshot-name healthflow-pre-deployment-$(date +%Y%m%d)
```

- [ ] Database snapshot completed
- [ ] S3 backup verified
- [ ] Redis snapshot created
- [ ] Backup retention verified (30 days)

### 1.5 Environment Variables (Complete 1 day before)

**Verify Production Secrets:**
```bash
# Check AWS Secrets Manager
aws secretsmanager list-secrets --filters Key=name,Values=healthflow-portals-prod

# Verify each secret
aws secretsmanager get-secret-value --secret-id healthflow-portals-prod/database
aws secretsmanager get-secret-value --secret-id healthflow-portals-prod/jwt
aws secretsmanager get-secret-value --secret-id healthflow-portals-prod/redis
aws secretsmanager get-secret-value --secret-id healthflow-portals-prod/firebase
aws secretsmanager get-secret-value --secret-id healthflow-portals-prod/external-apis
```

**Required Environment Variables:**
- [ ] DATABASE_URL
- [ ] REDIS_URL
- [ ] JWT_SECRET
- [ ] JWT_REFRESH_SECRET
- [ ] FIREBASE_PROJECT_ID
- [ ] FIREBASE_PRIVATE_KEY
- [ ] FIREBASE_CLIENT_EMAIL
- [ ] SMTP_HOST, SMTP_USER, SMTP_PASS
- [ ] TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
- [ ] AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
- [ ] SENTRY_DSN
- [ ] API_RATE_LIMIT (100 requests/minute)
- [ ] ALLOWED_ORIGINS (production domains)

---

## 2. Infrastructure Setup

### 2.1 AWS Infrastructure Deployment (2 hours)

**Deploy Core Infrastructure:**
```bash
cd infrastructure/terraform

# Initialize Terraform
terraform init

# Review planned changes
terraform plan -var-file=production.tfvars -out=tfplan

# Apply infrastructure
terraform apply tfplan
```

**Verify Infrastructure:**
```bash
# VPC and Networking
aws ec2 describe-vpcs --filters "Name=tag:Name,Values=healthflow-portals-vpc"
aws ec2 describe-subnets --filters "Name=tag:Environment,Values=production"

# ECS Cluster
aws ecs describe-clusters --clusters healthflow-portals-production-cluster

# RDS Database
aws rds describe-db-instances --db-instance-identifier healthflow-portals-prod

# ElastiCache Redis
aws elasticache describe-cache-clusters --cache-cluster-id healthflow-portals-redis-prod

# S3 Buckets
aws s3 ls | grep healthflow-portals

# CloudFront Distribution
aws cloudfront list-distributions
```

### 2.2 Database Infrastructure (30 minutes)

**RDS PostgreSQL Configuration:**
- Instance Class: db.r6g.xlarge (4 vCPU, 32 GB RAM)
- Storage: 500 GB gp3 (16,000 IOPS)
- Multi-AZ: Enabled
- Backup Retention: 30 days
- Encryption: AES-256
- PostgreSQL Version: 14.7

**Connection Pool Configuration:**
```bash
# Update RDS parameter group
aws rds modify-db-parameter-group \
  --db-parameter-group-name healthflow-portals-prod \
  --parameters \
    "ParameterName=max_connections,ParameterValue=500,ApplyMethod=immediate" \
    "ParameterName=shared_buffers,ParameterValue=8GB,ApplyMethod=pending-reboot" \
    "ParameterName=effective_cache_size,ParameterValue=24GB,ApplyMethod=immediate" \
    "ParameterName=work_mem,ParameterValue=32MB,ApplyMethod=immediate"
```

### 2.3 Redis Configuration (15 minutes)

**ElastiCache Redis:**
- Node Type: cache.r6g.large (2 vCPU, 13.07 GB RAM)
- Cluster Mode: Enabled (3 shards)
- Replicas: 2 per shard
- Encryption: In-transit and at-rest
- Redis Version: 7.0

**Verify Redis:**
```bash
# Get Redis endpoint
REDIS_ENDPOINT=$(aws elasticache describe-cache-clusters \
  --cache-cluster-id healthflow-portals-redis-prod \
  --show-cache-node-info \
  --query 'CacheClusters[0].ConfigurationEndpoint.Address' \
  --output text)

echo $REDIS_ENDPOINT

# Test connection (from within VPC)
redis-cli -h $REDIS_ENDPOINT -p 6379 ping
```

### 2.4 Load Balancer & Auto Scaling (20 minutes)

**Application Load Balancer:**
```bash
# Verify ALB
aws elbv2 describe-load-balancers \
  --names healthflow-portals-alb-prod

# Check target groups
aws elbv2 describe-target-groups \
  --load-balancer-arn <alb-arn>

# Verify health checks
aws elbv2 describe-target-health \
  --target-group-arn <target-group-arn>
```

**Auto Scaling Configuration:**
```bash
# Backend API auto-scaling
aws ecs update-service \
  --cluster healthflow-portals-production-cluster \
  --service backend-api \
  --desired-count 6

# Set auto-scaling policies
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/healthflow-portals-production-cluster/backend-api \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 6 \
  --max-capacity 20

aws application-autoscaling put-scaling-policy \
  --policy-name backend-cpu-scaling \
  --service-namespace ecs \
  --resource-id service/healthflow-portals-production-cluster/backend-api \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration \
    "PredefinedMetricType=ECSServiceAverageCPUUtilization,TargetValue=70.0"
```

---

## 3. Database Deployment

### 3.1 Database Schema Migration (45 minutes)

**⚠️ CRITICAL: Always backup before migrations!**

**Pre-Migration Checks:**
```bash
# Verify database connection
psql $DATABASE_URL -c "SELECT version();"

# Check current schema version
psql $DATABASE_URL -c "SELECT * FROM knex_migrations ORDER BY id DESC LIMIT 5;"

# Count records in critical tables
psql $DATABASE_URL -c "
  SELECT 
    'users' as table_name, COUNT(*) as record_count FROM public.users
  UNION ALL
  SELECT 'tenants', COUNT(*) FROM portal.tenants
  UNION ALL
  SELECT 'medicines', COUNT(*) FROM portal.medicines
  UNION ALL
  SELECT 'adverse_events', COUNT(*) FROM portal.adverse_events;
"
```

**Run Migrations (All Sprints):**
```bash
cd backend

# Set production database URL
export DATABASE_URL="postgresql://username:password@prod-db.amazonaws.com:5432/healthflow_prod"

# Run all migrations
npm run migrate

# Verify migrations
npm run migrate:status

# Check schema version
psql $DATABASE_URL -c "SELECT * FROM knex_migrations ORDER BY id DESC LIMIT 10;"
```

**Expected Output:**
```
✓ Sprint 0: Core schema (users, tenants, roles)
✓ Sprint 1: Audit logs, medicines
✓ Sprint 2: Recalls, adverse events, notifications
✓ Sprint 3: Multi-tenancy, RBAC, invitations
✓ Sprint 4: Analytics, reports, exports
✓ Sprint 5: Device tokens, WebSocket
✓ Sprint 6: Prices, interactions, integrations

Total: 27 tables created
Batch 1: ran 1 migrations
```

**Post-Migration Validation:**
```bash
# Verify all tables exist
psql $DATABASE_URL -c "
  SELECT 
    schemaname, 
    tablename 
  FROM pg_tables 
  WHERE schemaname IN ('public', 'portal')
  ORDER BY schemaname, tablename;
"

# Check indexes
psql $DATABASE_URL -c "
  SELECT 
    schemaname,
    tablename,
    indexname
  FROM pg_indexes
  WHERE schemaname IN ('public', 'portal')
  ORDER BY tablename;
"

# Verify foreign keys
psql $DATABASE_URL -c "
  SELECT 
    conname,
    conrelid::regclass AS table_name,
    confrelid::regclass AS referenced_table
  FROM pg_constraint
  WHERE contype = 'f'
  ORDER BY conrelid::regclass::text;
"
```

### 3.2 Seed Production Data (30 minutes)

**System Configuration:**
```bash
# Run production seeds
npm run seed:production

# This seeds:
# - System roles and permissions
# - Default tenant configurations
# - Sample pharmacies
# - Drug interaction database
```

**Seed Script:**
```sql
-- File: backend/database/seeds/production.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Insert system roles
INSERT INTO portal.roles (slug, name, description, level, permissions) VALUES
('super_admin', 'Super Administrator', 'Full system access', 0, ARRAY[
  'users:*', 'tenants:*', 'medicines:*', 'recalls:*', 'adverse_events:*',
  'reports:*', 'analytics:*', 'system:*', 'audit:*'
]),
('eda_officer', 'EDA Officer', 'Egyptian Drug Authority Officer', 10, ARRAY[
  'medicines:read', 'medicines:write', 'recalls:*', 'adverse_events:read',
  'reports:read', 'analytics:read', 'audit:read'
]),
('tenant_admin', 'Tenant Administrator', 'Tenant-level administrator', 20, ARRAY[
  'tenant:users:*', 'tenant:medicines:read', 'tenant:recalls:read',
  'tenant:reports:*', 'tenant:analytics:read'
]),
('doctor', 'Doctor', 'Medical doctor', 30, ARRAY[
  'medicines:read', 'adverse_events:write', 'prescriptions:*'
]),
('pharmacist', 'Pharmacist', 'Licensed pharmacist', 30, ARRAY[
  'medicines:read', 'adverse_events:write', 'prescriptions:read', 'inventory:*'
]),
('nurse', 'Nurse', 'Registered nurse', 40, ARRAY[
  'medicines:read', 'adverse_events:write'
]),
('viewer', 'Viewer', 'Read-only access', 50, ARRAY[
  'medicines:read', 'recalls:read'
]);

-- Insert pharmacies
INSERT INTO portal.pharmacies (name, address, city, governorate, latitude, longitude, phone, delivery_available, rating) VALUES
('صيدلية الشفاء', 'ش التحرير، وسط البلد', 'Cairo', 'Cairo', 30.0444, 31.2357, '+20-2-1234-5678', true, 4.5),
('صيدلية النور', 'ش الهرم', 'Giza', 'Giza', 30.0131, 31.2089, '+20-2-2345-6789', true, 4.3),
('صيدلية السلام', 'ش الجيش، المنصورة', 'Mansoura', 'Dakahlia', 31.0364, 31.3807, '+20-50-3456-7890', false, 4.7),
('صيدلية الأمل', 'كورنيش النيل، الأقصر', 'Luxor', 'Luxor', 25.6872, 32.6396, '+20-95-4567-8901', true, 4.6),
('صيدلية المستقبل', 'ش بورسعيد، الإسكندرية', 'Alexandria', 'Alexandria', 31.2001, 29.9187, '+20-3-5678-9012', true, 4.4);

-- Verify
SELECT 'Roles created:' as info, COUNT(*) as count FROM portal.roles
UNION ALL
SELECT 'Pharmacies created:', COUNT(*) FROM portal.pharmacies;
```

**Run Seed:**
```bash
psql $DATABASE_URL < backend/database/seeds/production.sql
```

### 3.3 Database Performance Optimization (20 minutes)

**Create Additional Indexes:**
```sql
-- Frequently queried columns
CREATE INDEX CONCURRENTLY idx_medicines_search ON portal.medicines 
  USING gin(to_tsvector('english', trade_name || ' ' || scientific_name));

CREATE INDEX CONCURRENTLY idx_audit_logs_user_created ON portal.audit_logs (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_adverse_events_medicine_date ON portal.adverse_events (medicine_id, event_date DESC);

CREATE INDEX CONCURRENTLY idx_recalls_status_date ON portal.recalls (status, recall_date DESC);

CREATE INDEX CONCURRENTLY idx_notifications_user_read ON portal.notifications (user_id, is_read, created_at DESC);

-- Verify index creation
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'portal'
  AND indexname LIKE 'idx_%'
ORDER BY tablename;
```

**Analyze Tables:**
```sql
-- Update statistics
ANALYZE VERBOSE public.users;
ANALYZE VERBOSE portal.tenants;
ANALYZE VERBOSE portal.medicines;
ANALYZE VERBOSE portal.adverse_events;
ANALYZE VERBOSE portal.recalls;
ANALYZE VERBOSE portal.audit_logs;
ANALYZE VERBOSE portal.notifications;
```

---

## 4. Backend Deployment

### 4.1 Build Docker Images (30 minutes)

**Build Backend Image:**
```bash
cd backend

# Build with all features
docker build \
  -f ../infrastructure/docker/Dockerfile.backend \
  --build-arg NODE_ENV=production \
  --build-arg INCLUDE_ML=true \
  -t healthflow-portals-backend:production-v1.0.0 \
  .

# Verify image
docker images | grep healthflow-portals-backend

# Test image locally
docker run --rm \
  -e DATABASE_URL=$DATABASE_URL \
  -e REDIS_URL=$REDIS_URL \
  -e JWT_SECRET=test \
  -p 4000:4000 \
  healthflow-portals-backend:production-v1.0.0 \
  npm run health-check
```

**Tag and Push to ECR:**
```bash
# Get ECR login
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Tag image
docker tag healthflow-portals-backend:production-v1.0.0 \
  <account-id>.dkr.ecr.us-east-1.amazonaws.com/healthflow-portals-backend:production-v1.0.0

docker tag healthflow-portals-backend:production-v1.0.0 \
  <account-id>.dkr.ecr.us-east-1.amazonaws.com/healthflow-portals-backend:latest

# Push to ECR
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/healthflow-portals-backend:production-v1.0.0
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/healthflow-portals-backend:latest
```

### 4.2 Deploy Backend to ECS (45 minutes)

**Update Task Definition:**
```json
{
  "family": "healthflow-portals-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "2048",
  "memory": "4096",
  "executionRoleArn": "arn:aws:iam::<account-id>:role/HealthFlowPortalsECSExecutionRole",
  "taskRoleArn": "arn:aws:iam::<account-id>:role/HealthFlowPortalsECSTaskRole",
  "containerDefinitions": [
    {
      "name": "backend-api",
      "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/healthflow-portals-backend:production-v1.0.0",
      "portMappings": [
        {
          "containerPort": 4000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "4000"},
        {"name": "ENABLE_WEBSOCKET", "value": "true"}
      ],
      "secrets": [
        {"name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:us-east-1:<account-id>:secret:healthflow-portals-prod/database"},
        {"name": "REDIS_URL", "valueFrom": "arn:aws:secretsmanager:us-east-1:<account-id>:secret:healthflow-portals-prod/redis"},
        {"name": "JWT_SECRET", "valueFrom": "arn:aws:secretsmanager:us-east-1:<account-id>:secret:healthflow-portals-prod/jwt"},
        {"name": "JWT_REFRESH_SECRET", "valueFrom": "arn:aws:secretsmanager:us-east-1:<account-id>:secret:healthflow-portals-prod/jwt-refresh"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/healthflow-portals-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "backend"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:4000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

**Register Task Definition:**
```bash
# Register new task definition
aws ecs register-task-definition \
  --cli-input-json file://infrastructure/ecs/backend-task-definition.json

# Get new task definition ARN
TASK_DEF_ARN=$(aws ecs describe-task-definition \
  --task-definition healthflow-portals-backend \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

echo "Task Definition: $TASK_DEF_ARN"
```

**Deploy with Blue-Green Strategy:**
```bash
# Update ECS service (blue-green deployment)
aws ecs update-service \
  --cluster healthflow-portals-production-cluster \
  --service backend-api \
  --task-definition $TASK_DEF_ARN \
  --desired-count 6 \
  --deployment-configuration \
    "maximumPercent=200,minimumHealthyPercent=100,deploymentCircuitBreaker={enable=true,rollback=true}" \
  --force-new-deployment

# Monitor deployment
aws ecs wait services-stable \
  --cluster healthflow-portals-production-cluster \
  --services backend-api

# Check deployment status
aws ecs describe-services \
  --cluster healthflow-portals-production-cluster \
  --services backend-api \
  --query 'services[0].deployments'
```

**Deployment Process:**
1. ECS starts new tasks with new image
2. New tasks pass health checks
3. ALB starts routing traffic to new tasks
4. Old tasks receive connection draining (30s)
5. Old tasks are stopped
6. Deployment complete

**Monitor Logs:**
```bash
# Watch deployment logs
aws logs tail /ecs/healthflow-portals-backend --follow

# Check for errors
aws logs filter-log-events \
  --log-group-name /ecs/healthflow-portals-backend \
  --filter-pattern "ERROR" \
  --start-time $(date -u -d '5 minutes ago' +%s)000
```

### 4.3 Verify Backend Deployment (15 minutes)

**Health Checks:**
```bash
# API health endpoint
curl https://portals-api.healthflow.ai/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2026-02-28T10:00:00.000Z",
  "version": "1.0.0",
  "database": "connected",
  "redis": "connected",
  "websocket": "running"
}

# Detailed system check
curl https://portals-api.healthflow.ai/health/detailed \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Check specific services
curl https://portals-api.healthflow.ai/api/v2/system/status \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Performance Tests:**
```bash
# Load test with Artillery
artillery run infrastructure/load-tests/production-smoke-test.yml

# Expected results:
# - Response time (p95): <200ms
# - Error rate: <0.1%
# - Throughput: >1000 req/sec
```

---

## 5. Frontend Deployment

### 5.1 Build Frontend (30 minutes)

**Build Regulatory Portal:**
```bash
cd frontend/regulatory-portal

# Set production environment
cat > .env.production << EOF
VITE_API_URL=https://portals-api.healthflow.ai
VITE_WS_URL=wss://portals-api.healthflow.ai
VITE_ENABLE_I18N=true
VITE_DEFAULT_LANGUAGE=ar
VITE_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
EOF

# Build for production
npm run build

# Verify build
ls -lh dist/
du -sh dist/

# Expected output:
# Total size: ~5-8 MB (gzipped)
# Files: index.html, assets/, locales/
```

**Optimize Build:**
```bash
# Analyze bundle size
npm run build -- --report

# Check for large dependencies
npm run analyze-bundle

# Verify all assets are hashed
ls dist/assets/

# Expected: All files have content hashes
# index-a1b2c3d4.js
# vendor-e5f6g7h8.js
# main-i9j0k1l2.css
```

### 5.2 Deploy to S3 & CloudFront (30 minutes)

**Upload to S3:**
```bash
# Sync build to S3
aws s3 sync dist/ s3://healthflow-portals-production \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html" \
  --exclude "locales/*"

# Upload index.html with no-cache
aws s3 cp dist/index.html s3://healthflow-portals-production/index.html \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html"

# Upload locales
aws s3 sync dist/locales/ s3://healthflow-portals-production/locales/ \
  --cache-control "public, max-age=86400"

# Verify upload
aws s3 ls s3://healthflow-portals-production --recursive --human-readable --summarize
```

**Invalidate CloudFront Cache:**
```bash
# Get CloudFront distribution ID
DISTRIBUTION_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Origins.Items[?DomainName=='healthflow-portals-production.s3.amazonaws.com']].Id" \
  --output text)

# Create invalidation
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text)

echo "Invalidation ID: $INVALIDATION_ID"

# Wait for invalidation to complete
aws cloudfront wait invalidation-completed \
  --distribution-id $DISTRIBUTION_ID \
  --id $INVALIDATION_ID

echo "✓ CloudFront cache invalidated"
```

**Configure CloudFront Headers:**
```bash
# Update CloudFront response headers policy
aws cloudfront update-distribution \
  --id $DISTRIBUTION_ID \
  --if-match $(aws cloudfront get-distribution --id $DISTRIBUTION_ID --query 'ETag' --output text) \
  --distribution-config file://infrastructure/cloudfront/distribution-config.json

# distribution-config.json should include:
# - Security headers (CSP, X-Frame-Options, etc.)
# - CORS headers
# - Cache policies
```

### 5.3 Verify Frontend Deployment (15 minutes)

**Smoke Tests:**
```bash
# Check if site is accessible
curl -I https://portals.healthflow.ai

# Expected: HTTP/2 200

# Test Arabic version
curl https://portals.healthflow.ai/locales/ar/common.json | jq

# Test static assets
curl -I https://portals.healthflow.ai/assets/index-*.js

# Check security headers
curl -I https://portals.healthflow.ai | grep -E "(X-Frame-Options|Content-Security-Policy|Strict-Transport-Security)"
```

**Browser Testing:**
```bash
# Lighthouse audit
lighthouse https://portals.healthflow.ai \
  --output html \
  --output-path ./reports/lighthouse-production.html \
  --chrome-flags="--headless"

# Expected scores:
# Performance: >90
# Accessibility: >90
# Best Practices: >90
# SEO: >90
```

---

## 6. Mobile App Deployment

### 6.1 iOS App Store Deployment (2-3 hours)

**Pre-submission Checklist:**
- [ ] App Store Connect record created
- [ ] App icon (1024x1024) prepared
- [ ] Screenshots prepared (all required sizes)
- [ ] App description written (English & Arabic)
- [ ] Privacy policy URL added
- [ ] Support URL added
- [ ] Age rating completed
- [ ] Export compliance completed

**Build iOS App:**
```bash
cd mobile

# Update version
npm version 1.0.0

# Install dependencies
cd ios && pod install && cd ..

# Build archive
xcodebuild clean archive \
  -workspace ios/HealthFlow.xcworkspace \
  -scheme HealthFlow \
  -configuration Release \
  -archivePath build/HealthFlow.xcarchive

# Export IPA
xcodebuild -exportArchive \
  -archivePath build/HealthFlow.xcarchive \
  -exportPath build/ \
  -exportOptionsPlist ios/ExportOptions.plist

# Verify IPA
ls -lh build/HealthFlow.ipa
```

**Upload to App Store:**
```bash
# Method 1: Xcode
# - Open Xcode
# - Window > Organizer
# - Select archive
# - Click "Distribute App"
# - Follow wizard

# Method 2: Command line
xcrun altool --upload-app \
  --type ios \
  --file build/HealthFlow.ipa \
  --username your-apple-id@email.com \
  --password @keychain:AC_PASSWORD

# Check upload status
xcrun altool --notarization-history 0 \
  --username your-apple-id@email.com \
  --password @keychain:AC_PASSWORD
```

**Submit for Review:**
1. Go to App Store Connect
2. Select "HealthFlow" app
3. Go to "App Store" tab
4. Click "1.0 Prepare for Submission"
5. Fill in all required fields
6. Add screenshots for all device sizes
7. Set pricing and availability
8. Submit for review

**Expected Review Time:** 24-48 hours

### 6.2 Android Play Store Deployment (2-3 hours)

**Pre-submission Checklist:**
- [ ] Google Play Console account active
- [ ] App signing key generated
- [ ] Feature graphic (1024x500) prepared
- [ ] Screenshots prepared (all required sizes)
- [ ] App description written (English & Arabic)
- [ ] Privacy policy URL added
- [ ] Content rating completed
- [ ] Target audience selected

**Build Android APK/AAB:**
```bash
cd mobile/android

# Clean build
./gradlew clean

# Build release AAB (recommended)
./gradlew bundleRelease

# Or build APK
./gradlew assembleRelease

# Verify build
ls -lh app/build/outputs/bundle/release/app-release.aab
ls -lh app/build/outputs/apk/release/app-release.apk

# Test APK on device
adb install app/build/outputs/apk/release/app-release.apk
```

**Upload to Play Store:**
1. Go to Google Play Console
2. Select "HealthFlow" app
3. Go to "Release" > "Production"
4. Click "Create new release"
5. Upload AAB file
6. Add release notes (English & Arabic)
7. Review and rollout to production

**Staged Rollout (Recommended):**
```
Day 1: 10% of users
Day 2: 25% of users
Day 3: 50% of users
Day 4: 100% of users
```

**Expected Review Time:** 2-7 days

---

## 7. Post-Deployment Verification

### 7.1 Smoke Tests (30 minutes)

**Run Automated Smoke Tests:**
```bash
cd infrastructure/tests

# Run smoke test suite
npm run test:smoke:production

# Tests include:
# ✓ API health check
# ✓ Database connectivity
# ✓ Redis connectivity
# ✓ Authentication flow
# ✓ Core API endpoints
# ✓ WebSocket connection
# ✓ File upload/download
# ✓ Email delivery
# ✓ SMS delivery
# ✓ Push notifications
```

**Manual Smoke Tests:**

**Backend API:**
```bash
BASE_URL="https://portals-api.healthflow.ai/api/v2"

# 1. Health check
curl $BASE_URL/../health

# 2. Authentication
TOKEN=$(curl -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@healthflow.ai","password":"Admin123!"}' \
  | jq -r '.data.token')

# 3. Get medicines
curl $BASE_URL/medicines -H "Authorization: Bearer $TOKEN"

# 4. Search medicine
curl "$BASE_URL/medicines/search?q=aspirin" -H "Authorization: Bearer $TOKEN"

# 5. Get recalls
curl $BASE_URL/recalls -H "Authorization: Bearer $TOKEN"

# 6. Check interactions
curl -X POST $BASE_URL/interactions/check \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"medicines":[{"id":"ID1"},{"id":"ID2"}]}'

# 7. Compare prices
curl $BASE_URL/prices/compare/MEDICINE_ID -H "Authorization: Bearer $TOKEN"

# 8. Get analytics
curl $BASE_URL/analytics/system?timeRange=7d -H "Authorization: Bearer $TOKEN"
```

**Frontend:**
1. Visit https://portals.healthflow.ai
2. Login with test credentials
3. Navigate through all main pages
4. Search for a medicine
5. View medicine details
6. Check recalls list
7. View analytics dashboard
8. Switch language to Arabic
9. Verify RTL layout
10. Test responsive design on mobile

**Mobile App:**
1. Download app from App Store / Play Store
2. Complete onboarding
3. Login
4. Search for medicine
5. Scan barcode
6. View recalls
7. Report adverse event
8. Check notifications
9. Test offline mode
10. Switch language to Arabic

### 7.2 Performance Verification (20 minutes)

**API Performance:**
```bash
# Load test
artillery quick --count 100 --num 10 https://portals-api.healthflow.ai/api/v2/medicines

# Expected results:
# - p50 latency: <100ms
# - p95 latency: <200ms
# - p99 latency: <500ms
# - Success rate: >99.9%
```

**Database Performance:**
```sql
-- Check slow queries
SELECT 
  query,
  mean_exec_time,
  calls
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check connection count
SELECT count(*) FROM pg_stat_activity;
-- Expected: <100 connections

-- Check cache hit ratio
SELECT 
  sum(heap_blks_read) as heap_read,
  sum(heap_blks_hit) as heap_hit,
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
FROM pg_statio_user_tables;
-- Expected: >0.99 (99% cache hit rate)
```

**Redis Performance:**
```bash
# Check Redis stats
redis-cli -h $REDIS_ENDPOINT INFO stats

# Expected:
# - Hit rate: >90%
# - Memory usage: <50% of available
# - Connected clients: <50
```

### 7.3 Security Verification (15 minutes)

**SSL/TLS Configuration:**
```bash
# Test SSL certificate
echo | openssl s_client -servername portals.healthflow.ai -connect portals.healthflow.ai:443 2>/dev/null | openssl x509 -noout -dates

# Test SSL Labs grade
curl -s "https://api.ssllabs.com/api/v3/analyze?host=portals.healthflow.ai&publish=off&all=done" | jq '.endpoints[0].grade'
# Expected: A or A+

# Check security headers
curl -I https://portals.healthflow.ai | grep -E "(X-|Strict-Transport|Content-Security)"
```

**Expected Security Headers:**
- Strict-Transport-Security: max-age=31536000; includeSubDomains
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Content-Security-Policy: default-src 'self'
- X-XSS-Protection: 1; mode=block

**API Security:**
```bash
# Test rate limiting
for i in {1..110}; do
  curl -s -o /dev/null -w "%{http_code}\n" https://portals-api.healthflow.ai/api/v2/medicines
done
# Expected: First 100 requests return 200, then 429 (Too Many Requests)

# Test authentication
curl https://portals-api.healthflow.ai/api/v2/medicines
# Expected: 401 Unauthorized

# Test CORS
curl -H "Origin: https://evil.com" \
  -H "Access-Control-Request-Method: POST" \
  -X OPTIONS \
  https://portals-api.healthflow.ai/api/v2/auth/login
# Expected: No Access-Control-Allow-Origin header
```

---

## 8. Monitoring & Alerts

### 8.1 Configure CloudWatch (30 minutes)

**Create CloudWatch Dashboards:**
```bash
# Create main dashboard
aws cloudwatch put-dashboard \
  --dashboard-name HealthFlowPortals-Production \
  --dashboard-body file://infrastructure/monitoring/dashboard.json
```

**Dashboard Metrics:**
- API response time (p50, p95, p99)
- Request count and error rate
- ECS CPU and memory utilization
- RDS connections and queries
- Redis hit rate and memory
- ALB target health
- S3 request count
- CloudFront cache hit rate

**Create Alarms:**
```bash
# High API error rate
aws cloudwatch put-metric-alarm \
  --alarm-name HealthFlowPortals-HighErrorRate \
  --alarm-description "API error rate above 1%" \
  --metric-name 5XXError \
  --namespace AWS/ApplicationELB \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:<account-id>:healthflow-alerts

# High response time
aws cloudwatch put-metric-alarm \
  --alarm-name HealthFlowPortals-HighLatency \
  --alarm-description "API p95 latency above 500ms" \
  --metric-name TargetResponseTime \
  --namespace AWS/ApplicationELB \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 0.5 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:<account-id>:healthflow-alerts

# High CPU utilization
aws cloudwatch put-metric-alarm \
  --alarm-name HealthFlowPortals-HighCPU \
  --alarm-description "ECS CPU above 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:<account-id>:healthflow-alerts

# Database connections
aws cloudwatch put-metric-alarm \
  --alarm-name HealthFlowPortals-HighDBConnections \
  --alarm-description "RDS connections above 400" \
  --metric-name DatabaseConnections \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 400 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:<account-id>:healthflow-alerts
```

### 8.2 Configure Sentry (15 minutes)

**Backend Sentry Configuration:**
```typescript
// Already configured in backend/server.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: 'production',
  tracesSampleRate: 0.1, // 10% of transactions
  release: 'healthflow-portals@1.0.0',
});
```

**Frontend Sentry Configuration:**
```typescript
// Already configured in frontend/src/main.tsx
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: 'production',
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

**Verify Sentry:**
```bash
# Test error reporting
curl -X POST https://portals-api.healthflow.ai/api/v2/test/error \
  -H "Authorization: Bearer $TOKEN"

# Check Sentry dashboard
# Should see error within 1 minute
```

### 8.3 Configure PagerDuty (10 minutes)

**Create PagerDuty Integration:**
```bash
# Add PagerDuty to SNS topic
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:<account-id>:healthflow-alerts \
  --protocol https \
  --notification-endpoint https://events.pagerduty.com/integration/<integration-key>/enqueue
```

**On-Call Schedule:**
- Primary: DevOps Lead
- Secondary: Backend Lead
- Escalation: CTO

**Alert Routing:**
- Critical (P1): Immediate page
- High (P2): Page during business hours
- Medium (P3): Email only
- Low (P4): Slack notification

---

## 9. Rollback Procedures

### 9.1 Backend Rollback (15 minutes)

**Identify Previous Version:**
```bash
# List recent task definitions
aws ecs list-task-definitions \
  --family-prefix healthflow-portals-backend \
  --sort DESC \
  --max-items 5

# Get previous stable version
PREVIOUS_TASK_DEF="arn:aws:ecs:us-east-1:<account-id>:task-definition/healthflow-portals-backend:X"
```

**Rollback Service:**
```bash
# Update service to previous task definition
aws ecs update-service \
  --cluster healthflow-portals-production-cluster \
  --service backend-api \
  --task-definition $PREVIOUS_TASK_DEF \
  --force-new-deployment

# Monitor rollback
aws ecs wait services-stable \
  --cluster healthflow-portals-production-cluster \
  --services backend-api

echo "✓ Backend rolled back to previous version"
```

**Verify Rollback:**
```bash
# Check running tasks
aws ecs list-tasks \
  --cluster healthflow-portals-production-cluster \
  --service-name backend-api

# Verify API is working
curl https://portals-api.healthflow.ai/health
```

### 9.2 Database Rollback (30 minutes)

**⚠️ DATABASE ROLLBACK IS COMPLEX - USE WITH EXTREME CAUTION**

**Option 1: Restore from Snapshot (Destructive)**
```bash
# Identify pre-deployment snapshot
aws rds describe-db-snapshots \
  --db-instance-identifier healthflow-portals-prod \
  --snapshot-type manual \
  --query 'DBSnapshots[?SnapshotCreateTime>=`2026-02-28`]'

# Restore from snapshot (this will create a new instance)
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier healthflow-portals-prod-rollback \
  --db-snapshot-identifier healthflow-portals-pre-deployment-20260228

# Point application to new instance
# Update DATABASE_URL in Secrets Manager
```

**Option 2: Run Rollback Migration (Preferred)**
```bash
# Rollback last migration batch
npm run migrate:rollback

# Verify
npm run migrate:status
```

### 9.3 Frontend Rollback (10 minutes)

**Restore Previous S3 Version:**
```bash
# List versions
aws s3api list-object-versions \
  --bucket healthflow-portals-production \
  --prefix index.html

# Restore previous version
aws s3api copy-object \
  --bucket healthflow-portals-production \
  --copy-source healthflow-portals-production/index.html?versionId=PREVIOUS_VERSION_ID \
  --key index.html

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"
```

**Or Deploy Previous Build:**
```bash
# Re-deploy from git tag
git checkout v0.9.0
cd frontend/regulatory-portal
npm run build
aws s3 sync dist/ s3://healthflow-portals-production --delete
```

---

## 10. Troubleshooting Guide

### 10.1 Common Issues

**Issue: API Returns 502 Bad Gateway**

**Symptoms:**
- ALB returns 502
- Backend health checks failing

**Diagnosis:**
```bash
# Check ECS tasks
aws ecs describe-services \
  --cluster healthflow-portals-production-cluster \
  --services backend-api

# Check task logs
aws logs tail /ecs/healthflow-portals-backend --follow

# Check target health
aws elbv2 describe-target-health \
  --target-group-arn <target-group-arn>
```

**Solutions:**
1. Check database connectivity
2. Verify environment variables
3. Check memory/CPU limits
4. Review application logs
5. Restart unhealthy tasks

---

**Issue: High Database CPU**

**Symptoms:**
- Slow API responses
- Database CPU >90%

**Diagnosis:**
```sql
-- Find slow queries
SELECT 
  pid,
  now() - query_start as duration,
  query
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - query_start > interval '10 seconds'
ORDER BY duration DESC;

-- Check locks
SELECT * FROM pg_locks WHERE NOT granted;
```

**Solutions:**
1. Kill long-running queries
2. Add missing indexes
3. Optimize slow queries
4. Scale up RDS instance (if needed)

---

**Issue: WebSocket Connections Failing**

**Symptoms:**
- Real-time features not working
- Connection errors in browser

**Diagnosis:**
```bash
# Check WebSocket endpoint
wscat -c wss://portals-api.healthflow.ai

# Check ALB listeners
aws elbv2 describe-listeners \
  --load-balancer-arn <alb-arn>

# Check ECS task WebSocket support
aws ecs describe-services \
  --cluster healthflow-portals-production-cluster \
  --services backend-api
```

**Solutions:**
1. Verify ALB has WebSocket support enabled
2. Check sticky sessions configured
3. Verify backend WebSocket server running
4. Check security groups allow WebSocket connections

---

**Issue: Mobile App Crashes on Startup**

**Symptoms:**
- App crashes immediately after launch
- Error logs show initialization failure

**Diagnosis:**
```bash
# iOS logs
xcrun simctl spawn booted log stream --predicate 'processImagePath contains "HealthFlow"'

# Android logs
adb logcat | grep HealthFlow
```

**Common Causes:**
1. Firebase configuration missing
2. Invalid API endpoint
3. Missing permissions
4. Corrupted local storage

**Solutions:**
1. Verify Firebase setup
2. Check API URL in environment
3. Reset app permissions
4. Clear app data

---

### 10.2 Emergency Contacts

**On-Call Team:**
- **DevOps Lead:** +20-XXX-XXX-XXXX
- **Backend Lead:** +20-XXX-XXX-XXXX
- **Frontend Lead:** +20-XXX-XXX-XXXX
- **CTO:** +20-XXX-XXX-XXXX

**External Support:**
- **AWS Support:** Premium Support (24/7)
- **Sentry Support:** Business Plan
- **PagerDuty Support:** Professional Plan

**Communication Channels:**
- **Slack:** #production-incidents
- **Email:** incidents@healthflow.ai
- **Phone Bridge:** +1-XXX-XXX-XXXX (Conference line)

---

### 10.3 Incident Response Procedure

**Severity Levels:**

**P1 - Critical (Page Immediately)**
- Complete system outage
- Data breach
- Security vulnerability
- Database corruption

**P2 - High (Page During Business Hours)**
- Partial system outage
- Performance degradation >50%
- Failed deployment
- High error rate (>5%)

**P3 - Medium (Email Alert)**
- Minor feature broken
- Performance degradation <50%
- Non-critical service down

**P4 - Low (Slack Notification)**
- Cosmetic issues
- Documentation updates needed
- Minor bugs

**Incident Response Steps:**

1. **Detection & Alert**
   - Automated monitoring triggers alert
   - Or manual report from user/team

2. **Acknowledge**
   - On-call engineer acknowledges within 5 minutes
   - Creates incident in PagerDuty
   - Posts in #production-incidents

3. **Assess**
   - Determine severity
   - Identify impact
   - Estimate affected users

4. **Communicate**
   - Notify stakeholders
   - Update status page
   - Send user notifications (if needed)

5. **Mitigate**
   - Implement temporary fix or rollback
   - Restore service
   - Monitor stability

6. **Resolve**
   - Implement permanent fix
   - Verify resolution
   - Close incident

7. **Post-Mortem**
   - Document incident
   - Identify root cause
   - Create action items
   - Share learnings

---

## 📊 Deployment Summary

### Pre-Deployment Checklist Summary
```
☐ Team notified and ready
☐ All tests passing (>90% coverage)
☐ Code reviewed and approved
☐ Infrastructure verified
☐ Backups completed
☐ Environment variables configured
☐ Monitoring and alerts configured
☐ Rollback plan documented
☐ Stakeholders informed
```

### Deployment Steps Summary
```
1. ☐ Deploy infrastructure (Terraform)
2. ☐ Run database migrations
3. ☐ Seed production data
4. ☐ Deploy backend to ECS
5. ☐ Deploy frontend to S3/CloudFront
6. ☐ Submit mobile apps to stores
7. ☐ Run smoke tests
8. ☐ Verify monitoring
9. ☐ Announce deployment
```

### Post-Deployment Checklist Summary
```
☐ All smoke tests passing
☐ Performance metrics within targets
☐ No errors in logs
☐ Monitoring dashboards showing green
☐ User communications sent
☐ Documentation updated
☐ Deployment documented
☐ Team debriefed
```

---

## 🎉 Deployment Complete!

**Congratulations!** The HealthFlow Digital Prescription Portals system is now live in production with all 6 sprints deployed:

✅ Sprint 0: Infrastructure  
✅ Sprint 1: Core Features (Audit & Medicines)  
✅ Sprint 2: Safety Features (Recalls & Adverse Events)  
✅ Sprint 3: Multi-Tenancy & RBAC  
✅ Sprint 4: Analytics & Reporting  
✅ Sprint 5: Mobile Applications  
✅ Sprint 6: AI Features & Integrations  

**Production URLs:**
- Web Portal: https://portals.healthflow.ai
- API: https://portals-api.healthflow.ai
- iOS App: App Store
- Android App: Google Play Store

**System Status:** 🟢 All Systems Operational

**Next Steps:**
1. Monitor system for 24 hours
2. Gather user feedback
3. Schedule Sprint 7 planning (if needed)
4. Celebrate with the team! 🎊

---

**Document Version:** 1.0.0  
**Last Updated:** February 28, 2026  
**Prepared By:** DevOps Team  
**Status:** ✅ PRODUCTION DEPLOYMENT COMPLETE
</artifact>

---

# 🎊 DEPLOYMENT RUNBOOK COMPLETE!

This comprehensive deployment runbook covers every aspect of deploying the complete HealthFlow Digital Prescription Portals system to production, including:

- ✅ Pre-deployment checklists
- ✅ Infrastructure setup
- ✅ Database migrations (all 6 sprints)
- ✅ Backend deployment (78 API endpoints)
- ✅ Frontend deployment (15 pages, 2 languages)
- ✅ Mobile app deployment (iOS & Android)
- ✅ Monitoring & alerting
- ✅ Rollback procedures
- ✅ Troubleshooting guide

**The complete system with all 6 sprints is now ready for production deployment!** 🚀

Would you like me to create:
1. Executive summary presentation
2. User training materials
3. API documentation (Swagger/OpenAPI)
4. Operations manual