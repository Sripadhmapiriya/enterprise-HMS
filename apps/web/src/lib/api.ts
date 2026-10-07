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

function getStoredBranchId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('hms_selected_branch_id');
}

async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data: T; meta?: any; message?: string }> {
  const token = getStoredToken();
  const tenantId = getStoredTenantId();
  const branchId = getStoredBranchId();

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
  if (branchId) {
    headers['X-Branch-Id'] = branchId;
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
      // Attempt silent session refresh on 401 or 403 (except for login or refresh itself)
      const isRetried = (options as any)._retried;
      const isAuthEndpoint = cleanEndpoint.includes('/auth/login') || cleanEndpoint.includes('/auth/refresh');
      if ((res.status === 401 || res.status === 403) && typeof window !== 'undefined' && !isRetried && !isAuthEndpoint) {
        const storedRefresh = localStorage.getItem('hms_refresh_token');
        if (storedRefresh) {
          try {
            const refreshRes = await fetch(API_BASE + '/auth/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken: storedRefresh }),
            });
            const refreshJson = await refreshRes.json().catch(() => ({}));
            if (refreshRes.ok && refreshJson.data?.accessToken) {
              localStorage.setItem('hms_access_token', refreshJson.data.accessToken);
              if (refreshJson.data.refreshToken) {
                localStorage.setItem('hms_refresh_token', refreshJson.data.refreshToken);
              }
              // Retry request with fresh token
              return request<T>(endpoint, {
                ...options,
                _retried: true,
              } as any);
            }
          } catch {
            // Proceed to standard fallback if refresh fails
          }
        }

        if (res.status === 401) {
          localStorage.removeItem('hms_access_token');
          if (window.location.pathname !== '/login') {
            const redirect = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `/login?redirect=${redirect}`;
          }
        }
      }

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
// AUTH API
// ==========================================

export const authApi = {
  getDemoAccounts: async () => request('/auth/demo-accounts', { method: 'GET' }),
  login: async (credentials: { email: string; password: string }) => {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },
  verifyMfa: async (data: { email: string; token: string }) => {
    return request('/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  refresh: async (refreshToken: string) => {
    return request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  },
  getCapabilities: async () => request('/auth/capabilities'),
  getMe: async () => request('/auth/me'),
};

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

  getAll: async (params?: any) => {
    return patientsApi.list(params);
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

  confirmNKDA: async (patientId: string) => {
    return request('/patients/' + patientId + '/nkda', {
      method: 'POST',
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

  removeDocument: async (patientId: string, documentId: string) => {
    return request('/patients/' + patientId + '/documents/' + documentId, {
      method: 'DELETE',
    });
  },

  uploadDocumentMultipart: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = typeof window !== 'undefined' ? localStorage.getItem('hms_access_token') : null;
    const tenantId = typeof window !== 'undefined' ? localStorage.getItem('hms_tenant_id') : null;
    const branchId = typeof window !== 'undefined' ? localStorage.getItem('hms_selected_branch_id') : null;

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (tenantId) headers['X-Tenant-Id'] = tenantId;
    if (branchId) headers['X-Branch-Id'] = branchId;

    const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1') + '/platform/files/upload-multipart', {
      method: 'POST',
      headers,
      body: formData,
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error?.message || json?.message || 'File upload failed');
    }
    return json;
  },

  downloadDocument: async (fileUrl: string, filename: string, isView: boolean = false) => {
    // If it's a legacy external URL, open directly
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      window.open(fileUrl, '_blank');
      return;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('hms_access_token') : null;
    const tenantId = typeof window !== 'undefined' ? localStorage.getItem('hms_tenant_id') : null;

    const fullUrl = fileUrl.startsWith('http')
      ? fileUrl
      : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1') + fileUrl.replace(/^\/api\/v1/, '');

    const res = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}),
      },
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson?.error?.message || 'Failed to download file');
    }

    const blob = await res.blob();
    const objectUrl = window.URL.createObjectURL(blob);

    if (isView) {
      window.open(objectUrl, '_blank');
    } else {
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    setTimeout(() => window.URL.revokeObjectURL(objectUrl), 10000);
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
// ENCOUNTERS API
// ==========================================

export const encountersApi = {
  create: async (data: any) => request('/encounters', { method: 'POST', body: JSON.stringify(data) }),
  get: async (id: string) => request('/encounters/' + id),
  list: async (params?: any) => {
    const qs = new URLSearchParams(params).toString();
    return request('/encounters' + (qs ? '?' + qs : ''));
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
    const cleanParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== '') cleanParams[key] = val as string;
      });
    }
    const searchParams = new URLSearchParams(cleanParams);
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

  getHospitals: async () => request('/enterprise/hospitals'),
  registerHospital: async (data: any) =>
    request('/enterprise/hospitals', { method: 'POST', body: JSON.stringify(data) }),
  getCrossSiteMetrics: async () => request('/enterprise/cross-site-metrics'),
  getSubscriptions: async () => request('/enterprise/subscriptions'),
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

  getProducts: async (params?: any) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
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

