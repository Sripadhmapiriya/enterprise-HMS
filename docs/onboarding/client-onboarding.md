# Client Onboarding Guide: Delivering Hospital A & Hospital B

This guide details the exact operational steps to provision, license, brand, import baseline data, and deliver standalone modular editions for two distinct client archetypes:
- **Hospital A**: Outpatient registry (*patients-only* preset)
- **Hospital B**: Urgent trauma center (*pharmacy-er* preset)

---

## 1. Onboarding Hospital A (Patients Only)

### Step 1: Provision Tenant & Entitlements
Execute the provisioning script using the `patients-only` preset:

```bash
npm run provision -- \
  --code HOSP-A-STJUDE \
  --name "St. Jude Outpatient Clinic" \
  --preset patients-only \
  --admin admin@stjude-clinic.org \
  --password "SecureClinic2026!"
```

**Output**:
- Tenant created with code `HOSP-A-STJUDE`
- Modules enabled: `foundation`, `patients` (2 modules)
- Disabled modules (25 modules) blocked with `404 MODULE_NOT_ENABLED`
- Ed25519 cryptographic license generated and stored in `Tenant.licenseKey`
- Primary Hospital and Main Branch configured

### Step 2: Build Pruned Physical Edition
To produce a deployment bundle where disabled module routes are physically pruned from disk:

```bash
# Prune routes for disabled modules (pharmacy, ipd, billing, etc.)
npm run build:edition -- --preset patients-only

# Verify web build completes cleanly with pruned routes
npm run build --workspace=web
```

### Step 3: Hospital A Client Customization & Branding
Configure hospital identity in `.env`:
```env
HOSPITAL_NAME="St. Jude Outpatient Clinic"
PRIMARY_COLOR="#0891B2"
LOGO_URL="/brands/st-jude-logo.png"
```

### Step 4: Import Historical Patient Master Data
Use the CSV import engine (`apps/api/src/services/csv-import.ts`) to validate and ingest baseline patient demographics:

1. Prepare `patients.csv`:
   ```csv
   mrn,firstName,lastName,dateOfBirth,gender,mobile,city
   MRN-00101,Arthur,Pendelton,1984-06-12,MALE,+1555019283,Metropolis
   MRN-00102,Beatrice,Gomez,1992-11-23,FEMALE,+1555029384,Metropolis
   ```
2. Run validation dry-run via API:
   ```bash
   curl -X POST http://localhost:4000/api/v1/platform/import/validate \
     -H "Authorization: Bearer <ADMIN_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"domain":"patients","csvContent":"mrn,firstName,lastName,dateOfBirth,gender,mobile,city\nMRN-00101,Arthur,Pendelton,1984-06-12,MALE,+1555019283,Metropolis"}'
   ```
3. Commit into database (`commit: true`).

### Step 5: Verification of Hospital A Isolation
- Visit `http://localhost:3000/patients` -> Shows Patient Directory and Patient 360 view.
- Visit `http://localhost:3000/pharmacy` or `/ipd` -> Returns 404 (Pruned/Disabled).
- Call API `GET /api/v1/pharmacy/inventory` -> Returns `404 Not Found` with `MODULE_NOT_ENABLED`.

---

## 2. Onboarding Hospital B (Pharmacy + ER)

### Step 1: Provision Tenant & Entitlements
Execute the provisioning script using the `pharmacy-er` preset:

```bash
npm run provision -- \
  --code HOSP-B-TRAUMA \
  --name "City Trauma Center" \
  --preset pharmacy-er \
  --admin admin@citytrauma.org \
  --password "TraumaCenter2026!"
```

**Output**:
- Tenant created with code `HOSP-B-TRAUMA`
- Modules enabled: `foundation`, `patients`, `inventory`, `pharmacy`, `emergency` (5 modules)
- Disabled modules (22 modules) blocked with `404 MODULE_NOT_ENABLED`
- Ed25519 cryptographic license generated

### Step 2: Build Pruned Physical Edition
```bash
# Prune routes for inpatient, billing, operating theatre, etc.
npm run build:edition -- --preset pharmacy-er

# Verify web build completes cleanly with pruned routes
npm run build --workspace=web
```

### Step 3: Hospital B Client Customization & Branding
Configure hospital identity in `.env`:
```env
HOSPITAL_NAME="City Trauma Center"
PRIMARY_COLOR="#E11D48"
LOGO_URL="/brands/city-trauma-logo.png"
```

### Step 4: Import Formulary & Emergency Pharmacy Stock
1. Prepare `items.csv`:
   ```csv
   code,name,category,unit,unitPrice
   MED-001,Epinephrine 1mg/ml Ampoule,EMERGENCY,AMPOULE,12.50
   MED-002,Morphine Sulfate 10mg/ml,ANALGESIC,VIAL,8.75
   MED-003,Normal Saline 0.9% 500ml,IV_FLUIDS,BAG,3.20
   ```
2. Commit via bulk import API (`/api/v1/platform/import/commit`).
3. Seed opening stock batches with expiration dates to initiate FEFO queueing.

### Step 5: Verification of Hospital B Capabilities & Gating
- Triage Board at `http://localhost:3000/operations/emergency` -> Active, displays ESI triage scoring.
- Pharmacy POS at `http://localhost:3000/pharmacy` -> Active, displays FEFO batch selection.
- Stock Ledger at `http://localhost:3000/inventory` -> Active, tracks item movements.
- Inpatient Board at `http://localhost:3000/ipd` -> Returns 404 (Pruned/Disabled).
- Billing Ledger at `http://localhost:3000/billing` -> Returns 404 (Pruned/Disabled).
