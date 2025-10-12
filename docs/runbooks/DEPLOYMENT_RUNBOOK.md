# Deployment Runbook - HealthFlow Digital Prescription Portals

**Version:** 1.0.0  
**Date:** October 12, 2025  
**Author:** Manus AI

## 1. Purpose

This runbook provides step-by-step procedures for deploying the HealthFlow Digital Prescription Portals system to staging and production environments. It is intended for DevOps engineers and system administrators responsible for managing deployments.

## 2. Prerequisites

Before beginning a deployment, ensure the following prerequisites are met:

### 2.1. Access Requirements

- AWS account access with appropriate IAM permissions
- GitHub repository access with write permissions
- Datadog account access (for monitoring setup)
- Access to the deployment Slack channel for notifications

### 2.2. Tools and Software

The following tools must be installed on the deployment workstation:

| Tool              | Version      | Purpose                           |
| ----------------- | ------------ | --------------------------------- |
| AWS CLI           | 2.x          | AWS resource management           |
| Terraform         | 1.5+         | Infrastructure provisioning       |
| Docker            | 24.x         | Container management              |
| kubectl           | 1.28+        | Kubernetes management (optional)  |
| GitHub CLI        | 2.x          | GitHub operations                 |
| jq                | 1.6+         | JSON processing                   |

### 2.3. Credentials and Secrets

Ensure all required secrets are configured in GitHub Secrets and AWS Secrets Manager:

- AWS access credentials
- Database connection strings
- API keys for external services
- SSL/TLS certificates
- JWT signing secrets

## 3. Pre-Deployment Checklist

Complete this checklist before initiating any deployment:

- [ ] All code changes have been reviewed and approved
- [ ] All automated tests are passing
- [ ] Security scans show no critical vulnerabilities
- [ ] Database migrations have been reviewed and tested
- [ ] Deployment window has been scheduled and communicated
- [ ] Rollback plan is documented and understood
- [ ] Monitoring and alerting are operational
- [ ] On-call engineer is identified and available

## 4. Infrastructure Provisioning (First-Time Setup)

This section applies only to the initial infrastructure setup or when adding new infrastructure components.

### 4.1. Configure AWS Credentials

Configure AWS CLI with the appropriate credentials:

```bash
aws configure
# Enter AWS Access Key ID
# Enter AWS Secret Access Key
# Enter default region: us-east-1
# Enter default output format: json
```

Verify access:

```bash
aws sts get-caller-identity
```

### 4.2. Initialize Terraform

Navigate to the Terraform directory and initialize:

```bash
cd infrastructure/terraform
terraform init
```

### 4.3. Review Terraform Plan

Generate and review the execution plan:

```bash
terraform plan -out=tfplan
```

Carefully review the plan to ensure only expected resources will be created or modified. Pay special attention to any resources that will be destroyed or replaced.

### 4.4. Apply Terraform Configuration

Apply the Terraform configuration to provision infrastructure:

```bash
terraform apply tfplan
```

This process may take 15-30 minutes depending on the resources being created. Monitor the output for any errors.

### 4.5. Verify Infrastructure

After Terraform completes, verify that all resources were created successfully:

```bash
# Verify VPC
aws ec2 describe-vpcs --filters "Name=tag:Project,Values=HealthFlow"

# Verify RDS instance
aws rds describe-db-instances --db-instance-identifier healthflow-db

# Verify ECS cluster
aws ecs describe-clusters --clusters healthflow-cluster

# Verify load balancer
aws elbv2 describe-load-balancers --names healthflow-alb
```

### 4.6. Configure DNS

Update DNS records in Route 53 to point to the load balancer:

```bash
# Get load balancer DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers --names healthflow-alb \
  --query 'LoadBalancers[0].DNSName' --output text)

echo "Load Balancer DNS: $ALB_DNS"
```

Create or update Route 53 records through the AWS Console or CLI to point your domain to the load balancer.

## 5. Database Migration

Database migrations must be executed before deploying new application code that depends on schema changes.

### 5.1. Backup Database

Always create a backup before running migrations:

```bash
# For staging
aws rds create-db-snapshot \
  --db-instance-identifier healthflow-staging-db \
  --db-snapshot-identifier healthflow-staging-$(date +%Y%m%d-%H%M%S)

# For production
aws rds create-db-snapshot \
  --db-instance-identifier healthflow-production-db \
  --db-snapshot-identifier healthflow-production-$(date +%Y%m%d-%H%M%S)
```