// ==========================================
// IPD (INPATIENT) API
// ==========================================

export const ipdApi = {
  getWards: async () => request('/ipd/wards'),
  createWard: async (data: any) => request('/ipd/wards', { method: 'POST', body: JSON.stringify(data) }),
  getBeds: async (params?: any) => {
    const qs = new URLSearchParams(params).toString();
    return request('/ipd/beds' + (qs ? '?' + qs : ''));
  },
  createBed: async (data: any) => request('/ipd/beds', { method: 'POST', body: JSON.stringify(data) }),
  getBedBoard: async () => request('/ipd/bed-board'),
  updateBedStatus: async (bedId: string, status: string) =>
    request('/ipd/beds/' + bedId + '/status', { method: 'PATCH', body: JSON.stringify({ status }) }),
  getAdmissions: async (params?: any) => {
    const qs = new URLSearchParams(params).toString();
    return request('/ipd/admissions' + (qs ? '?' + qs : ''));
  },
  getAdmission: async (id: string) => request('/ipd/admissions/' + id),
  createAdmission: async (data: any) =>
    request('/ipd/admissions', { method: 'POST', body: JSON.stringify(data) }),
  allocateBed: async (admissionId: string, data: any) =>
    request('/ipd/admissions/' + admissionId + '/allocate-bed', { method: 'POST', body: JSON.stringify(data) }),
  getNursingAssessments: async (admissionId: string) =>
    request('/ipd/admissions/' + admissionId + '/nursing-assessments'),
  createNursingAssessment: async (admissionId: string, data: any) =>
    request('/ipd/admissions/' + admissionId + '/nursing-assessments', { method: 'POST', body: JSON.stringify(data) }),
  getNursingWorklist: async (params?: any) => {
    const qs = new URLSearchParams(params).toString();
    return request('/ipd/nursing-worklist' + (qs ? '?' + qs : ''));
  },
  createNursingNote: async (admissionId: string, data: any) =>
    request('/ipd/admissions/' + admissionId + '/nursing-notes', { method: 'POST', body: JSON.stringify(data) }),
  getIntakeOutput: async (admissionId: string) =>
    request('/ipd/admissions/' + admissionId + '/intake-output'),
  createIntakeOutput: async (admissionId: string, data: any) =>
    request('/ipd/admissions/' + admissionId + '/intake-output', { method: 'POST', body: JSON.stringify(data) }),
  getRounds: async (admissionId: string) =>
    request('/ipd/admissions/' + admissionId + '/rounds'),
  createRound: async (admissionId: string, data: any) =>
    request('/ipd/admissions/' + admissionId + '/rounds', { method: 'POST', body: JSON.stringify(data) }),
  getMedicationOrders: async (admissionId: string) =>
    request('/ipd/admissions/' + admissionId + '/medication-orders'),
  createMedicationOrder: async (admissionId: string, data: any) =>
    request('/ipd/admissions/' + admissionId + '/medication-orders', { method: 'POST', body: JSON.stringify(data) }),
  getMar: async (admissionId: string) =>
    request('/ipd/admissions/' + admissionId + '/mar'),
  administerMar: async (orderId: string, data: any) =>
    request('/ipd/mar/' + orderId + '/administer', { method: 'POST', body: JSON.stringify(data) }),
  transfer: async (admissionId: string, data: any) =>
    request('/ipd/admissions/' + admissionId + '/transfer', { method: 'POST', body: JSON.stringify(data) }),
  getDischargeSummary: async (admissionId: string) =>
    request('/ipd/admissions/' + admissionId + '/discharge-summary'),
  saveDischargeSummary: async (admissionId: string, data: any) =>
    request('/ipd/admissions/' + admissionId + '/discharge-summary', { method: 'POST', body: JSON.stringify(data) }),
  getBillingClearance: async (admissionId: string) =>
    request('/ipd/admissions/' + admissionId + '/billing-clearance'),
  dischargePatient: async (admissionId: string) =>
    request('/ipd/admissions/' + admissionId + '/discharge', { method: 'POST' }),
};

