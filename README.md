# HealthFlow Digital Prescription Portals

🏥 Regulatory, Super Admin, and Business Intelligence portals for the HealthFlow AI ecosystem.

## 🎯 Overview

This repository contains three specialized portals for managing the HealthFlow Digital Prescription system:

- **Regulatory Portal**: EDA medicine directory management, compliance monitoring, adverse event tracking, and market recalls
- **Super Admin Portal**: Multi-tenant management, system configuration, billing, and monitoring
- **Business Intelligence Portal**: Executive dashboards, analytics, and custom reporting

## 🏗️ Architecture

```
digital-prescription-portals/
├── portals/              # Frontend applications (React + TypeScript + Vite)
├── backend/              # API services (Node.js + Express + TypeScript)
├── packages/             # Shared libraries
├── infrastructure/       # IaC and deployment configs
└── docs/                 # Documentation
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL 14+
- Redis 7+
- Docker & Docker Compose

### Installation

```bash
# Clone repository
git clone git@github.com:HealthFlowEgy/healthflow-digital-prescription-portals.git
cd healthflow-digital-prescription-portals

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npm run migrate

# Start development servers
npm run dev
```

## 📦 Workspaces

- **portals/regulatory** - EDA Regulatory Officer Portal
- **portals/super-admin** - Super Administrator Portal
- **portals/business-intelligence** - BI & Analytics Portal
- **backend** - API services for all portals
- **packages/ui-components** - Shared React components
- **packages/auth** - Authentication utilities
- **packages/api-client** - API client library

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- packages/ui-components

# Run E2E tests
npm run test:e2e

# Run with coverage
npm run test:coverage
```

## 🏗️ Build & Deploy

```bash
# Build all packages
npm run build

# Build specific portal
npm run build -- portals/regulatory

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production
```

## 📚 Documentation

- [Architecture Overview](./docs/architecture/overview.md)
- [API Reference](./docs/api/README.md)
- [Deployment Guide](./docs/deployment/README.md)
- [Development Guide](./docs/development/README.md)

## 🔐 Security

- All PHI is encrypted at rest and in transit
- HIPAA compliant audit logging
- Role-based access control (RBAC)
- Two-factor authentication for critical actions

## 🤝 Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## 📄 License

Proprietary - HealthFlow AI © 2025

## 📞 Support

- **Email**: dev-support@healthflow.ai
- **Slack**: #digital-prescription-portals
- **Docs**: https://docs.healthflow.ai/portals

## 📊 Project Stats

- **Serves**: 105M Egyptian population
- **Processes**: 575,000 daily prescriptions
- **Manages**: 700,000+ healthcare professionals
- **Handles**: 287,000 daily health claims

