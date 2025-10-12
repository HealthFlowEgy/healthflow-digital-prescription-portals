# Documentation Index

**Project:** HealthFlow Digital Prescription Portals  
**Last Updated:** October 12, 2025

## Quick Links

| Document | Description | Location |
| -------- | ----------- | -------- |
| **README** | Project overview and getting started | [README.md](README.md) |
| **Quick Start** | Developer quick start guide | [QUICK_START.md](QUICK_START.md) |
| **Team Onboarding** | Complete onboarding guide for new team members | [docs/TEAM_ONBOARDING.md](docs/TEAM_ONBOARDING.md) |

## Architecture Documentation

| Document | Description | Location |
| -------- | ----------- | -------- |
| **System Architecture** | Comprehensive system architecture overview | [docs/architecture/SYSTEM_ARCHITECTURE.md](docs/architecture/SYSTEM_ARCHITECTURE.md) |

## API Documentation

| Document | Description | Location |
| -------- | ----------- | -------- |
| **API Overview** | API design principles, authentication, and endpoints | [docs/api/API_OVERVIEW.md](docs/api/API_OVERVIEW.md) |

## Deployment Documentation

| Document | Description | Location |
| -------- | ----------- | -------- |
| **Branch Protection Setup** | Guide for setting up branch protection rules | [docs/deployment/BRANCH_PROTECTION_SETUP.md](docs/deployment/BRANCH_PROTECTION_SETUP.md) |
| **Sprint 0 Completion Checklist** | Complete checklist of Sprint 0 deliverables | [docs/deployment/SPRINT0_COMPLETION_CHECKLIST.md](docs/deployment/SPRINT0_COMPLETION_CHECKLIST.md) |

## Operational Runbooks

| Document | Description | Location |
| -------- | ----------- | -------- |
| **Deployment Runbook** | Step-by-step deployment procedures | [docs/runbooks/DEPLOYMENT_RUNBOOK.md](docs/runbooks/DEPLOYMENT_RUNBOOK.md) |
| **Incident Response** | Incident response procedures and escalation | [docs/runbooks/INCIDENT_RESPONSE.md](docs/runbooks/INCIDENT_RESPONSE.md) |

## Infrastructure Documentation

| Component | Description | Location |
| --------- | ----------- | -------- |
| **Docker** | Docker configurations for all services | [infrastructure/docker/](infrastructure/docker/) |
| **Kubernetes** | Kubernetes manifests for deployment | [infrastructure/kubernetes/](infrastructure/kubernetes/) |
| **Terraform** | Infrastructure as Code for AWS | [infrastructure/terraform/](infrastructure/terraform/) |

## Configuration Files

| File | Purpose | Location |
| ---- | ------- | -------- |
| **package.json** | Monorepo workspace configuration | [package.json](package.json) |
| **turbo.json** | Build pipeline orchestration | [turbo.json](turbo.json) |
| **tsconfig.json** | TypeScript configuration | [tsconfig.json](tsconfig.json) |
| **.env.example** | Environment variables template | [.env.example](.env.example) |
| **docker-compose.yml** | Local development environment | [docker-compose.yml](docker-compose.yml) |

## CI/CD Workflows

| Workflow | Purpose | Location |
| -------- | ------- | -------- |
| **CI** | Continuous Integration | [.github/workflows/ci.yml](.github/workflows/ci.yml) |
| **Deploy Staging** | Staging deployment | [.github/workflows/deploy-staging.yml](.github/workflows/deploy-staging.yml) |
| **Deploy Production** | Production deployment | [.github/workflows/deploy-production.yml](.github/workflows/deploy-production.yml) |

## For Developers

Start here if you're a new developer:

1. Read [README.md](README.md) for project overview
2. Follow [QUICK_START.md](QUICK_START.md) to set up your environment
3. Review [docs/TEAM_ONBOARDING.md](docs/TEAM_ONBOARDING.md) for complete onboarding
4. Understand [docs/architecture/SYSTEM_ARCHITECTURE.md](docs/architecture/SYSTEM_ARCHITECTURE.md)
5. Refer to [docs/api/API_OVERVIEW.md](docs/api/API_OVERVIEW.md) for API development

## For DevOps

Start here if you're responsible for infrastructure and deployments:

1. Review [docs/deployment/SPRINT0_COMPLETION_CHECKLIST.md](docs/deployment/SPRINT0_COMPLETION_CHECKLIST.md)
2. Follow [docs/runbooks/DEPLOYMENT_RUNBOOK.md](docs/runbooks/DEPLOYMENT_RUNBOOK.md) for deployments
3. Use [docs/runbooks/INCIDENT_RESPONSE.md](docs/runbooks/INCIDENT_RESPONSE.md) for incidents
4. Configure [docs/deployment/BRANCH_PROTECTION_SETUP.md](docs/deployment/BRANCH_PROTECTION_SETUP.md)
5. Review Terraform modules in [infrastructure/terraform/](infrastructure/terraform/)

## For Product Owners

Start here if you're managing the product:

1. Read [README.md](README.md) for project overview
2. Review [docs/architecture/SYSTEM_ARCHITECTURE.md](docs/architecture/SYSTEM_ARCHITECTURE.md)
3. Check [docs/deployment/SPRINT0_COMPLETION_CHECKLIST.md](docs/deployment/SPRINT0_COMPLETION_CHECKLIST.md)
4. Understand [docs/api/API_OVERVIEW.md](docs/api/API_OVERVIEW.md)

## Support

For questions or issues:
- **Slack:** #digital-prescription-portals
- **GitHub Issues:** Create an issue in the repository
- **Team Lead:** Contact the Tech Lead or DevOps Lead

---

**Last Updated:** October 12, 2025