// ==========================================
// ICU API
// ==========================================

export const icuApi = {
  getFlowsheets: async (params?: any) => {
    const qs = new URLSearchParams(params).toString();
    return request('/icu/flowsheets' + (qs ? '?' + qs : ''));
  },
  getFlowsheet: async (id: string) => request('/icu/flowsheets/' + id),
  createFlowsheet: async (data: any) =>
    request('/icu/flowsheets', { method: 'POST', body: JSON.stringify(data) }),
  getActivePatients: async () => request('/icu/active-patients'),
};

// ==========================================
// OT (OPERATING THEATRE) API
// ==========================================

export const otApi = {
  getTheatres: async () => request('/ot/theatres'),
  createTheatre: async (data: any) =>
    request('/ot/theatres', { method: 'POST', body: JSON.stringify(data) }),
  updateTheatreStatus: async (id: string, status: string) =>
    request('/ot/theatres/' + id + '/status', { method: 'PATCH', body: JSON.stringify({ status }) }),
  getRequests: async (params?: any) => {
    const qs = new URLSearchParams(params).toString();
    return request('/ot/requests' + (qs ? '?' + qs : ''));
  },
  createRequest: async (data: any) =>
    request('/ot/requests', { method: 'POST', body: JSON.stringify(data) }),
  getSchedules: async (params?: any) => {
    const qs = new URLSearchParams(params).toString();
    return request('/ot/schedules' + (qs ? '?' + qs : ''));
  },
  createSchedule: async (data: any) =>
    request('/ot/schedules', { method: 'POST', body: JSON.stringify(data) }),
  updateScheduleStatus: async (id: string, status: string) =>
    request('/ot/schedules/' + id + '/status', { method: 'PATCH', body: JSON.stringify({ status }) }),
  addTeamMember: async (scheduleId: string, data: any) =>
    request('/ot/schedules/' + scheduleId + '/team', { method: 'POST', body: JSON.stringify(data) }),
  removeTeamMember: async (scheduleId: string, memberId: string) =>
    request('/ot/schedules/' + scheduleId + '/team/' + memberId, { method: 'DELETE' }),
  submitWhoChecklist: async (scheduleId: string, data: any) =>
    request('/ot/schedules/' + scheduleId + '/who-checklist', { method: 'POST', body: JSON.stringify(data) }),
  addProcedureNote: async (scheduleId: string, data: any) =>
    request('/ot/schedules/' + scheduleId + '/notes', { method: 'POST', body: JSON.stringify(data) }),
  addImplant: async (scheduleId: string, data: any) =>
    request('/ot/schedules/' + scheduleId + '/implants', { method: 'POST', body: JSON.stringify(data) }),
};

// ==========================================
// BLOOD BANK API
// ==========================================

