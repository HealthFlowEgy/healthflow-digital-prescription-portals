# Incident Response Runbook - HealthFlow Digital Prescription Portals

**Version:** 1.0.0  
**Date:** October 12, 2025  
**Author:** Manus AI

## 1. Purpose

This runbook provides procedures for responding to incidents affecting the HealthFlow Digital Prescription Portals system. It defines incident severity levels, response procedures, escalation paths, and post-incident activities to ensure rapid resolution and minimize impact on users.

## 2. Incident Severity Levels

Incidents are classified into four severity levels based on their impact on system availability and functionality.

### 2.1. Severity Definitions

| Severity | Impact                                                    | Response Time | Example                                    |
| -------- | --------------------------------------------------------- | ------------- | ------------------------------------------ |
| P1       | Complete service outage or critical security breach       | Immediate     | All portals down, database breach          |
| P2       | Significant degradation affecting multiple users          | 15 minutes    | API errors affecting 25%+ of requests      |
| P3       | Limited functionality impaired or affecting specific users| 1 hour        | Single portal feature not working          |
| P4       | Minor issues with workarounds available                   | 4 hours       | Cosmetic issues, non-critical bugs         |

### 2.2. Severity Assessment

When an incident is detected, assess the severity by answering these questions:

- Is the service completely unavailable?
- How many users are affected?
- Is there a security or data privacy concern?
- Is there a workaround available?
- What is the business impact?

## 3. Incident Detection

Incidents may be detected through multiple channels:

### 3.1. Monitoring Alerts

Automated monitoring systems generate alerts for anomalies:

- **Datadog Alerts:** Performance degradation, error rate spikes, service unavailability
- **CloudWatch Alarms:** Infrastructure issues, resource exhaustion
- **Synthetic Monitoring:** Endpoint availability checks

### 3.2. User Reports

Users may report issues through:

- Support tickets
- Slack channels
- Email
- Phone hotline

### 3.3. Manual Detection

Engineers may discover issues during:

- Routine monitoring
- Deployment activities
- Code reviews
- Testing

## 4. Initial Response (First 5 Minutes)

When an incident is detected, follow these immediate steps:

### 4.1. Acknowledge the Incident

Acknowledge the incident to prevent duplicate responses:

```bash
# Acknowledge in Datadog
# Click "Acknowledge" on the alert

# Post in Slack
# Message: "Incident acknowledged - investigating"
```

### 4.2. Assess Severity

Quickly assess the severity level using the criteria in Section 2.1.

### 4.3. Create Incident Ticket

Create an incident ticket with initial information:

```bash
# Create GitHub issue
gh issue create \
  --title "INCIDENT: Brief description" \
  --label "incident,P1" \
  --body "Initial details of the incident"
```

### 4.4. Notify Team

Notify the appropriate team members based on severity:

**P1 Incidents:**
- Post in #incidents Slack channel
- Page on-call engineer
- Notify DevOps Lead and Tech Lead immediately

**P2 Incidents:**
- Post in #incidents Slack channel
- Notify on-call engineer
- Notify DevOps Lead

**P3/P4 Incidents:**
- Post in #digital-prescription-portals Slack channel
- Assign to appropriate team member

## 5. Investigation and Diagnosis

### 5.1. Gather Information

Collect relevant information about the incident:

```bash
# Check service status
curl https://api.healthflow.gov.eg/health

# Check recent deployments
gh run list --limit 5

# Check ECS service events
aws ecs describe-services \
  --cluster healthflow-production-cluster \
  --services healthflow-backend-service \
  --query 'services[0].events[0:10]'

# Check CloudWatch logs
aws logs tail /aws/ecs/healthflow-production --since 1h
```

### 5.2. Check Common Issues

Review common issues and their indicators:

**Database Connection Issues:**
```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT 1"

# Check connection pool status
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBInstanceIdentifier,Value=healthflow-production-db \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum
```

**High Error Rates:**
```bash
# Check application logs for errors
aws logs filter-pattern /aws/ecs/healthflow-production \
  --filter-pattern "ERROR" \
  --start-time $(date -u -d '1 hour ago' +%s)000

# Check error metrics in Datadog
# Navigate to Dashboards > Error Rates
```

**Performance Degradation:**
```bash
# Check CPU and memory usage
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=healthflow-backend-service \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum

# Check response times in Datadog
# Navigate to Dashboards > Performance
```

**Deployment Issues:**
```bash
# Check recent deployment status
gh run view

# Compare current version with expected version
curl https://api.healthflow.gov.eg/version
```

### 5.3. Document Findings

Document all findings in the incident ticket as you investigate:

```bash
# Update incident ticket
gh issue comment <issue-number> \
  --body "Finding: Database connections are at maximum capacity"
```

## 6. Mitigation and Resolution

### 6.1. Implement Immediate Mitigation

Based on the diagnosis, implement immediate mitigation:

