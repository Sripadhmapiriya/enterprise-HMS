const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export class ApiClientError extends Error {
  public code: string;
  public details?: any[];
  public status: number;

  constructor(message: string, code: string = 'API_ERROR', status: number = 500, details?: any[]) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('hms_access_token');
}

function getStoredTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('hms_tenant_id');
}

async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data: T; meta?: any }> {
  const token = getStoredToken();
  const tenantId = getStoredTenantId();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }
  if (tenantId) {
    headers['X-Tenant-Id'] = tenantId;
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
  const url = API_BASE + cleanEndpoint;

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = json?.error || {};
      throw new ApiClientError(
        err.message || 'Request failed with status ' + res.status,
        err.code || 'HTTP_ERROR',
        res.status,
        err.details
      );
    }

    return json;
  } catch (error: any) {
    if (error instanceof ApiClientError) throw error;
    throw new ApiClientError(error?.message || 'Network request failed', 'NETWORK_ERROR', 0);
  }
}

// ==========================================
// PATIENTS API
// ==========================================

export const patientsApi = {
  list: async (params?: { q?: string; page?: number; limit?: number; gender?: string; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set('q', params.q);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.gender) searchParams.set('gender', params.gender);
    if (params?.status) searchParams.set('status', params.status);

    const qs = searchParams.toString();
    return request('/patients' + (qs ? '?' + qs : ''));
  },

  get: async (id: string) => {
    return request('/patients/' + id);
  },

  create: async (data: any) => {
    return request('/patients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string, data: any) => {
    return request('/patients/' + id, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  checkDuplicates: async (params: { firstName?: string; lastName?: string; mobile?: string; dateOfBirth?: string }) => {
    const searchParams = new URLSearchParams();
    if (params.firstName) searchParams.set('firstName', params.firstName);
    if (params.lastName) searchParams.set('lastName', params.lastName);
    if (params.mobile) searchParams.set('mobile', params.mobile);
    if (params.dateOfBirth) searchParams.set('dateOfBirth', params.dateOfBirth);

    return request('/patients/duplicates?' + searchParams.toString());
  },

  merge: async (data: { sourcePatientId: string; targetPatientId: string; reason: string }) => {
    return request('/patients/merge', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  addAllergy: async (patientId: string, data: { allergen: string; reaction?: string; severity?: string; notes?: string }) => {
    return request('/patients/' + patientId + '/allergies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  addAlert: async (patientId: string, data: { alertType: string; description: string; severity: string }) => {
    return request('/patients/' + patientId + '/alerts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  addDocument: async (patientId: string, data: { title: string; documentType: string; fileUrl: string; fileSize?: number; mimeType?: string }) => {
    return request('/patients/' + patientId + '/documents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  addConsent: async (patientId: string, data: { consentType: string; notes?: string; witnessName?: string; expiresAt?: string }) => {
    return request('/patients/' + patientId + '/consents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getTimeline: async (patientId: string) => {
    return request('/patients/' + patientId + '/timeline');
  },
};

// ==========================================
// SCHEDULING API
// ==========================================

export const schedulingApi = {
  getSchedules: async (params?: { branchId?: string; doctorId?: string }) => {
    const searchParams = new URLSearchParams(params as any);
    const qs = searchParams.toString();
    return request('/scheduling/schedules' + (qs ? '?' + qs : ''));
  },

  createSchedule: async (data: any) => {
    return request('/scheduling/schedules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getSlots: async (doctorId: string, date: string, branchId?: string) => {
    const qs = new URLSearchParams({ doctorId, date });
    if (branchId) qs.set('branchId', branchId);
    return request('/scheduling/slots?' + qs.toString());
  },

  getAppointments: async (params?: { doctorId?: string; patientId?: string; date?: string; status?: string; branchId?: string }) => {
    const searchParams = new URLSearchParams(params as any);
    const qs = searchParams.toString();
    return request('/scheduling/appointments' + (qs ? '?' + qs : ''));
  },

  bookAppointment: async (data: any) => {
    return request('/scheduling/appointments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  rescheduleAppointment: async (id: string, data: { newDate: string; newStartTime: string; newEndTime: string; reason?: string }) => {
    return request('/scheduling/appointments/' + id + '/reschedule', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  cancelAppointment: async (id: string, reason: string) => {
    return request('/scheduling/appointments/' + id + '/cancel', {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  },

  checkIn: async (appointmentId: string) => {
    return request('/scheduling/appointments/' + appointmentId + '/check-in', {
      method: 'POST',
    });
  },

  getQueue: async (params?: { branchId?: string; doctorId?: string; status?: string; date?: string }) => {
    const searchParams = new URLSearchParams(params as any);
    const qs = searchParams.toString();
    return request('/scheduling/queue' + (qs ? '?' + qs : ''));
  },

  updateQueueStatus: async (id: string, status: string) => {
    return request('/scheduling/queue/' + id + '/status', {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  getDisplayBoard: async (branchId?: string) => {
    const qs = branchId ? '?branchId=' + branchId : '';
    return request('/scheduling/queue/display' + qs);
  },
};

// ==========================================
// OPD API
// ==========================================

export const opdApi = {
  getEncounters: async (params?: { patientId?: string; doctorId?: string; status?: string; date?: string }) => {
    const searchParams = new URLSearchParams(params as any);
    const qs = searchParams.toString();
    return request('/opd/encounters' + (qs ? '?' + qs : ''));
  },

  startEncounter: async (data: { patientId: string; doctorId: string; branchId: string; departmentId: string; appointmentId?: string; type?: string }) => {
    return request('/opd/encounters', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getEncounter: async (id: string) => {
    return request('/opd/encounters/' + id);
  },

  recordVitals: async (encounterId: string, data: any) => {
    return request('/opd/encounters/' + encounterId + '/vitals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  recordSoap: async (encounterId: string, data: any) => {
    return request('/opd/encounters/' + encounterId + '/soap', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  addDiagnosis: async (encounterId: string, data: { description: string; diagnosisCode?: string; type?: string; notes?: string }) => {
    return request('/opd/encounters/' + encounterId + '/diagnoses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  createPrescription: async (encounterId: string, data: { items: any[]; notes?: string; overrideAllergyAlerts?: boolean }) => {
    return request('/opd/encounters/' + encounterId + '/prescriptions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  createInvestigation: async (encounterId: string, data: { items: any[]; priority?: string; notes?: string }) => {
    return request('/opd/encounters/' + encounterId + '/investigations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  createReferral: async (encounterId: string, data: any) => {
    return request('/opd/encounters/' + encounterId + '/referrals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  createCertificate: async (encounterId: string, data: any) => {
    return request('/opd/encounters/' + encounterId + '/certificates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  closeEncounter: async (encounterId: string) => {
    return request('/opd/encounters/' + encounterId + '/close', {
      method: 'POST',
    });
  },

  getPrintSummary: async (encounterId: string) => {
    return request('/opd/encounters/' + encounterId + '/print');
  },
};

// ==========================================
// ENTERPRISE & MODULE MANAGER API
// ==========================================

export const enterpriseApi = {
  getModules: async () => {
    return request('/enterprise/modules');
  },

  toggleModule: async (moduleId: string, data: { enabled: boolean; autoEnableDependencies?: boolean }) => {
    return request('/enterprise/modules/' + moduleId, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  applyPreset: async (presetId: string) => {
    return request('/enterprise/modules/apply-preset', {
      method: 'POST',
      body: JSON.stringify({ presetId }),
    });
  },
};

// ==========================================
// LICENSING API
// ==========================================

export const licensingApi = {
  getStatus: async () => {
    return request('/licensing/status');
  },
};

// ==========================================
// INVENTORY API
// ==========================================

export const inventoryApi = {
  listItems: async (params?: { q?: string }) => {
    const qs = params?.q ? `?q=${encodeURIComponent(params.q)}` : '';
    return request('/inventory/items' + qs);
  },

  getItem: async (id: string) => {
    return request('/inventory/items/' + id);
  },

  createItem: async (data: any) => {
    return request('/inventory/items', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  listLocations: async () => {
    return request('/inventory/locations');
  },

  createLocation: async (data: any) => {
    return request('/inventory/locations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  listBatches: async (params?: { productId?: string; locationId?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.productId) searchParams.set('productId', params.productId);
    if (params?.locationId) searchParams.set('locationId', params.locationId);
    const qs = searchParams.toString();
    return request('/inventory/batches' + (qs ? '?' + qs : ''));
  },

  receiveBatch: async (data: any) => {
    return request('/inventory/batches', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  adjustStock: async (data: any) => {
    return request('/inventory/adjustments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getAlerts: async () => {
    return request('/inventory/alerts');
  },

  getLedger: async (params?: { productId?: string }) => {
    const qs = params?.productId ? `?productId=${encodeURIComponent(params.productId)}` : '';
    return request('/inventory/ledger' + qs);
  },
};

// ==========================================
// PHARMACY API
// ==========================================

export const pharmacyApi = {
  getQueue: async () => {
    return request('/pharmacy/queue');
  },

  getPrescription: async (id: string) => {
    return request('/pharmacy/prescriptions/' + id);
  },

  dispense: async (data: any) => {
    return request('/pharmacy/dispense', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  posSale: async (data: any) => {
    return request('/pharmacy/pos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getDispensings: async () => {
    return request('/pharmacy/dispensings');
  },

  getControlledRegister: async () => {
    return request('/pharmacy/controlled-register');
  },

  returnMedications: async (data: any) => {
    return request('/pharmacy/returns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ==========================================
// EMERGENCY (ER) API
// ==========================================

export const emergencyApi = {
  fastRegister: async (data: any) => {
    return request('/emergency/fast-register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  triage: async (data: any) => {
    return request('/emergency/triage', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getBoard: async () => {
    return request('/emergency/board');
  },

  logResuscitation: async (encounterId: string, data: any) => {
    return request('/emergency/encounters/' + encounterId + '/resuscitation', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  disposition: async (encounterId: string, data: any) => {
    return request('/emergency/encounters/' + encounterId + '/disposition', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ==========================================
// BILLING API
// ==========================================

export const billingApi = {
  getTariffs: async () => {
    return request('/billing/tariffs');
  },
  getCharges: async () => {
    return request('/billing/charges');
  },
  getBills: async (params?: { patientId?: string; status?: string; billType?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams(params as any);
    const qs = searchParams.toString();
    return request('/billing/bills' + (qs ? '?' + qs : ''));
  },
  getBill: async (id: string) => {
    return request('/billing/bills/' + id);
  },
  createBill: async (data: any) => {
    return request('/billing/bills', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  addItem: async (billId: string, item: any) => {
    return request('/billing/bills/' + billId + '/items', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  },
  finalizeBill: async (billId: string) => {
    return request('/billing/bills/' + billId + '/finalize', {
      method: 'POST',
    });
  },
  processPayment: async (billId: string, payment: any) => {
    return request('/billing/bills/' + billId + '/payments', {
      method: 'POST',
      body: JSON.stringify(payment),
    });
  },
  getPayments: async () => {
    return request('/billing/payments');
  },
  getInvoicePdfUrl: (billId: string) => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    return `${base}/billing/bills/${billId}/pdf`;
  },
  getReceiptPdfUrl: (paymentId: string) => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    return `${base}/billing/payments/${paymentId}/receipt-pdf`;
  },
  startShift: async (data: any) => {
    return request('/billing/shifts/start', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  closeShift: async (data: any) => {
    return request('/billing/shifts/close', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ==========================================
// INSURANCE API
// ==========================================

export const insuranceApi = {
  getProviders: async () => {
    return request('/insurance/providers');
  },
  createProvider: async (data: any) => {
    return request('/insurance/providers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  getTpas: async () => {
    return request('/insurance/tpas');
  },
  createTpa: async (data: any) => {
    return request('/insurance/tpas', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  getPatientPolicies: async (patientId: string) => {
    return request('/insurance/patients/' + patientId + '/policies');
  },
  addPatientPolicy: async (patientId: string, data: any) => {
    return request('/insurance/patients/' + patientId + '/policies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  submitPreAuth: async (data: any) => {
    return request('/insurance/pre-auth', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  getClaims: async (params?: { status?: string; providerId?: string }) => {
    const searchParams = new URLSearchParams(params as any);
    const qs = searchParams.toString();
    return request('/insurance/claims' + (qs ? '?' + qs : ''));
  },
  getClaim: async (id: string) => {
    return request('/insurance/claims/' + id);
  },
  createClaim: async (data: any) => {
    return request('/insurance/claims', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  settleClaim: async (claimId: string, data: any) => {
    return request('/insurance/claims/' + claimId + '/settle', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ==========================================
// LABORATORY API
// ==========================================

export const laboratoryApi = {
  getWorklist: async (status?: string) => {
    const qs = status ? '?status=' + status : '';
    return request('/laboratory/worklist' + qs);
  },
  createOrder: async (data: any) => {
    return request('/laboratory/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  collectSample: async (data: any) => {
    return request('/laboratory/samples/collect', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  getSamples: async (status?: string) => {
    const qs = status ? '?status=' + status : '';
    return request('/laboratory/samples' + qs);
  },
  enterResults: async (sampleId: string, results: any[]) => {
    return request('/laboratory/samples/' + sampleId + '/results', {
      method: 'POST',
      body: JSON.stringify({ results }),
    });
  },
  validateSample: async (sampleId: string) => {
    return request('/laboratory/samples/' + sampleId + '/validate', {
      method: 'POST',
    });
  },
  getCriticalResults: async () => {
    return request('/laboratory/critical-results');
  },
  acknowledgeCritical: async (criticalId: string, data: any) => {
    return request('/laboratory/critical-results/' + criticalId + '/acknowledge', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  getReportPdfUrl: (sampleId: string) => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    return `${base}/laboratory/samples/${sampleId}/report-pdf`;
  },
};

// ==========================================
// RADIOLOGY API
// ==========================================

export const radiologyApi = {
  getWorklist: async (params?: { modality?: string; status?: string }) => {
    const searchParams = new URLSearchParams(params as any);
    const qs = searchParams.toString();
    return request('/radiology/worklist' + (qs ? '?' + qs : ''));
  },
  createOrder: async (data: any) => {
    return request('/radiology/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  performStudy: async (studyId: string) => {
    return request('/radiology/studies/' + studyId + '/perform', {
      method: 'POST',
    });
  },
  reportStudy: async (studyId: string, data: any) => {
    return request('/radiology/studies/' + studyId + '/report', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  verifyStudy: async (studyId: string) => {
    return request('/radiology/studies/' + studyId + '/verify', {
      method: 'POST',
    });
  },
  getPacsUrl: async (studyId: string) => {
    return request('/radiology/studies/' + studyId + '/pacs-url');
  },
};