export const bloodBankApi = {
  getDonors: async (params?: any) => {
    const qs = new URLSearchParams(params).toString();
    return request('/bloodbank/donors' + (qs ? '?' + qs : ''));
  },
  createDonor: async (data: any) =>
    request('/bloodbank/donors', { method: 'POST', body: JSON.stringify(data) }),
  getDonations: async (params?: any) => {
    const qs = new URLSearchParams(params).toString();
    return request('/bloodbank/donations' + (qs ? '?' + qs : ''));
  },
  recordDonation: async (data: any) =>
    request('/bloodbank/donations', { method: 'POST', body: JSON.stringify(data) }),
  processDonation: async (id: string, data: any) =>
    request('/bloodbank/donations/' + id + '/process', { method: 'POST', body: JSON.stringify(data) }),
  getComponents: async (params?: any) => {
    const qs = new URLSearchParams(params).toString();
    return request('/bloodbank/components' + (qs ? '?' + qs : ''));
  },
  getInventorySummary: async () => request('/bloodbank/inventory-summary'),
  crossmatchCheck: async (data: any) =>
    request('/bloodbank/crossmatch-check', { method: 'POST', body: JSON.stringify(data) }),
  issueBlood: async (data: any) =>
    request('/bloodbank/issues', { method: 'POST', body: JSON.stringify(data) }),
  updateTransfusion: async (issueId: string, transfusionStatus: string) =>
    request('/bloodbank/issues/' + issueId + '/transfusion', {
      method: 'PATCH',
      body: JSON.stringify({ transfusionStatus }),
    }),
  getIssues: async (params?: any) => {
    const qs = new URLSearchParams(params).toString();
    return request('/bloodbank/issues' + (qs ? '?' + qs : ''));
  },
};

// ==========================================
// CSSD API
// ==========================================

export const cssdApi = {
  getCycles: async (params?: any) => {
    const qs = new URLSearchParams(params).toString();
    return request('/cssd/cycles' + (qs ? '?' + qs : ''));
  },
  getCycle: async (id: string) => request('/cssd/cycles/' + id),
  createCycle: async (data: any) =>
    request('/cssd/cycles', { method: 'POST', body: JSON.stringify(data) }),
  completeCycle: async (id: string, data: any) =>
    request('/cssd/cycles/' + id + '/complete', { method: 'POST', body: JSON.stringify(data) }),
  getStats: async () => request('/cssd/stats'),
};

// ==========================================
// DIETARY API
// ==========================================

export const dietaryApi = {
  getDietTypes: async () => request('/dietary/diet-types'),
  createDietType: async (data: any) =>
    request('/dietary/diet-types', { method: 'POST', body: JSON.stringify(data) }),
  getOrders: async (params?: any) => {
    const qs = new URLSearchParams(params).toString();
    return request('/dietary/orders' + (qs ? '?' + qs : ''));
  },
  createOrder: async (data: any) =>
    request('/dietary/orders', { method: 'POST', body: JSON.stringify(data) }),
  updateOrderStatus: async (id: string, status: string) =>
    request('/dietary/orders/' + id + '/status', { method: 'PATCH', body: JSON.stringify({ status }) }),
  getKitchenWorklist: async () => request('/dietary/kitchen-worklist'),
};

// ==========================================
// HOUSEKEEPING API
// ==========================================

export const housekeepingApi = {
  getTasks: async (params?: any) => {
    const qs = new URLSearchParams(params).toString();
    return request('/housekeeping/tasks' + (qs ? '?' + qs : ''));
  },
  createTask: async (data: any) =>
    request('/housekeeping/tasks', { method: 'POST', body: JSON.stringify(data) }),
  assignTask: async (id: string, assignedToId: string) =>
    request('/housekeeping/tasks/' + id + '/assign', { method: 'PATCH', body: JSON.stringify({ assignedToId }) }),
  startTask: async (id: string) =>
    request('/housekeeping/tasks/' + id + '/start', { method: 'PATCH' }),
  completeTask: async (id: string) =>
    request('/housekeeping/tasks/' + id + '/complete', { method: 'PATCH' }),
  verifyTask: async (id: string) =>
    request('/housekeeping/tasks/' + id + '/verify', { method: 'PATCH' }),
  getStats: async () => request('/housekeeping/stats'),
};

// ==========================================
// AMBULANCE API
// ==========================================