**For Service Outages:**
```bash
# Restart failed services
aws ecs update-service \
  --cluster healthflow-production-cluster \
  --service healthflow-backend-service \
  --force-new-deployment

# Scale up services if needed
aws ecs update-service \
  --cluster healthflow-production-cluster \
  --service healthflow-backend-service \
  --desired-count 6
```

**For Database Issues:**
```bash
# Increase database connections (if at limit)
# Modify RDS parameter group

# Restart database connections
# Restart application services

# Scale database instance (if resource constrained)
aws rds modify-db-instance \
  --db-instance-identifier healthflow-production-db \
  --db-instance-class db.r5.2xlarge \
  --apply-immediately
```

**For Performance Issues:**
```bash
# Clear cache if stale data is causing issues
redis-cli -h <redis-endpoint> FLUSHDB

# Scale up application services
aws ecs update-service \
  --cluster healthflow-production-cluster \
  --service healthflow-backend-service \
  --desired-count 8
```

**For Deployment Issues:**
```bash
# Rollback to previous version
./scripts/emergency-rollback.sh production
```

### 6.2. Verify Mitigation

After implementing mitigation, verify that the issue is resolved:

```bash
# Check service health
curl https://api.healthflow.gov.eg/health

# Check error rates
# Review Datadog dashboards

# Check user reports
# Review support tickets and Slack messages

# Run smoke tests
npm run test:smoke:production
```

### 6.3. Monitor Stability

Continue monitoring for at least 30 minutes after mitigation to ensure stability:

- Watch error rates in Datadog
- Monitor CloudWatch logs
- Check performance metrics
- Verify user reports decrease

## 7. Communication

### 7.1. Internal Communication

Keep the team informed throughout the incident:

**Regular Updates:**
- Post updates in #incidents Slack channel every 15 minutes for P1
- Post updates every 30 minutes for P2
- Post updates every hour for P3/P4

**Update Template:**
```
Incident Update - [Timestamp]
Status: [Investigating/Mitigating/Resolved]
Impact: [Description of current impact]
Actions Taken: [What has been done]
Next Steps: [What will be done next]
ETA: [Expected resolution time]
```

### 7.2. External Communication

For incidents affecting users, communicate through appropriate channels:

**Status Page:**
Update the status page with incident information:
- Incident identified
- Investigating
- Identified root cause
- Implementing fix
- Monitoring
- Resolved

**User Notifications:**
For P1 and P2 incidents, send notifications to affected users:
- Email notifications
- In-app notifications
- Social media updates (if applicable)

### 7.3. Stakeholder Communication

Notify stakeholders for high-severity incidents:

**P1 Incidents:**
- Notify Product Owner immediately
- Notify executive team within 30 minutes
- Provide hourly updates

**P2 Incidents:**
- Notify Product Owner within 30 minutes
- Provide updates every 2 hours

## 8. Escalation

### 8.1. Escalation Triggers

Escalate the incident if:

- Initial mitigation attempts fail
- Incident duration exceeds expected resolution time
- Severity increases
- Additional expertise is required
- Security or compliance implications are identified

### 8.2. Escalation Path

| Level | Role                    | Contact Method                    |
| ----- | ----------------------- | --------------------------------- |
| 1     | On-Call Engineer        | PagerDuty, Slack                  |
| 2     | DevOps Lead             | Phone, Slack                      |
| 3     | Tech Lead               | Phone, Slack                      |
| 4     | Product Owner           | Phone, Email                      |
| 5     | Executive Team          | Phone                             |

### 8.3. War Room

For P1 incidents lasting more than 30 minutes, establish a war room:

1. Create dedicated Slack channel: #incident-YYYYMMDD
2. Set up video conference call
3. Assign roles:
   - Incident Commander: Coordinates response
   - Technical Lead: Leads technical investigation
   - Communications Lead: Manages internal and external communications
   - Scribe: Documents timeline and actions

## 9. Resolution and Closure

### 9.1. Confirm Resolution

Before closing an incident, confirm:

- [ ] Root cause identified
- [ ] Issue is fully resolved
- [ ] Services are stable
- [ ] Monitoring shows normal metrics
- [ ] No user reports of ongoing issues
- [ ] All stakeholders notified of resolution

### 9.2. Close Incident

Close the incident ticket with summary:

```bash
gh issue close <issue-number> \
  --comment "Incident resolved. Root cause: [description]. Resolution: [description]. Duration: [time]."
```

### 9.3. Post-Incident Communication

Send resolution notification to stakeholders:

```
Subject: Incident Resolved - [Brief Description]

The incident affecting [component] has been resolved.

Incident Start: [timestamp]
Incident End: [timestamp]
Duration: [duration]
Root Cause: [brief description]
Resolution: [brief description]

A detailed post-incident review will be conducted and shared within 48 hours.
```

## 10. Post-Incident Review

