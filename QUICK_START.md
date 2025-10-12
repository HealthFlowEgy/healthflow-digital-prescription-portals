# HealthFlow Digital Prescription Portals - Quick Start Guide

**Repository**: https://github.com/HealthFlowEgy/healthflow-digital-prescription-portals  
**Status**: ✅ Sprint 0 Complete - Ready for Development

---

## 🚀 For Developers: Get Started in 5 Minutes

### 1. Clone the Repository

```bash
git clone https://github.com/HealthFlowEgy/healthflow-digital-prescription-portals.git
cd healthflow-digital-prescription-portals
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment

```bash
cp .env.example .env
# Edit .env with your local development values
```

### 4. Start Development Environment

```bash
# Start local services (PostgreSQL, Redis)
docker-compose up -d

# Start development servers
npm run dev
```

### 5. Create Your First Feature

```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name

# Make your changes...

npm run lint
npm run type-check
npm test

git add .
git commit -m "feat: your feature description"
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub targeting the `develop` branch.

---

## 🔐 For DevOps: Complete Final Setup (10 Minutes)

### Step 1: Set Up Branch Protection Rules

Since the GitHub API for branch protection can be complex, use the web interface:

#### Main Branch Protection

1. Go to: https://github.com/HealthFlowEgy/healthflow-digital-prescription-portals/settings/branches
2. Click **"Add branch protection rule"**
3. Branch name pattern: `main`
4. Configure the following:

**Protect matching branches:**
- ✅ Require a pull request before merging
  - Required approvals: **2**
  - ✅ Dismiss stale pull request approvals when new commits are pushed
  - ✅ Require review from Code Owners
  