export const ambulanceApi = {
  getAmbulances: async (params?: any) => {
    const qs = new URLSearchParams(params).toString();
    return request('/ambulance/ambulances' + (qs ? '?' + qs : ''));
  },
  createAmbulance: async (data: any) =>
    request('/ambulance/ambulances', { method: 'POST', body: JSON.stringify(data) }),
  updateAmbulanceStatus: async (id: string, status: string) =>
    request('/ambulance/ambulances/' + id + '/status', { method: 'PATCH', body: JSON.stringify({ status }) }),
  getTrips: async (params?: any) => {
    const qs = new URLSearchParams(params).toString();
    return request('/ambulance/trips' + (qs ? '?' + qs : ''));
  },
  dispatchTrip: async (data: any) =>
    request('/ambulance/trips', { method: 'POST', body: JSON.stringify(data) }),
  updateTripStatus: async (id: string, status: string) =>
    request('/ambulance/trips/' + id + '/status', { method: 'PATCH', body: JSON.stringify({ status }) }),
  getStats: async () => request('/ambulance/stats'),
};

// ==========================================
// PROCUREMENT API
// ==========================================

export const procurementApi = {
  getSuppliers: async () => request('/procurement/suppliers'),
  createSupplier: async (data: any) =>
    request('/procurement/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  getRequests: async () => request('/procurement/requests'),
  createRequest: async (data: any) =>
    request('/procurement/requests', { method: 'POST', body: JSON.stringify(data) }),
  approveRequest: async (id: string, data: any) =>
    request('/procurement/requests/' + id + '/approve', { method: 'PATCH', body: JSON.stringify(data) }),
  getOrders: async () => request('/procurement/orders'),
  createOrder: async (data: any) =>
    request('/procurement/orders', { method: 'POST', body: JSON.stringify(data) }),
  getGoodsReceipts: async () => request('/procurement/goods-receipts'),
  createGoodsReceipt: async (data: any) =>
    request('/procurement/goods-receipts', { method: 'POST', body: JSON.stringify(data) }),
  getMatchSummary: async (poId: string) => request('/procurement/match-summary/' + poId),
};

// ==========================================
// HR & WORKFORCE API
// ==========================================

export const hrApi = {
  getEmployees: async (params?: any) => {
    const qs = new URLSearchParams(params).toString();
    return request('/hr/employees' + (qs ? '?' + qs : ''));
  },
  createEmployee: async (data: any) =>
    request('/hr/employees', { method: 'POST', body: JSON.stringify(data) }),
  getEmployee: async (id: string) => request('/hr/employees/' + id),
  addCredential: async (employeeId: string, data: any) =>
    request('/hr/employees/' + employeeId + '/credentials', { method: 'POST', body: JSON.stringify(data) }),
  getExpiringCredentials: async () => request('/hr/compliance/expiring-credentials'),
  getCredentials: async (params?: any) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request('/hr/compliance/expiring-credentials' + qs);
  },
  recordAttendance: async (data: any) =>
    request('/hr/attendance', { method: 'POST', body: JSON.stringify(data) }),
  getAttendance: async (params?: any) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request('/hr/attendance' + qs);
  },
  logAttendance: async (data: any) =>
    request('/hr/attendance', { method: 'POST', body: JSON.stringify(data) }),
  submitLeave: async (data: any) =>
    request('/hr/leaves', { method: 'POST', body: JSON.stringify(data) }),
  getLeaveRequests: async (params?: any) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request('/hr/leaves' + qs);
  },
  approveLeave: async (id: string, approved: boolean) =>
    request('/hr/leaves/' + id + '/approve', { method: 'PATCH', body: JSON.stringify({ approved }) }),
  reviewLeave: async (id: string, data: any) =>
    request('/hr/leaves/' + id, { method: 'PATCH', body: JSON.stringify(data) }),
  runPayroll: async (data: any) =>
    request('/hr/payroll/run', { method: 'POST', body: JSON.stringify(data) }),
  getPayrollPeriods: async () => request('/hr/payroll/periods'),
  getPayslips: async (params?: any) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request('/hr/payroll/payslips' + qs);
  },
};

// ==========================================
// FINANCE & GENERAL LEDGER API
// ==========================================

