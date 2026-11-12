import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolate all filesystem state in an ephemeral temp directory before importing server modules
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cliniccare-api-test-'));
process.env.CLINICCARE_DATA_DIR = path.join(tempRoot, 'data');
process.env.CLINICCARE_UPLOADS_DIR = path.join(tempRoot, 'uploads');
process.env.NODE_ENV = 'production';
process.env.ALLOW_DEV_TOKENS = 'false';
process.env.VERCEL = '';
process.env.SESSION_SECRET = 'integration-test-secret-0123456789';
process.env.CLINIC_TIMEZONE = 'Asia/Kolkata';
process.env.CLINICCARE_USE_LOCAL_DB = 'true';

const { default: app } = await import('../../api/index.js');

const ONE_PIXEL_PNG_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

let server;
let baseUrl;

const apiRequest = async (urlPath, { method = 'GET', token = null, body = undefined, headers = {} } = {}) => {
  const reqHeaders = { ...headers };
  if (token) {
    reqHeaders.Authorization = `Bearer ${token}`;
  }
  let payload;
  if (body !== undefined && !(body instanceof FormData)) {
    reqHeaders['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  } else if (body instanceof FormData) {
    payload = body;
  }

  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: reqHeaders,
    body: payload
  });

  const contentType = res.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = Buffer.from(await res.arrayBuffer());
  }

  return { status: res.status, headers: res.headers, data };
};

const getUpcomingWeekdayDate = (targetUtcDay) => {
  const dt = new Date();
  // Jump ahead at least 1 day so the date is always strictly >= today in IST
  for (let i = 1; i <= 14; i++) {
    const candidate = new Date(dt.getTime() + i * 86400000);
    const iso = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(candidate);
    const [y, m, d] = iso.split('-').map(Number);
    const utcDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (utcDay === targetUtcDay) {
      return iso;
    }
  }
  throw new Error(`Could not find upcoming weekday ${targetUtcDay}`);
};

