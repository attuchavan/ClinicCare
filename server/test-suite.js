import app from './src/app.js';
import http from 'http';

const runTests = async () => {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(5099, resolve));
  const baseUrl = 'http://localhost:5099/api';

  console.log('🚀 Starting ClinicCare End-to-End API Integration Test Suite...');
  let passed = 0;
  let failed = 0;

  const assert = (condition, testName) => {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  };

  try {
    // 1. Health Check
    const healthRes = await fetch(`${baseUrl}/health`).then(r => r.json());
    assert(healthRes.status === 'healthy', 'Health check returns healthy status');

    // 2. Doctor Login
    const docLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'doctor@cliniccare.com', password: 'Doctor@123' })
    }).then(r => r.json());
    assert(docLogin.token && docLogin.user?.role === 'doctor', 'Doctor authentication succeeds with token');
    const doctorToken = docLogin.token;

    // 3. Receptionist Login
    const recLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'reception@cliniccare.com', password: 'Staff@123' })
    }).then(r => r.json());
    assert(recLogin.token && recLogin.user?.role === 'receptionist', 'Receptionist authentication succeeds');
    const receptionistToken = recLogin.token;

    // 4. Register Patient
    const testPatient = {
      fullName: 'Aarav Deshmukh',
      mobileNumber: '9822012345',
      dateOfBirth: '1985-06-15',
      gender: 'Male',
      bloodGroup: 'B+',
      allergies: 'Penicillin allergy',
      medicalHistory: 'Mild hypertension'
    };
    const regRes = await fetch(`${baseUrl}/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${receptionistToken}`
      },
      body: JSON.stringify(testPatient)
    }).then(r => r.json());
    assert(regRes.id && regRes.patientId.startsWith('CC-'), `Patient registered with sequential ID: ${regRes.patientId}`);
    const patientId = regRes.id;

    // 5. Duplicate Detection
    const dupCheck = await fetch(`${baseUrl}/patients/check-duplicate?mobileNumber=9822012345`, {
      headers: { 'Authorization': `Bearer ${receptionistToken}` }
    }).then(r => r.json());
    assert(dupCheck.hasDuplicate === true && dupCheck.duplicates.length > 0, 'Duplicate phone detection flags existing patient');

    // 6. Slot Calculation
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    const slotsRes = await fetch(`${baseUrl}/appointments/slots?date=${tomorrowStr}`).then(r => r.json());
    assert(Array.isArray(slotsRes.slots) && slotsRes.slots.length > 0, 'Dynamic slot generator returns available appointment slots');
    const targetSlot = slotsRes.slots.find(s => s.isAvailable)?.time || '10:00';

    // 7. Book Appointment
    const bookRes = await fetch(`${baseUrl}/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${receptionistToken}`
      },
      body: JSON.stringify({
        patientId,
        date: tomorrowStr,
        timeSlot: targetSlot,
        reason: 'Fever and throat irritation'
      })
    }).then(r => r.json());
    assert(bookRes.id && bookRes.status === 'confirmed', `Appointment booked safely for slot ${targetSlot}`);
    const appointmentId = bookRes.id;

    // 8. Concurrency / Collision Prevention Test
    const collisionRes = await fetch(`${baseUrl}/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${receptionistToken}`
      },
      body: JSON.stringify({
        patientId,
        date: tomorrowStr,
        timeSlot: targetSlot,
        reason: 'Duplicate slot attempt'
      })
    });
    assert(collisionRes.status === 409, 'Double-booking collision is safely prevented with 409 Conflict');

    // 9. Check-in Patient
    const checkinRes = await fetch(`${baseUrl}/appointments/${appointmentId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${receptionistToken}`
      },
      body: JSON.stringify({ status: 'checked-in' })
    }).then(r => r.json());
    assert(checkinRes.status === 'checked-in', 'Patient successfully checked into waiting room');

    // 10. Receptionist Privilege Escalation Defense: Consultation creation blocked
    const illegalConsultRes = await fetch(`${baseUrl}/consultations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${receptionistToken}`
      },
      body: JSON.stringify({
        patientId,
        diagnosis: 'Illegal diagnosis attempt by receptionist'
      })
    });
    assert(illegalConsultRes.status === 403, 'RBAC blocks receptionist from creating clinical consultations (403 Forbidden)');

    // 11. Doctor Clinical Consultation
    const consultRes = await fetch(`${baseUrl}/consultations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${doctorToken}`
      },
      body: JSON.stringify({
        patientId,
        appointmentId,
        vitals: { bp: '124/82', pulse: '76', temp: '99.2', spo2: '98', weight: '71' },
        symptoms: 'Acute dry cough, sore throat since 3 days',
        examinationFindings: 'Mild pharyngeal erythema, chest clear',
        diagnosis: 'Acute Upper Respiratory Tract Infection (URTI)',
        treatmentNotes: 'Symptomatic oral therapy, warm gargles',
        doctorAdvice: 'Drink plenty of warm water. Avoid dust exposure.',
        followUpDate: tomorrowStr
      })
    }).then(r => r.json());
    assert(consultRes.id && consultRes.diagnosis.includes('URTI'), 'Doctor records clinical consultation with full vitals');
    const consultationId = consultRes.id;

    // 12. Create Digital Prescription
    const rxRes = await fetch(`${baseUrl}/prescriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${doctorToken}`
      },
      body: JSON.stringify({
        patientId,
        consultationId,
        diagnosis: consultRes.diagnosis,
        medicines: [
          { name: 'Paracetamol', strength: '650 mg', dosage: '1 Tab', route: 'Oral', frequency: '1-0-1', duration: '3 days', instructions: 'After food' },
          { name: 'Cetirizine', strength: '10 mg', dosage: '1 Tab', route: 'Oral', frequency: '0-0-1', duration: '5 days', instructions: 'At bedtime' }
        ],
        generalAdvice: 'Complete medication course. Steam inhalation BD.',
        followUpDate: tomorrowStr,
        status: 'approved'
      })
    }).then(r => r.json());
    assert(rxRes.id && rxRes.rxNumber.startsWith('RX-') && rxRes.version === 1, `Digital prescription generated with RX#: ${rxRes.rxNumber}`);
    const rxId = rxRes.id;

    // 13. Immutable Revision History Preservation
    const revisedRx = await fetch(`${baseUrl}/prescriptions/${rxId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${doctorToken}`
      },
      body: JSON.stringify({
        medicines: [
          { name: 'Paracetamol', strength: '650 mg', dosage: '1 Tab', route: 'Oral', frequency: '1-1-1', duration: '3 days', instructions: 'After food' }
        ],
        reasonForCorrection: 'Adjusted frequency due to fever spikes'
      })
    }).then(r => r.json());
    assert(revisedRx.version === 2 && revisedRx.revisionHistory.length === 1, 'Prescription update preserves past version in immutable revision history');

    // 14. Medical Timeline Aggregation
    const timelineRes = await fetch(`${baseUrl}/patients/${patientId}/timeline?filter=all`, {
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    }).then(r => r.json());
    assert(Array.isArray(timelineRes.timeline) && timelineRes.timeline.length >= 3, 'Patient medical timeline aggregates registrations, consultations, and prescriptions');

    // 15. Create Bill & Collect Payment (in Paise)
    const billRes = await fetch(`${baseUrl}/billing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${receptionistToken}`
      },
      body: JSON.stringify({
        patientId,
        consultationFee: 50000, // 500.00 INR in paise
        additionalCharges: [{ item: 'Nebulization', amount: 15000 }], // 150.00 INR
        paidAmount: 65000, // 650.00 INR paid in full
        paymentMethod: 'upi'
      })
    }).then(r => r.json());
    assert(billRes.id && billRes.totalAmount === 65000 && billRes.paymentStatus === 'paid', `Official receipt created with receipt #: ${billRes.receiptNumber}`);

    // 16. Financial Intelligence Reports
    const repRes = await fetch(`${baseUrl}/billing/reports`, {
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    }).then(r => r.json());
    assert(repRes.today?.totalCollected >= 65000, 'Daily collections report correctly calculates UPI & cash totals in paise');

    // 17. OCR Transcription Endpoint
    const ocrRes = await fetch(`${baseUrl}/ocr/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${doctorToken}`
      },
      body: JSON.stringify({ documentId: 'test-doc' })
    }).then(r => r.json());
    assert(ocrRes.verificationStatus === 'unverified' && ocrRes.candidateMedicines?.length > 0, 'OCR module parses candidate medicines under unverified status');

    console.log(`\n====================================================`);
    console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`);
    console.log(`====================================================\n`);

  } catch (err) {
    console.error('Fatal test execution error:', err);
    failed++;
  } finally {
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
};

runTests();