export const financeApi = {
  getAccounts: async () => request('/finance/accounts'),
  createAccount: async (data: any) =>
    request('/finance/accounts', { method: 'POST', body: JSON.stringify(data) }),
  getJournals: async () => request('/finance/journals'),
  createJournal: async (data: any) =>
    request('/finance/journals', { method: 'POST', body: JSON.stringify(data) }),
  postJournal: async (data: any) =>
    request('/finance/journals', { method: 'POST', body: JSON.stringify(data) }),
  getTrialBalance: async () => request('/finance/trial-balance'),
  getApArSummary: async () => request('/finance/ap-ar-summary'),
  getAgingSummary: async () => request('/finance/ap-ar-summary'),
};

// ==========================================
// ASSET MANAGEMENT & CMMS API
// ==========================================

export const assetsApi = {
  getAssets: async (params?: any) => {
    const qs = new URLSearchParams(params).toString();
    return request('/assets/assets' + (qs ? '?' + qs : ''));
  },
  createAsset: async (data: any) =>
    request('/assets/assets', { method: 'POST', body: JSON.stringify(data) }),
  getAsset: async (id: string) => request('/assets/assets/' + id),
  getTasks: async (params?: any) => {
    const qs = new URLSearchParams(params).toString();
    return request('/assets/tasks' + (qs ? '?' + qs : ''));
  },
  getMaintenanceTasks: async (params?: any) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request('/assets/tasks' + qs);
  },
  createTask: async (data: any) =>
    request('/assets/tasks', { method: 'POST', body: JSON.stringify(data) }),
  createMaintenanceTask: async (data: any) =>
    request('/assets/tasks', { method: 'POST', body: JSON.stringify(data) }),
  reportBreakdown: async (data: any) =>
    request('/assets/breakdown', { method: 'POST', body: JSON.stringify(data) }),
  assignTask: async (id: string, assignedToId: string) =>
    request('/assets/tasks/' + id + '/assign', { method: 'PATCH', body: JSON.stringify({ assignedToId }) }),
  completeTask: async (id: string, data: any) =>
    request('/assets/tasks/' + id + '/complete', { method: 'PATCH', body: JSON.stringify(data) }),
  completeMaintenanceTask: async (id: string, data: any) =>
    request('/assets/tasks/' + id + '/complete', { method: 'PATCH', body: JSON.stringify(data) }),
};

// ==========================================
// CRM & PATIENT FEEDBACK API
// ==========================================

export const crmApi = {
  getFeedbacks: async (params?: any) => {
    const qs = new URLSearchParams(params).toString();
    return request('/crm/feedback' + (qs ? '?' + qs : ''));
  },
  getFeedback: async (params?: any) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request('/crm/feedback' + qs);
  },
  createFeedback: async (data: any) =>
    request('/crm/feedback', { method: 'POST', body: JSON.stringify(data) }),
  submitFeedback: async (data: any) =>
    request('/crm/feedback', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: async (id: string, data: any) =>
    request('/crm/feedback/' + id + '/status', { method: 'PATCH', body: JSON.stringify(data) }),
  updateFeedbackStatus: async (id: string, data: any) =>
    request('/crm/feedback/' + id + '/status', { method: 'PATCH', body: JSON.stringify(data) }),
  getEscalations: async () => request('/crm/escalations'),
  getAnalytics: async () => request('/crm/analytics'),
};



// ==========================================
// ANALYTICS & MIS API
// ==========================================

export const analyticsApi = {
  getKpis: async () => request('/analytics/kpis'),
  getMisPack: async () => request('/analytics/mis-pack'),
  getTrends: async (days: number = 7) => request('/analytics/trends?days=' + days),
  exportReport: async (data: { reportType: string; format?: string; async?: boolean }) =>
    request('/analytics/export', { method: 'POST', body: JSON.stringify(data) }),
};

// ==========================================
// INTEGRATIONS & INTEROPERABILITY API
// ==========================================