describe('ClinicCare End-to-End API Integration Suite', () => {
  let doctorToken;
  let receptionistToken;
  let createdStaffId;
  let patient2Id;
  let appointmentId;
  let appointmentDate;
  let prescription2Id;
  let uploadedFilename;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  test('Health check responds with healthy status', async () => {
    const res = await apiRequest('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.data.status, 'healthy');
  });

  test('Rejects dev, mock, and unsigned base64 tokens in production mode', async () => {
    const devRes = await apiRequest('/api/auth/me', { token: 'dev-doctor-token' });
    assert.equal(devRes.status, 401);

    const mockRes = await apiRequest('/api/auth/me', { token: 'mock-doctor-123' });
    assert.equal(mockRes.status, 401);

    const unsignedPayload = Buffer.from(
      JSON.stringify({ uid: 'forged', email: 'doctor@cliniccare.com', role: 'doctor', clinicId: 'clinic-default' })
    ).toString('base64');
    const unsignedRes = await apiRequest('/api/auth/me', { token: unsignedPayload });
    assert.equal(unsignedRes.status, 401);
  });

  test('Rejects wrong credentials and wildcard role-matched emails', async () => {
    const badPass = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'doctor@cliniccare.com', password: 'wrong-password' }
    });
    assert.equal(badPass.status, 401);

    const wildcardEmail = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'random.doctor.attacker@gmail.com', password: 'Doctor@123' }
    });
    assert.equal(wildcardEmail.status, 401);
  });

  test('Logs in doctor & receptionist cleanly and strips passwordHash from auth endpoints', async () => {
    const docLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'doctor@cliniccare.com', password: 'Doctor@123' }
    });
    assert.equal(docLogin.status, 200);
    assert.ok(docLogin.data.token);
    assert.equal(docLogin.data.user.role, 'doctor');
    assert.equal(docLogin.data.user.passwordHash, undefined);
    doctorToken = docLogin.data.token;

    const recLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'reception@cliniccare.com', password: 'Staff@123' }
    });
    assert.equal(recLogin.status, 200);
    assert.ok(recLogin.data.token);
    assert.equal(recLogin.data.user.role, 'receptionist');
    assert.equal(recLogin.data.user.passwordHash, undefined);
    receptionistToken = recLogin.data.token;

    const meRes = await apiRequest('/api/auth/me', { token: doctorToken });
    assert.equal(meRes.status, 200);
    assert.equal(meRes.data.user.passwordHash, undefined);
    assert.equal(meRes.data.user.email, 'doctor@cliniccare.com');
  });

  test('Enforces RBAC and strips passwordHash on staff creation & status toggle', async () => {
    const recBillingReport = await apiRequest('/api/billing/reports', { token: receptionistToken });
    assert.equal(recBillingReport.status, 403);

    const recStaffList = await apiRequest('/api/auth/staff', { token: receptionistToken });
    assert.equal(recStaffList.status, 403);

    const createStaffRes = await apiRequest('/api/auth/staff', {
      method: 'POST',
      token: doctorToken,
      body: {
        name: 'Nurse Kavita Rao',
        email: 'kavita@cliniccare.com',
        phone: '9822011122',
        role: 'receptionist',
        password: 'password123'
      }
    });
    assert.equal(createStaffRes.status, 201);
    assert.equal(createStaffRes.data.passwordHash, undefined);
    createdStaffId = createStaffRes.data.id;

    const toggleRes = await apiRequest(`/api/auth/staff/${createdStaffId}/status`, {
      method: 'PATCH',
      token: doctorToken,
      body: { status: 'inactive' }
    });
    assert.equal(toggleRes.status, 200);
    assert.equal(toggleRes.data.status, 'inactive');
    assert.equal(toggleRes.data.passwordHash, undefined);

    const listStaffRes = await apiRequest('/api/auth/staff', { token: doctorToken });
    assert.equal(listStaffRes.status, 200);
    for (const s of listStaffRes.data) {
      assert.equal(s.passwordHash, undefined);
    }
  });

  test('Patient registration validates input and keeps CC-YYYY-XXXX sequential after deletion', async () => {
    const p1 = await apiRequest('/api/patients', {
      method: 'POST',
      token: receptionistToken,
      body: {
        fullName: 'Aarav Sharma',
        mobileNumber: '9823012345',
        age: 34,
        gender: 'Male',
        allergies: 'Penicillin'
      }
    });
    assert.equal(p1.status, 201);
    assert.match(p1.data.patientId, /^CC-\d{4}-\d{4}$/);

    const invalidPatient = await apiRequest('/api/patients', {
      method: 'POST',
      token: receptionistToken,
      body: {
        fullName: 'Invalid Phone User',
        mobileNumber: '12345',
        age: 30,
        gender: 'Male'
      }
    });
    assert.equal(invalidPatient.status, 400);

    const p2 = await apiRequest('/api/patients', {
      method: 'POST',
      token: receptionistToken,
      body: {
        fullName: 'Meera Patil',
        mobileNumber: '9823054321',
        age: 29,
        gender: 'Female'
      }
    });
    assert.equal(p2.status, 201);
    patient2Id = p2.data.id;
    const p2Seq = Number(p2.data.patientId.split('-')[2]);

    const del1 = await apiRequest(`/api/patients/${p1.data.id}`, {
      method: 'DELETE',
      token: doctorToken
    });
    assert.equal(del1.status, 200);

    const p3 = await apiRequest('/api/patients', {
      method: 'POST',
      token: receptionistToken,
      body: {
        fullName: 'Vikram Joshi',
        mobileNumber: '9823099988',
        age: 42,
        gender: 'Male'
      }
    });
    assert.equal(p3.status, 201);
    const p3Seq = Number(p3.data.patientId.split('-')[2]);
    assert.ok(p3Seq > p2Seq, `Expected ${p3.data.patientId} > ${p2.data.patientId}`);
  });

  test('Slots honor Sunday closure, prevent double-booking (409), and support walk-in & public booking', async () => {
    const sundayStr = getUpcomingWeekdayDate(0);
    const mondayStr = getUpcomingWeekdayDate(1);
    appointmentDate = mondayStr;

    const sunSlots = await apiRequest(`/api/appointments/slots?date=${sundayStr}`);
    assert.equal(sunSlots.status, 200);
    assert.equal(sunSlots.data.isClosed, true);

    const monSlots = await apiRequest(`/api/appointments/slots?date=${mondayStr}`);
    assert.equal(monSlots.status, 200);
    assert.equal(monSlots.data.isClosed, false);
    const openSlots = (monSlots.data.slots || []).filter((s) => s.isAvailable);
    assert.ok(openSlots.length >= 2);

    const firstSlot = openSlots[0].time;
    const book1 = await apiRequest('/api/appointments', {
      method: 'POST',
      token: receptionistToken,
      body: {
        patientId: patient2Id,
        date: mondayStr,
        timeSlot: firstSlot,
        reason: 'Fever and body ache'
      }
    });
    assert.equal(book1.status, 201);
    appointmentId = book1.data.id;

    const conflict = await apiRequest('/api/appointments', {
      method: 'POST',
      token: receptionistToken,
      body: {
        patientId: patient2Id,
        date: mondayStr,
        timeSlot: firstSlot,
        reason: 'Duplicate slot'
      }
    });
    assert.equal(conflict.status, 409);

    const walkIn = await apiRequest('/api/appointments', {
      method: 'POST',
      token: receptionistToken,
      body: {
        isWalkIn: true,
        patientName: 'Suresh Kulkarni',
        patientPhone: '9811122233',
        date: mondayStr,
        timeSlot: openSlots[1].time,
        reason: 'Walk-in BP check'
      }
    });
    assert.equal(walkIn.status, 201);

    const secondMonday = openSlots.length > 2 ? openSlots[2].time : '17:00';
    const pubBook = await apiRequest('/api/appointments/public', {
      method: 'POST',
      body: {
        fullName: 'Priya Nair',
        mobileNumber: '+91 9822334455',
        age: 31,
        gender: 'Female',
        date: mondayStr,
        timeSlot: secondMonday,
        reason: 'Routine checkup'
      }
    });
    assert.equal(pubBook.status, 201);
  });

  test('Consultation auto-completes linked appointment and creates follow-up record', async () => {
    const consultRes = await apiRequest('/api/consultations', {
      method: 'POST',
      token: doctorToken,
      body: {
        patientId: patient2Id,
        appointmentId,
        chiefComplaint: 'High fever',
        diagnosis: 'Viral Pyrexia',
        vitals: { bp: '120/80', pulse: '84', temp: '100.4', weight: '62' },
        followUpDate: getUpcomingWeekdayDate(3)
      }
    });
    assert.equal(consultRes.status, 201);

    const apptsRes = await apiRequest(`/api/appointments?date=${appointmentDate}`, { token: doctorToken });
    assert.equal(apptsRes.status, 200);
    const updatedAppt = apptsRes.data.find((a) => a.id === appointmentId);
    assert.equal(updatedAppt?.status, 'completed');

    const followUpsRes = await apiRequest('/api/followups', { token: doctorToken });
    assert.equal(followUpsRes.status, 200);
    assert.ok(Array.isArray(followUpsRes.data.followUps));
    assert.ok(followUpsRes.data.followUps.some((f) => f.patientId === patient2Id));
  });

  test('Prescriptions generate non-colliding RX numbers and track revision versions', async () => {
    const rx1 = await apiRequest('/api/prescriptions', {
      method: 'POST',
      token: doctorToken,
      body: {
        patientId: patient2Id,
        diagnosis: 'Viral Pyrexia',
        medicines: [{ name: 'Paracetamol 650mg', dosage: '1-0-1', duration: '3 days', instructions: 'After food' }]
      }
    });
    assert.equal(rx1.status, 201);
    assert.match(rx1.data.rxNumber, /^RX-\d{4}-\d{5}$/);
    const rx1Seq = Number(rx1.data.rxNumber.split('-')[2]);

    const rx2 = await apiRequest('/api/prescriptions', {
      method: 'POST',
      token: doctorToken,
      body: {
        patientId: patient2Id,
        diagnosis: 'URTI',
        medicines: [{ name: 'Azithromycin 500mg', dosage: '1-0-0', duration: '3 days', instructions: 'After food' }]
      }
    });
    assert.equal(rx2.status, 201);
    prescription2Id = rx2.data.id;
    const rx2Seq = Number(rx2.data.rxNumber.split('-')[2]);
    assert.ok(rx2Seq > rx1Seq);

    const updateRx = await apiRequest(`/api/prescriptions/${prescription2Id}`, {
      method: 'PUT',
      token: doctorToken,
      body: {
        diagnosis: 'URTI with mild cough',
        medicines: [
          { name: 'Azithromycin 500mg', dosage: '1-0-0', duration: '3 days', instructions: 'After food' },
          { name: 'Dextromethorphan Syrup', dosage: '5ml TDS', duration: '5 days', instructions: 'After food' }
        ]
      }
    });
    assert.equal(updateRx.status, 200);
    assert.ok(Number(updateRx.data.version) >= 2);
  });

  test('Billing honors Rs. 0 consultation fee, settles partial payments, and serves reports', async () => {
    const freeBill = await apiRequest('/api/billing', {
      method: 'POST',
      token: doctorToken,
      body: {
        patientId: patient2Id,
        consultationFee: 0,
        additionalCharges: [],
        paidAmount: 0,
        paymentMethod: 'cash'
      }
    });
    assert.equal(freeBill.status, 201);
    assert.equal(freeBill.data.totalAmount, 0);
    assert.equal(freeBill.data.paymentStatus, 'paid');

    const partialBill = await apiRequest('/api/billing', {
      method: 'POST',
      token: doctorToken,
      body: {
        patientId: patient2Id,
        consultationFee: 0,
        additionalCharges: [{ name: 'Nebulization', amount: 20000 }],
        paidAmount: 10000,
        paymentMethod: 'upi'
      }
    });
    assert.equal(partialBill.status, 201);
    assert.equal(partialBill.data.consultationFee, 0);
    assert.equal(partialBill.data.totalAmount, 20000);
    assert.equal(partialBill.data.paymentStatus, 'partially_paid');

    const payRest = await apiRequest(`/api/billing/${partialBill.data.id}/payment`, {
      method: 'PATCH',
      token: receptionistToken,
      body: {
        amount: 10000,
        paymentMethod: 'cash'
      }
    });
    assert.equal(payRest.status, 200);
    assert.equal(payRest.data.paymentStatus, 'paid');
    assert.equal(payRest.data.pendingAmount, 0);

    const reports = await apiRequest('/api/billing/reports', { token: doctorToken });
    assert.equal(reports.status, 200);
    assert.ok(reports.data.today.totalCollected >= 20000);
    assert.ok(reports.data.month.collected >= 20000);
  });

  test('Document upload stores base64 camera capture and serves bytes from /api/documents/file/:filename', async () => {
    const uploadRes = await apiRequest('/api/documents/upload', {
      method: 'POST',
      token: receptionistToken,
      body: {
        patientId: patient2Id,
        category: 'prescription',
        title: 'Previous Clinic Slip',
        imageBase64: ONE_PIXEL_PNG_BASE64
      }
    });
    assert.equal(uploadRes.status, 201);
    assert.ok(uploadRes.data.fileUrl || uploadRes.data.fileName);

    const fileUrl = uploadRes.data.fileUrl || `/api/documents/file/${uploadRes.data.fileName}`;
    uploadedFilename = fileUrl.split('/').pop();
    const fetchFileRes = await apiRequest(`/api/documents/file/${uploadedFilename}`);
    assert.equal(fetchFileRes.status, 200);
    assert.ok(Buffer.isBuffer(fetchFileRes.data));
    assert.ok(fetchFileRes.data.length > 0);
  });
});

