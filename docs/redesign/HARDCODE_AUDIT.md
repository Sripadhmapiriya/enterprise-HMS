# Hardcode Audit

## Frontend (apps/web)
- opd/consultation/[id]/page.tsx: Default vitals (98.6 temp, 76 pulse) violating clinical safety.
- appointments/page.tsx: 'doc-default', 'dept-opd', 'branch-default'.
- patients/[id]/page.tsx: 'branch-default', 'dept-opd'.
- operations/blood-bank/page.tsx: hardcoded mobile '9876543210'.
- pharmacy/page.tsx, pharmacy/prescriptions/page.tsx, ipd/chart/[id]/page.tsx, integrations/page.tsx: Math.random() for UI IDs.
- ipd/nursing/page.tsx: Hardcoded wards array.
- dashboard/page.tsx: Hardcoded charts/KPIs.

## Backend (apps/api)
- API routes (ipd, opd, pharmacy, procurement, scheduling, radiology, patients, inventory, laboratory, hr, insurance, finance, emergency, cssd, bloodbank, billing, assets): Use Math.random() or Date.now() for IDs, rand suffixes, fallback IDs.
- opd.ts, scheduling.ts: Checking against 'branch-default', 'doc-default', 'dept-opd'.
- authService.ts: fallbackTenant logic.

All items must be removed and replaced with real DB data.