### 5.2. Run Migrations

Connect to the database and run migrations:

```bash
# Set database connection string
export DATABASE_URL="postgresql://user:password@host:5432/database"

# Run migrations (example using a migration tool)
npm run migrate:up
```

### 5.3. Verify Migrations

Verify that migrations completed successfully:

```bash
# Check migration status
npm run migrate:status

# Verify database schema
psql $DATABASE_URL -c "\dt"
```

## 6. Staging Deployment

Staging deployments occur automatically when code is merged to the `develop` branch.

### 6.1. Trigger Staging Deployment

Merge approved pull requests to the `develop` branch:

```bash
git checkout develop
git pull origin develop
git merge feature/your-feature-name
git push origin develop
```

### 6.2. Monitor Deployment

Monitor the deployment progress in GitHub Actions:

1. Navigate to the repository on GitHub
2. Click on the "Actions" tab
3. Select the latest "Deploy to Staging" workflow run
4. Monitor each step for successful completion

### 6.3. Verify Staging Deployment

After deployment completes, verify the staging environment:

```bash
# Check service health
curl https://staging-api.healthflow.gov.eg/health

# Check application version
curl https://staging-api.healthflow.gov.eg/version
```

Perform smoke tests on critical functionality:

- [ ] User authentication works
- [ ] API endpoints respond correctly
- [ ] Database connectivity is functional
- [ ] Frontend portals load successfully

### 6.4. Run Integration Tests

Execute automated integration tests against the staging environment:

```bash
npm run test:integration:staging
```

## 7. Production Deployment

Production deployments require manual approval and should be performed during scheduled maintenance windows.

### 7.1. Pre-Production Verification

Before deploying to production, verify:

- [ ] Staging deployment is successful and stable
- [ ] All integration tests pass on staging
- [ ] No critical issues reported in staging
- [ ] Deployment has been approved by stakeholders
- [ ] Maintenance window is active (if applicable)

### 7.2. Create Production Release

Create a release by merging `develop` to `main`:

```bash
git checkout main
git pull origin main
git merge develop
git push origin main
```

### 7.3. Tag Release

Tag the release with a version number:

```bash
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

### 7.4. Approve Deployment

The production deployment workflow requires manual approval:

1. Navigate to the repository on GitHub
2. Click on the "Actions" tab
3. Select the "Deploy to Production" workflow run
4. Click "Review deployments"
5. Select "production" environment
6. Click "Approve and deploy"

### 7.5. Monitor Production Deployment

Closely monitor the production deployment:

```bash
# Watch ECS service deployment
aws ecs describe-services \
  --cluster healthflow-production-cluster \
  --services healthflow-backend-service \
  --query 'services[0].deployments'

# Monitor CloudWatch logs
aws logs tail /aws/ecs/healthflow-production --follow
```

### 7.6. Verify Production Deployment

After deployment completes, verify the production environment:

```bash
# Check service health
curl https://api.healthflow.gov.eg/health

# Check application version
curl https://api.healthflow.gov.eg/version
```

Perform smoke tests on critical functionality:

- [ ] User authentication works
- [ ] Critical API endpoints respond correctly
- [ ] Database connectivity is functional
- [ ] All frontend portals load successfully
- [ ] SSL certificates are valid

### 7.7. Monitor Application Metrics

Monitor application metrics in Datadog for at least 30 minutes after deployment:

- Response times
- Error rates
- CPU and memory usage
- Database connection pool status
- Cache hit rates

## 8. Rollback Procedures

If issues are detected after deployment, follow these rollback procedures.

### 8.1. Identify Rollback Target

Identify the previous stable version:

```bash
# List recent tags
git tag -l --sort=-version:refname | head -5

# View deployment history
aws ecs describe-services \
  --cluster healthflow-production-cluster \
  --services healthflow-backend-service \
  --query 'services[0].deployments'
```

### 8.2. Execute Rollback

For ECS deployments, update the service to use the previous task definition:

```bash
# Get previous task definition ARN
PREVIOUS_TASK_DEF=$(aws ecs describe-services \
  --cluster healthflow-production-cluster \
  --services healthflow-backend-service \
  --query 'services[0].deployments[1].taskDefinition' \
  --output text)

