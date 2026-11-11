const API_BASE = import.meta.env.VITE_API_URL || '/api';

const request = async (endpoint, options = {}) => {
  const token = localStorage.getItem('cliniccare_token');
  const headers = {
    ...options.headers
  };

  // Do not set Content-Type for FormData (file uploads)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers
    });
  } catch (networkErr) {
    const err = new Error('Unable to connect to the ClinicCare backend server (port 5000). Please start the server.');
    err.cause = networkErr;
    throw err;
  }

  const contentType = response.headers.get('content-type');
  let data = null;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = data?.error || (typeof data === 'string' ? data : 'API Request failed');
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

export const api = {
  // Auth endpoints
  auth: {
    login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    resetPassword: (email) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email }) }),
    getMe: () => request('/auth/me'),
    getStaff: () => request('/auth/staff'),
    createStaff: (staffData) => request('/auth/staff', { method: 'POST', body: JSON.stringify(staffData) }),
    toggleStaffStatus: (id, status) => request(`/auth/staff/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
  },

  // Clinic profile
  clinic: {
    get: (clinicId) => request(`/clinic${clinicId ? `?clinicId=${clinicId}` : ''}`),
    update: (updates) => request('/clinic', { method: 'PUT', body: JSON.stringify(updates) })
  },

  // Patients
  patients: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/patients${q ? `?${q}` : ''}`);
    },
    get: (id) => request(`/patients/${id}`),
    checkDuplicate: (params) => {
      const q = new URLSearchParams(params).toString();
      return request(`/patients/check-duplicate?${q}`);
    },
    register: (data) => request('/patients', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/patients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    archive: (id) => request(`/patients/${id}`, { method: 'DELETE' }),
    getTimeline: (id, filter = 'all') => request(`/patients/${id}/timeline?filter=${filter}`)
  },

  // Appointments
  appointments: {
    getSlots: (date, clinicId) => {
      const q = new URLSearchParams({ date, ...(clinicId && { clinicId }) }).toString();
      return request(`/appointments/slots?${q}`);
    },
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/appointments${q ? `?${q}` : ''}`);
    },
    book: (data) => request('/appointments', { method: 'POST', body: JSON.stringify(data) }),
    publicBook: (data) => request('/appointments/public', { method: 'POST', body: JSON.stringify(data) }),
    updateStatus: (id, status) => request(`/appointments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    reschedule: (id, data) => request(`/appointments/${id}/reschedule`, { method: 'PUT', body: JSON.stringify(data) }),
    cancel: (id, reason) => request(`/appointments/${id}`, { method: 'DELETE', body: JSON.stringify({ reason }) })
  },

  // Consultations
  consultations: {
    getByPatient: (patientId) => request(`/consultations/patient/${patientId}`),
    get: (id) => request(`/consultations/${id}`),
    create: (data) => request('/consultations', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/consultations/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  },

  // Prescriptions
  prescriptions: {
    getByPatient: (patientId) => request(`/prescriptions/patient/${patientId}`),
    get: (id) => request(`/prescriptions/${id}`),
    create: (data) => request('/prescriptions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/prescriptions/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  },

  // Documents
  documents: {
    getByPatient: (patientId, params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/documents/patient/${patientId}${q ? `?${q}` : ''}`);
    },
    getPreviousPrescriptions: (patientId) => request(`/documents/patient/${patientId}/previous-prescriptions`),
    upload: (formDataOrJson) => {
      if (formDataOrJson instanceof FormData) {
        return request('/documents/upload', { method: 'POST', body: formDataOrJson });
      }
      return request('/documents/upload', { method: 'POST', body: JSON.stringify(formDataOrJson) });
    },
    saveManualPrescription: (data) => request('/documents/manual-prescription', { method: 'POST', body: JSON.stringify(data) }),
    archive: (id) => request(`/documents/${id}`, { method: 'DELETE' })
  },

  // Billing
  billing: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/billing${q ? `?${q}` : ''}`);
    },
    get: (id) => request(`/billing/${id}`),
    create: (data) => request('/billing', { method: 'POST', body: JSON.stringify(data) }),
    recordPayment: (id, data) => request(`/billing/${id}/payment`, { method: 'PATCH', body: JSON.stringify(data) }),
    getReports: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/billing/reports${q ? `?${q}` : ''}`);
    }
  },

  // Follow-ups
  followUps: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/followups${q ? `?${q}` : ''}`);
    },
    updateStatus: (id, status, notes) => request(`/followups/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, notes }) })
  },

  // Notifications
  notifications: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/notifications${q ? `?${q}` : ''}`);
    },
    send: (data) => request('/notifications/send', { method: 'POST', body: JSON.stringify(data) })
  },

  // OCR
  ocr: {
    transcribe: (data) => request('/ocr/transcribe', { method: 'POST', body: JSON.stringify(data) }),
    verify: (data) => request('/ocr/verify', { method: 'POST', body: JSON.stringify(data) })
  }
};