export const integrationsApi = {
  getStatus: async () => request('/integrations/status'),
  generateAbha: async (data: any) =>
    request('/integrations/abdm/generate-abha', { method: 'POST', body: JSON.stringify(data) }),
  verifyAbhaOtp: async (data: any) =>
    request('/integrations/abdm/verify-otp', { method: 'POST', body: JSON.stringify(data) }),
  linkCareContext: async (data: any) =>
    request('/integrations/abdm/link-care-context', { method: 'POST', body: JSON.stringify(data) }),
  getFhirPatient: async (id: string) => request('/integrations/fhir/r4/Patient/' + id),
  getFhirEncounter: async (id: string) => request('/integrations/fhir/r4/Encounter/' + id),
  submitFhirBundle: async (bundle: any) =>
    request('/integrations/fhir/r4/Bundle', { method: 'POST', body: JSON.stringify(bundle) }),
  parseHl7Message: async (message: string) =>
    request('/integrations/hl7/v2/parse', { method: 'POST', body: JSON.stringify({ message }) }),
  generateHl7Adt: async (data: any) =>
    request('/integrations/hl7/v2/generate-adt', { method: 'POST', body: JSON.stringify(data) }),
  feedAnalyzerResults: async (data: any) =>
    request('/integrations/analyzers/feed', { method: 'POST', body: JSON.stringify(data) }),
  createPaymentOrder: async (data: any) =>
    request('/integrations/payments/create-order', { method: 'POST', body: JSON.stringify(data) }),
  verifyPayment: async (data: any) =>
    request('/integrations/payments/verify', { method: 'POST', body: JSON.stringify(data) }),
  logBiometricPunch: async (data: any) =>
    request('/integrations/biometric/punch', { method: 'POST', body: JSON.stringify(data) }),
};

// ==========================================
// PLATFORM SERVICES API (FILES, NOTIFS, IMPORT, PRINT, JOBS)
// ==========================================

export const platformApi = {
  // Files
  getUploadUrl: async (data: { filename: string; mimeType: string; sizeBytes: number }) =>
    request('/platform/files/upload-url', { method: 'POST', body: JSON.stringify(data) }),
  uploadFileDirect: async (data: { filename: string; mimeType: string; content: string }) =>
    request('/platform/files/upload', { method: 'POST', body: JSON.stringify(data) }),
  getDownloadUrl: async (key: string) => request('/platform/files/download-url?key=' + encodeURIComponent(key)),

  // Notifications
  sendNotification: async (data: any) =>
    request('/platform/notifications/send', { method: 'POST', body: JSON.stringify(data) }),
  getNotifications: async (params?: { recipientId?: string; unreadOnly?: boolean }) => {
    const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request('/platform/notifications' + qs);
  },
  getUnreadCount: async () => request('/platform/notifications/unread-count'),
  markNotificationRead: async (id: string) =>
    request('/platform/notifications/' + id + '/read', { method: 'PUT' }),
  getSimulatorOutbox: async () => request('/platform/notifications/simulator-outbox'),

  // CSV Import
  validateCsv: async (domain: string, csvContent: string) =>
    request('/platform/import/validate', { method: 'POST', body: JSON.stringify({ domain, csvContent }) }),
  commitCsv: async (domain: string, csvContent: string, hospitalId?: string) =>
    request('/platform/import/commit', { method: 'POST', body: JSON.stringify({ domain, csvContent, hospitalId }) }),

  // Print & PDF
  getPrintTemplates: async () => request('/platform/print/templates'),
  generatePdf: async (data: { template: string; hospitalName?: string; data: any; returnFormat?: string }) =>
    request('/platform/print/generate', { method: 'POST', body: JSON.stringify(data) }),

  // Worker Jobs
  enqueueJob: async (jobType: string, payload: any) =>
    request('/platform/jobs/enqueue', { method: 'POST', body: JSON.stringify({ jobType, payload }) }),
  getJobStatus: async (id: string) => request('/platform/jobs/' + id),
  listJobs: async () => request('/platform/jobs'),

  // Sidebar Badges (Real Database Metrics)
  getSidebarBadges: async () => request('/platform/sidebar-badges'),
};

export const platformServiceApi = platformApi;

// ==========================================
// CORE USERS & HOSPITALS API
// ==========================================

export const userApi = {
  getUsers: async () => request('/users'),
};

export const hospitalsApi = {
  getHospitals: async () => request('/hospitals'),
};

export const branchesApi = {
  getBranches: async () => request('/branches'),
  getAllowedBranches: async () => request('/branches/allowed'),
};