### 10.1. Schedule Review Meeting

Schedule a post-incident review meeting within 48 hours of incident resolution. Invite:

- Incident responders
- DevOps team
- Development team
- Product Owner (for P1/P2 incidents)

### 10.2. Conduct Review

During the review meeting, discuss:

1. **Timeline:** Detailed timeline of events
2. **Root Cause:** What caused the incident?
3. **Detection:** How was the incident detected? Could it have been detected earlier?
4. **Response:** What went well? What could be improved?
5. **Impact:** What was the business impact?
6. **Prevention:** How can we prevent similar incidents?

### 10.3. Document Lessons Learned

Create a post-incident review document:

```markdown
# Post-Incident Review - [Date]

## Incident Summary
- **Date:** [date]
- **Duration:** [duration]
- **Severity:** [P1/P2/P3/P4]
- **Impact:** [description]

## Timeline
- [timestamp]: Incident detected
- [timestamp]: Team notified
- [timestamp]: Investigation began
- [timestamp]: Root cause identified
- [timestamp]: Mitigation implemented
- [timestamp]: Incident resolved

## Root Cause
[Detailed description of root cause]

## What Went Well
- [Item 1]
- [Item 2]

## What Could Be Improved
- [Item 1]
- [Item 2]

## Action Items
- [ ] [Action 1] - Owner: [name] - Due: [date]
- [ ] [Action 2] - Owner: [name] - Due: [date]

## Prevention Measures
[Description of measures to prevent recurrence]
```

### 10.4. Implement Improvements

Track and implement action items from the post-incident review:

```bash
# Create GitHub issues for action items
gh issue create \
  --title "Action Item: [description]" \
  --label "incident-followup" \
  --assignee @username \
  --body "From incident review [date]: [details]"
```

## 11. Incident Metrics

Track the following metrics for continuous improvement:

| Metric                          | Target                  |
| ------------------------------- | ----------------------- |
| Mean Time to Detect (MTTD)      | < 5 minutes             |
| Mean Time to Acknowledge (MTTA) | < 2 minutes             |
| Mean Time to Resolve (MTTR)     | P1: < 1 hour, P2: < 4 hours |
| Incident Recurrence Rate        | < 10%                   |

## 12. Common Incident Scenarios

### 12.1. Database Connection Pool Exhaustion

**Symptoms:**
- "Too many connections" errors
- Slow API responses
- Timeouts

**Resolution:**
```bash
# Restart application services to reset connections
aws ecs update-service \
  --cluster healthflow-production-cluster \
  --service healthflow-backend-service \
  --force-new-deployment

# Increase max connections in RDS parameter group
# Investigate and fix connection leaks in application code
```

### 12.2. Memory Leak

**Symptoms:**
- Increasing memory usage over time
- Out of memory errors
- Service restarts

**Resolution:**
```bash
# Restart affected services
aws ecs update-service \
  --cluster healthflow-production-cluster \
  --service healthflow-backend-service \
  --force-new-deployment

# Increase memory limits temporarily
# Investigate and fix memory leak in application code
```

### 12.3. DDoS Attack

**Symptoms:**
- Sudden spike in traffic
- Slow responses
- Service unavailability

**Resolution:**
```bash
# Enable AWS WAF rate limiting
# Block suspicious IP addresses
# Scale up infrastructure
# Contact AWS Support for DDoS mitigation
```

### 12.4. SSL Certificate Expiration

**Symptoms:**
- SSL/TLS errors
- Browser warnings
- API connection failures

**Resolution:**
```bash
# Renew SSL certificate in AWS Certificate Manager
# Update load balancer listener
# Verify certificate is valid
openssl s_client -connect api.healthflow.gov.eg:443 -servername api.healthflow.gov.eg
```

## 13. Contacts

| Role                  | Contact                          | Availability        |
| --------------------- | -------------------------------- | ------------------- |
| On-Call Engineer      | oncall@healthflow.gov.eg         | 24/7                |
| DevOps Lead           | devops-lead@healthflow.gov.eg    | Business hours      |
| Tech Lead             | tech-lead@healthflow.gov.eg      | Business hours      |
| Product Owner         | product@healthflow.gov.eg        | Business hours      |
| AWS Support           | AWS Console                      | 24/7 (Enterprise)   |
| Datadog Support       | support@datadoghq.com            | 24/7                |

## 14. References

- [Deployment Runbook](DEPLOYMENT_RUNBOOK.md)
- [System Architecture](../architecture/SYSTEM_ARCHITECTURE.md)
- [Monitoring Dashboard](https://app.datadoghq.com/dashboard/healthflow)
- [AWS Console](https://console.aws.amazon.com)

---

**Document Version History**

| Version | Date         | Author    | Changes                               |
| ------- | ------------ | --------- | ------------------------------------- |
| 1.0.0   | Oct 12, 2025 | Manus AI  | Initial incident response runbook     |

