# Branch Protection Rules Setup Guide

**Repository:** HealthFlowEgy/healthflow-digital-prescription-portals  
**Required GitHub Plan:** GitHub Pro or Enterprise (for private repositories)  
**Last Updated:** October 12, 2025

---

## Overview

Branch protection rules ensure code quality and prevent accidental changes to critical branches. This guide provides step-by-step instructions for configuring branch protection for the `main` and `develop` branches.

## Prerequisites

- GitHub Pro, Team, or Enterprise account (required for private repositories)
- Admin access to the repository
- CI/CD workflows already configured

## Branch Protection Configuration

### Main Branch (Production)

The `main` branch contains production-ready code and requires the highest level of protection.

#### Step-by-Step Setup

1. **Navigate to Branch Protection Settings**
   - Go to: https://github.com/HealthFlowEgy/healthflow-digital-prescription-portals/settings/branches
   - Click "Add branch protection rule"
   - Enter branch name pattern: `main`

2. **Require Pull Request Reviews**
   - ✅ Check "Require a pull request before merging"
   - Set "Required number of approvals before merging": **2**
   - ✅ Check "Dismiss stale pull request approvals when new commits are pushed"
   - ✅ Check "Require review from Code Owners"
   - ✅ Check "Require approval of the most recent reviewable push"

3. **Require Status Checks**
   - ✅ Check "Require status checks to pass before merging"
   - ✅ Check "Require branches to be up to date before merging"
   - Select the following status checks:
     - `Lint & Type Check`
     - `Backend Tests`
     - `Portal Tests`
     - `Package Tests`
     - `Build All`
     - `Security Scan`

4. **Additional Protections**
   - ✅ Check "Require conversation resolution before merging"
   - ✅ Check "Require signed commits" (optional but recommended)
   - ✅ Check "Require linear history" (optional)
   - ✅ Check "Include administrators" (enforce rules for admins)

5. **Restrictions**
   - ❌ Do NOT check "Allow force pushes"
   - ❌ Do NOT check "Allow deletions"

6. **Save Changes**
   - Click "Create" or "Save changes"

---

### Develop Branch (Staging)

The `develop` branch is used for integration and staging deployments.

#### Step-by-Step Setup

1. **Navigate to Branch Protection Settings**
   - Go to: https://github.com/HealthFlowEgy/healthflow-digital-prescription-portals/settings/branches
   - Click "Add branch protection rule"
   - Enter branch name pattern: `develop`

2. **Require Pull Request Reviews**
   - ✅ Check "Require a pull request before merging"
   - Set "Required number of approvals before merging": **1**
   - ✅ Check "Dismiss stale pull request approvals when new commits are pushed"
   - ✅ Check "Require review from Code Owners"

3. **Require Status Checks**
   - ✅ Check "Require status checks to pass before merging"
   - ✅ Check "Require branches to be up to date before merging"
   - Select the following status checks:
     - `Lint & Type Check`
     - `Backend Tests`
     - `Portal Tests`
     - `Package Tests`
     - `Build All`

4. **Additional Protections**
   - ✅ Check "Require conversation resolution before merging"
   - ✅ Check "Include administrators" (enforce rules for admins)

5. **Restrictions**
   - ❌ Do NOT check "Allow force pushes"
   - ❌ Do NOT check "Allow deletions"

6. **Save Changes**
   - Click "Create" or "Save changes"

---

## Quick Reference Table

| Setting | Main Branch | Develop Branch |
|---------|-------------|----------------|
| **Pull Request Required** | ✅ Yes | ✅ Yes |
| **Required Approvals** | 2 | 1 |
| **Dismiss Stale Reviews** | ✅ Yes | ✅ Yes |
| **Code Owner Review** | ✅ Yes | ✅ Yes |
| **Status Checks Required** | ✅ Yes (6 checks) | ✅ Yes (5 checks) |
| **Up-to-date Branch** | ✅ Yes | ✅ Yes |
| **Conversation Resolution** | ✅ Yes | ✅ Yes |
| **Signed Commits** | ⚠️ Optional | ❌ No |
| **Linear History** | ⚠️ Optional | ❌ No |
| **Enforce for Admins** | ✅ Yes | ✅ Yes |
| **Allow Force Pushes** | ❌ No | ❌ No |
| **Allow Deletions** | ❌ No | ❌ No |

---

## Required Status Checks

The following CI/CD checks must pass before merging:

### Main Branch Status Checks

