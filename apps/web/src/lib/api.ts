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
