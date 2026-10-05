# Module Catalog & Edition Presets

This document specifies the complete catalog of all 25 system modules and the pre-packaged client edition presets available in the Enterprise HMS.

---

## 1. Complete Module Catalog

| Module ID | Display Name | Category | Direct Dependencies | Key Capabilities |
|---|---|---|---|---|
| `foundation` | Platform Foundation | Core | *None* | Authentication, RBAC, tenancy, audit logging |
| `patients` | Patient Master Index | Clinical | `foundation` | MRN generation, demographics, Patient 360 |
| `scheduling` | Appointment Scheduling | Clinical | `patients` | Slot booking, doctor queues, conflict checks |
| `opd` | Outpatient Department | Clinical | `patients`, `scheduling` | Consultation charting, vitals, e-prescriptions |
| `emergency` | Emergency Department | Clinical | `patients` | Fast-track intake, triage scoring, dispositions |
| `ipd` | Inpatient Care | Clinical | `patients` | ADT bed board, clinical MAR, nursing rounds |
| `icu` | Intensive Care Unit | Clinical | `ipd` | SOFA scoring, telemetry, critical alarms |
| `ot` | Operating Theatre | Clinical | `patients` | Surgical scheduling, WHO checklist, implants |
| `laboratory` | Clinical Laboratory | Diagnostics | `patients` | Specimen accessioning, worklists, critical alerts |
| `radiology` | Radiology & PACS | Diagnostics | `patients` | Imaging worklist, DICOM viewer links, reports |
| `pharmacy` | Pharmacy Dispensing | Clinical | `patients`, `inventory` | FEFO dispensing, prescription fulfillment |
| `inventory` | Stock & Warehouse | Supply Chain | `foundation` | Batches, bin tracking, stock ledgers, reorders |
| `procurement` | Purchasing & POs | Supply Chain | `inventory` | Requisitions, PO approvals, GRN matching |
| `billing` | Revenue Cycle & Billing | Finance | `patients` | Invoicing, cashier shifts, payment receipts |
| `insurance` | TPA & Insurance Claims | Finance | `billing` | Pre-authorizations, claim submission, settlements |
| `bloodbank` | Blood Bank Operations | Operations | `patients`, `inventory` | Donor registry, crossmatch testing, transfusion |
| `cssd` | Sterile Services | Operations | `inventory` | Autoclave cycles, biological indicators, QA |
| `dietary` | Inpatient Nutrition | Operations | `ipd` | Clinical diet orders, kitchen prep worklist |
| `housekeeping` | Facility Hygiene | Operations | `ipd` | Terminal cleaning, automated bed turnover |
| `ambulance` | Fleet & Dispatch | Operations | `patients` | ALS/BLS dispatch, transit tracking, restoration |
| `hr` | Human Resources | Corporate | `foundation` | Employee master, roster scheduling, payroll |
| `finance` | General Ledger & Accounting | Corporate | `billing` | Chart of accounts, double-entry journals, aging |
| `assets` | Biomedical Asset CMMS | Corporate | `foundation` | Asset registry, breakdown alerts, maintenance |
| `crm` | Patient Feedback & Relations| Engagement | `patients` | Feedback scoring, SLA escalations, sentiment |
| `analytics` | Analytics & MIS Reporting | Executive | `foundation` | Executive scorecards, MIS packs, 7-day trends |
| `integrations` | Interoperability Hub | Integration | `foundation` | ABDM M1-M3, HL7 FHIR R4, HL7 v2, LIS feeds |
| `enterprise` | Multi-Hospital Admin | Governance | `foundation` | Hospital registry, cross-site telemetry, modules |

---

## 2. Edition Presets

Edition presets configure the initial module entitlements for client organizations:

### 1. `patients-only`
- **Target Audience**: Primary care registries, immunization clinics, diagnostic frontdesks.
- **Enabled Modules**: `foundation`, `patients`.
- **Characteristics**: Extremely lightweight; hides inpatient, billing, pharmacy, and diagnostic routes.

### 2. `pharmacy-er`
- **Target Audience**: Emergency trauma centers, standalone hospital pharmacies, urgent care hubs.
- **Enabled Modules**: `foundation`, `patients`, `inventory`, `pharmacy`, `emergency`.
- **Characteristics**: High-velocity triage boards and rapid medication dispensing without requiring formal inpatient admission or full accounting ledgers.

### 3. `opd-clinic`
- **Target Audience**: Outpatient specialty clinics, dental centers, physician consultation practices.
- **Enabled Modules**: `foundation`, `patients`, `scheduling`, `opd`, `billing`.
- **Characteristics**: Focuses on doctor appointments, queue management, electronic prescriptions, and cashier bill settlement.

### 4. `diagnostic-centre`
- **Target Audience**: Pathology laboratories, imaging centers, ultrasound and MRI scanning hubs.
- **Enabled Modules**: `foundation`, `patients`, `scheduling`, `laboratory`, `radiology`, `billing`.
- **Characteristics**: Tailored for specimen tracking, analyzer integration, imaging reports, and diagnostic fee collection.

### 5. `hospital-standard`
- **Target Audience**: Community and medium-sized general hospitals.
- **Enabled Modules**: `foundation`, `patients`, `scheduling`, `opd`, `emergency`, `ipd`, `laboratory`, `radiology`, `pharmacy`, `inventory`, `billing`, `insurance`, `housekeeping`.
- **Characteristics**: Complete inpatient and outpatient clinical footprint.

### 6. `full-enterprise`
- **Target Audience**: Multi-site tertiary hospital chains, university medical centers.
- **Enabled Modules**: All 25 modules.
- **Characteristics**: Comprehensive clinical, operational, supply chain, financial, HR, analytical, and interoperability capabilities.