1. **Lint & Type Check** - ESLint and TypeScript validation
2. **Backend Tests** - Backend unit and integration tests
3. **Portal Tests** - Frontend portal tests (all 3 portals)
4. **Package Tests** - Shared package tests
5. **Build All** - Complete build verification
6. **Security Scan** - Trivy vulnerability scanning

### Develop Branch Status Checks

Same as main branch, except:
- Security Scan is optional (but recommended)

---

## CODEOWNERS File

Create a `CODEOWNERS` file to automatically request reviews from specific teams or individuals.

**Location:** `.github/CODEOWNERS`

```
# HealthFlow Digital Prescription Portals - Code Owners

# Default owners for everything in the repo
* @HealthFlowEgy/devops-team

# Infrastructure changes require DevOps approval
/infrastructure/ @HealthFlowEgy/devops-team @HealthFlowEgy/platform-team

# Backend changes require backend team approval
/backend/ @HealthFlowEgy/backend-team

# Portal changes require frontend team approval
/portals/regulatory/ @HealthFlowEgy/frontend-team @HealthFlowEgy/regulatory-team
/portals/super-admin/ @HealthFlowEgy/frontend-team @HealthFlowEgy/admin-team
/portals/business-intelligence/ @HealthFlowEgy/frontend-team @HealthFlowEgy/analytics-team

# Database migrations require special approval
/backend/shared/database/migrations/ @HealthFlowEgy/database-team @HealthFlowEgy/devops-team

# CI/CD workflows require DevOps approval
/.github/workflows/ @HealthFlowEgy/devops-team

# Security-sensitive files
/.github/workflows/deploy-production.yml @HealthFlowEgy/devops-team @HealthFlowEgy/security-team
/infrastructure/terraform/ @HealthFlowEgy/devops-team @HealthFlowEgy/security-team
```

---

## GitHub Environments

Set up GitHub Environments for deployment approvals.

### Staging Environment

1. Go to: Settings → Environments → New environment
2. Name: `staging`
3. Environment protection rules:
   - ❌ No required reviewers (automatic deployment)
   - ✅ Wait timer: 0 minutes
   - ✅ Deployment branches: `develop` only

### Production Environment

1. Go to: Settings → Environments → New environment
2. Name: `production`
3. Environment protection rules:
   - ✅ Required reviewers: Add 2 senior engineers or tech leads
   - ✅ Wait timer: 5 minutes (cooling period)
   - ✅ Deployment branches: `main` only (or tags matching `v*.*.*`)

---

## Verification Checklist

After setting up branch protection, verify the following:

### Main Branch
- [ ] Cannot push directly to main
- [ ] Pull request requires 2 approvals
- [ ] All 6 status checks must pass
- [ ] Stale reviews are dismissed on new commits
- [ ] Code owner review is required
- [ ] Conversations must be resolved
- [ ] Force pushes are blocked
- [ ] Branch deletion is blocked

### Develop Branch
- [ ] Cannot push directly to develop
- [ ] Pull request requires 1 approval
- [ ] All 5 status checks must pass
- [ ] Stale reviews are dismissed on new commits
- [ ] Code owner review is required
- [ ] Conversations must be resolved
- [ ] Force pushes are blocked
- [ ] Branch deletion is blocked

---

## Troubleshooting

### Issue: Status checks not appearing

**Solution:**
- Status checks only appear after the CI workflow runs at least once
- Push a test commit to trigger the CI workflow
- Wait for the workflow to complete
- Return to branch protection settings and select the status checks

### Issue: Cannot merge despite passing checks

**Possible causes:**
1. Branch is not up-to-date with base branch
2. Conversations are not resolved
3. Required reviewers have not approved
4. Code owner review is missing

**Solution:**
- Update branch with latest changes from base
- Resolve all conversations
- Request reviews from required reviewers
- Ensure code owner has reviewed

### Issue: Admins can bypass protection rules

**Solution:**
- Ensure "Include administrators" is checked in branch protection settings
- This enforces rules even for repository admins

---

## Best Practices

1. **Regular Reviews**: Review and update branch protection rules quarterly
2. **Team Alignment**: Ensure all team members understand the workflow
3. **Documentation**: Keep this guide updated with any changes
4. **Testing**: Test branch protection by creating a test PR
5. **Monitoring**: Monitor PR metrics to ensure rules are not too restrictive

---

## Additional Resources

- [GitHub Branch Protection Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub CODEOWNERS Documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
- [GitHub Environments Documentation](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)

---

## Support

For questions or issues with branch protection setup:
- **Slack**: #digital-prescription-portals
- **Email**: devops@healthflow.ai
- **GitHub Issues**: Create an issue with label `infrastructure`