# Update service to use previous task definition
aws ecs update-service \
  --cluster healthflow-production-cluster \
  --service healthflow-backend-service \
  --task-definition $PREVIOUS_TASK_DEF
```

### 8.3. Verify Rollback

Verify that the rollback was successful:

```bash
# Check service status
aws ecs describe-services \
  --cluster healthflow-production-cluster \
  --services healthflow-backend-service

# Verify application version
curl https://api.healthflow.gov.eg/version
```

### 8.4. Database Rollback

If database migrations need to be rolled back:

```bash
# Restore from backup (if necessary)
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier healthflow-production-db-restored \
  --db-snapshot-identifier healthflow-production-YYYYMMDD-HHMMSS

# Or run migration rollback
npm run migrate:down
```

## 9. Post-Deployment Tasks

After a successful deployment, complete these tasks:

### 9.1. Update Documentation

Update relevant documentation:

- [ ] Update CHANGELOG.md with release notes
- [ ] Update version numbers in documentation
- [ ] Document any configuration changes
- [ ] Update runbooks if procedures changed

### 9.2. Notify Stakeholders

Send deployment notification to stakeholders:

```
Subject: Production Deployment Complete - v1.0.0

The HealthFlow Digital Prescription Portals production deployment (v1.0.0) 
has been completed successfully.

Deployment Time: 2025-10-12 10:00 UTC
Duration: 15 minutes
Status: Success

Changes in this release:
- Feature 1
- Feature 2
- Bug fix 1

All systems are operational and monitoring shows normal metrics.
```

### 9.3. Monitor for 24 Hours

Continue monitoring the system for 24 hours after deployment:

- Review error logs hourly
- Check performance metrics
- Monitor user feedback and support tickets
- Be prepared to rollback if issues arise

## 10. Troubleshooting

### 10.1. Deployment Fails

If deployment fails, check the following:

```bash
# Check GitHub Actions logs
gh run view --log

# Check ECS service events
aws ecs describe-services \
  --cluster healthflow-production-cluster \
  --services healthflow-backend-service \
  --query 'services[0].events'

# Check CloudWatch logs
aws logs tail /aws/ecs/healthflow-production --since 30m
```

### 10.2. Health Check Failures

If health checks fail after deployment:

```bash
# Check container logs
aws logs tail /aws/ecs/healthflow-production --follow

# Check service health endpoint
curl -v https://api.healthflow.gov.eg/health

# Check database connectivity
psql $DATABASE_URL -c "SELECT 1"
```

### 10.3. Performance Issues

If performance degrades after deployment:

```bash
# Check ECS service metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=healthflow-backend-service \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average

# Check database performance
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBInstanceIdentifier,Value=healthflow-production-db \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

## 11. Emergency Procedures

### 11.1. Emergency Rollback

In case of critical issues requiring immediate rollback:

```bash
# Execute emergency rollback script
./scripts/emergency-rollback.sh production
```

### 11.2. Service Outage

In case of complete service outage:

1. Notify on-call team immediately
2. Check AWS Service Health Dashboard
3. Review CloudWatch alarms
4. Check ECS service status
5. Verify load balancer health
6. Check database connectivity
7. Initiate incident response procedures

### 11.3. Escalation

If issues cannot be resolved:

1. Notify DevOps Lead
2. Notify Tech Lead
3. Create incident ticket
4. Initiate war room if necessary
5. Document all actions taken

## 12. Contacts

| Role                  | Contact                          |
| --------------------- | -------------------------------- |
| DevOps Lead           | devops-lead@healthflow.gov.eg    |
| Tech Lead             | tech-lead@healthflow.gov.eg      |
| On-Call Engineer      | oncall@healthflow.gov.eg         |
| Slack Channel         | #digital-prescription-portals    |
| Emergency Hotline     | +20-XXX-XXX-XXXX                 |

## 13. References

- [Sprint 0 Completion Checklist](../deployment/SPRINT0_COMPLETION_CHECKLIST.md)
- [Branch Protection Setup](../deployment/BRANCH_PROTECTION_SETUP.md)
- [System Architecture](../architecture/SYSTEM_ARCHITECTURE.md)
- [API Documentation](../api/API_OVERVIEW.md)

---

**Document Version History**

| Version | Date         | Author    | Changes                          |
| ------- | ------------ | --------- | -------------------------------- |
| 1.0.0   | Oct 12, 2025 | Manus AI  | Initial deployment runbook       |

