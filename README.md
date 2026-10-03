# Enterprise HMS (Phase 1)

This repository contains the foundation for a scalable, multi-tenant Hospital Management System.

## Architecture

- **apps/web**: Next.js 14 (App Router, Tailwind CSS, TypeScript)
- **apps/api**: Node.js/Express REST API (TypeScript)
- **packages/database**: Prisma ORM, PostgreSQL schema, Migrations, Seed data
- **packages/ui**: Shared React components
- **packages/types**: Shared TypeScript types
- **packages/config**: Shared configurations

## Setup Instructions

1. **Start Database:**
   Ensure you have Docker installed and run:
   ```bash
   docker-compose up -d
   ```
   Or ensure you have a local PostgreSQL instance running.

2. **Configure Environment:**
   Copy `.env.example` to `.env` and set `DATABASE_URL`.
   ```bash
   cp .env.example .env
   ```

3. **Install Dependencies:**
   ```bash
   npm install
   ```

4. **Initialize Database:**
   ```bash
   npm run db:push --workspace=@enterprise-hms/database
   npm run db:seed --workspace=@enterprise-hms/database
   ```

5. **Start Application:**
   ```bash
   npm run dev
   ```

## Development

- Start API only: `npm run dev --workspace=@enterprise-hms/api`
- Start Web only: `npm run dev --workspace=@enterprise-hms/web`

## Features Implemented in Phase 1
- [x] Monorepo Architecture
- [x] Prisma Database Schema (Tenants, Hospitals, Branches, Departments, Users, Roles, Staff, Doctors)
- [x] Multi-tenant isolation at schema level
- [x] Seed data generation (Demo Tenant, Hospital, Admin user)
- [x] Next.js 14 setup
- [x] Express REST API setup