- ✅ Require status checks to pass before merging
  - ✅ Require branches to be up to date before merging
  - Search and select these status checks (they'll appear after first CI run):
    - `Lint & Type Check`
    - `Backend Tests`
    - `Portal Tests`
    - `Package Tests`
    - `Build All`
    - `Security Scan`

- ✅ Require conversation resolution before merging
- ✅ Require signed commits (optional but recommended)
- ✅ Include administrators

**Do not allow bypassing the above settings:**
- ❌ Allow force pushes (leave unchecked)
- ❌ Allow deletions (leave unchecked)

5. Click **"Create"**

#### Develop Branch Protection

1. Click **"Add branch protection rule"** again
2. Branch name pattern: `develop`
3. Configure the following:

**Protect matching branches:**
- ✅ Require a pull request before merging
  - Required approvals: **1**
  - ✅ Dismiss stale pull request approvals when new commits are pushed
  - ✅ Require review from Code Owners
  
- ✅ Require status checks to pass before merging
  - ✅ Require branches to be up to date before merging
  - Select status checks (same as main, except Security Scan is optional)

- ✅ Require conversation resolution before merging
- ✅ Include administrators

**Do not allow bypassing the above settings:**
- ❌ Allow force pushes (leave unchecked)
- ❌ Allow deletions (leave unchecked)

4. Click **"Create"**

### Step 2: Create GitHub Environments

#### Staging Environment

1. Go to: https://github.com/HealthFlowEgy/healthflow-digital-prescription-portals/settings/environments
2. Click **"New environment"**
3. Name: `staging`
4. Configure:
   - Deployment branches: `develop` only
   - No required reviewers (automatic deployment)
5. Click **"Configure environment"**

#### Production Environment

1. Click **"New environment"** again
2. Name: `production`
3. Configure:
   - Required reviewers: Add 2 senior engineers/tech leads
   - Wait timer: 5 minutes
   - Deployment branches: Selected branches → Add `main`
4. Click **"Configure environment"**

### Step 3: Update GitHub Secrets with Production Values

```bash
# Set your actual AWS credentials
echo 'YOUR_ACTUAL_AWS_KEY' | gh secret set AWS_ACCESS_KEY_ID \
  --repo HealthFlowEgy/healthflow-digital-prescription-portals

echo 'YOUR_ACTUAL_AWS_SECRET' | gh secret set AWS_SECRET_ACCESS_KEY \
  --repo HealthFlowEgy/healthflow-digital-prescription-portals

# Update database URLs
echo 'postgresql://user:pass@staging-rds.amazonaws.com:5432/healthflow' | \
  gh secret set STAGING_DATABASE_URL \
  --repo HealthFlowEgy/healthflow-digital-prescription-portals

echo 'postgresql://user:pass@prod-rds.amazonaws.com:5432/healthflow' | \
  gh secret set PRODUCTION_DATABASE_URL \
  --repo HealthFlowEgy/healthflow-digital-prescription-portals

# Update monitoring keys
echo 'YOUR_DATADOG_API_KEY' | gh secret set DATADOG_API_KEY \
  --repo HealthFlowEgy/healthflow-digital-prescription-portals

echo 'YOUR_DATADOG_APP_KEY' | gh secret set DATADOG_APP_KEY \
  --repo HealthFlowEgy/healthflow-digital-prescription-portals

# Update notification webhook
echo 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL' | \
  gh secret set SLACK_WEBHOOK_URL \
  --repo HealthFlowEgy/healthflow-digital-prescription-portals

# Update email service
echo 'YOUR_SENDGRID_API_KEY' | gh secret set SENDGRID_API_KEY \
  --repo HealthFlowEgy/healthflow-digital-prescription-portals

# Update JWT secret (must match core system)
echo 'YOUR_SHARED_JWT_SECRET' | gh secret set JWT_SECRET \
  --repo HealthFlowEgy/healthflow-digital-prescription-portals
```

### Step 4: Provision AWS Infrastructure

```bash
cd infrastructure/terraform

# Initialize Terraform
terraform init

# Review the plan
terraform plan -out=tfplan

# Apply the infrastructure
terraform apply tfplan

# Note the outputs (database endpoints, load balancer DNS, etc.)
terraform output
```

### Step 5: Verify Everything Works

```bash
# Trigger a test CI run
git checkout develop
git commit --allow-empty -m "test: trigger CI pipeline"
git push origin develop

# Watch the Actions tab
# https://github.com/HealthFlowEgy/healthflow-digital-prescription-portals/actions
```

---

## 📊 What's Already Done

✅ **Repository Structure** - Complete monorepo with workspaces  
✅ **Docker Configurations** - Backend and portal Dockerfiles  
✅ **Kubernetes Manifests** - Complete K8s deployment configs  
✅ **Terraform IaC** - Full AWS infrastructure code  
✅ **CI/CD Workflows** - Automated testing and deployment  
✅ **GitHub Secrets** - 11 secrets configured (update with real values)  
✅ **Documentation** - Comprehensive guides and runbooks  
✅ **CODEOWNERS** - Automated code review assignments  

⏳ **Pending** (10 minutes to complete):
- Branch protection rules (manual setup via web UI)
- GitHub Environments (staging, production)
- Update secrets with production values
- Provision AWS infrastructure

---

## 🎯 Development Workflow

### Feature Development

```
feature/xyz → develop → main
    ↓           ↓        ↓
  Local     Staging  Production
```

1. **Create feature branch** from `develop`
2. **Develop and test** locally
3. **Push and create PR** to `develop`
4. **CI runs automatically** (lint, test, build, security scan)
5. **Code review** (1 approval required)
6. **Merge to develop** → Automatic deployment to staging
7. **Test on staging**
8. **Create PR** from `develop` to `main`
9. **Code review** (2 approvals required)
10. **Merge to main** or **create version tag** → Manual production deployment

### Deployment Process

**Staging (Automatic):**
```bash
git checkout develop
git merge feature/xyz
git push origin develop
# Automatic deployment triggered
```

**Production (Manual Approval):**
```bash
git checkout main
git merge develop
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
# Manual approval required in GitHub Actions
```

---

## 📚 Additional Resources

- **Full Documentation**: `/docs/` directory
- **Branch Protection Guide**: `/docs/deployment/BRANCH_PROTECTION_SETUP.md`
- **Sprint 0 Checklist**: `/docs/deployment/SPRINT0_COMPLETION_CHECKLIST.md`
- **API Documentation**: `/docs/api/` (to be added by dev team)
- **Architecture Docs**: `/docs/architecture/` (to be added by dev team)

---

## 🆘 Need Help?

- **Slack**: #digital-prescription-portals
- **Email**: devops@healthflow.ai
- **GitHub Issues**: https://github.com/HealthFlowEgy/healthflow-digital-prescription-portals/issues

---

## 🎉 You're All Set!

The infrastructure is ready. Start building amazing healthcare solutions! 🏥

