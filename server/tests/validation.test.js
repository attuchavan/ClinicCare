import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeMobile,
  validateMobile,
  validateFullName,
  validateAge,
  validateDateOfBirth,
  validateNotPastDate,
  validateRequiredText,
  validateEmail,
  validatePassword,
  validateClinicPhone,
  validateAmount,
  validateVitalField
} from '../../client/src/utils/validators.js';

import {
  normalizePhoneInput,
  validate,
  patientValidationRules,
  appointmentValidationRules,
  consultationValidationRules,
  prescriptionValidationRules,
  billingValidationRules,
  clinicValidationRules,
  documentValidationRules,
  followUpValidationRules,
  authValidationRules
} from '../src/middleware/validationMiddleware.js';

const runValidationMiddleware = async (rules, { body = {}, params = {} } = {}) => {
  const req = {
    body: structuredClone(body),
    params: structuredClone(params),
    query: {},
    headers: {}
  };

  let statusCode = 200;
  let jsonBody = null;
  let nextCalled = false;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      jsonBody = payload;
      return this;
    }
  };

  const middleware = validate(rules);
  await middleware(req, res, () => {
    nextCalled = true;
  });

  return { statusCode, jsonBody, nextCalled, req };
};

test('Frontend normalizeMobile handles formatting and +91 / 12-digit 91 prefixes safely', () => {
  assert.equal(normalizeMobile('9822012345'), '9822012345');
  assert.equal(normalizeMobile('+91 98220 12345'), '9822012345');
  assert.equal(normalizeMobile('919822012345'), '9822012345');
  assert.equal(normalizeMobile('(+91) 98220-12345'), '9822012345');
  // Must NOT strip leading 0 or 91 from an 11-digit number
  assert.equal(normalizeMobile('09822012345'), '09822012345');
  assert.equal(normalizeMobile('91678901234'), '91678901234');
});

test('Frontend validateMobile provides live typing progress, immediate errors, and populated .error', () => {
  const ok10 = validateMobile('9822012345');
  assert.equal(ok10.valid, true);
  assert.equal(ok10.status, 'valid');
  assert.equal(ok10.normalized, '9822012345');

  const okPlus91 = validateMobile('+91 98220 12345');
  assert.equal(okPlus91.valid, true);
  assert.equal(okPlus91.normalized, '9822012345');

  const ok12Digits = validateMobile('919822012345');
  assert.equal(ok12Digits.valid, true);
  assert.equal(ok12Digits.normalized, '9822012345');

  const badLeading0 = validateMobile('09822012345');
  assert.equal(badLeading0.valid, false);
  assert.equal(badLeading0.status, 'error');
  assert.match(badLeading0.immediateError, /leading 0/i);
  assert.equal(badLeading0.error, badLeading0.immediateError);

  const badStarter = validateMobile('1234567890');
  assert.equal(badStarter.valid, false);
  assert.equal(badStarter.status, 'error');
  assert.match(badStarter.immediateError, /start with 6, 7, 8, or 9/i);
  assert.equal(badStarter.error, badStarter.immediateError);

  const letters = validateMobile('98ab');
  assert.equal(letters.valid, false);
  assert.equal(letters.status, 'error');
  assert.match(letters.immediateError, /digits/i);
  assert.equal(letters.error, letters.immediateError);

  const typing = validateMobile('9822');
  assert.equal(typing.valid, false);
  assert.equal(typing.status, 'incomplete');
  assert.equal(typing.immediateError, undefined);
  assert.match(typing.hint, /4\/10 digits/);
  assert.match(typing.blurError, /4\/10 entered/);
  assert.equal(typing.error, typing.blurError);

  const tooLong = validateMobile('98220123456');
  assert.equal(tooLong.valid, false);
  assert.equal(tooLong.status, 'error');
  assert.match(tooLong.immediateError, /11\/10/);
  assert.equal(tooLong.error, tooLong.immediateError);

  const tooLong916 = validateMobile('91678901234');
  assert.equal(tooLong916.valid, false);
  assert.equal(tooLong916.status, 'error');
  assert.match(tooLong916.immediateError, /11\/10/);

  const emptyReq = validateMobile('');
  assert.equal(emptyReq.valid, false);
  assert.equal(emptyReq.status, 'empty');
  assert.match(emptyReq.error, /required/i);

  const emptyOpt = validateMobile('', { required: false });
  assert.equal(emptyOpt.valid, true);
  assert.equal(emptyOpt.status, 'idle');
});

test('Frontend remaining validators populate .error and enforce domain rules', () => {
  assert.equal(validateFullName('Aarav Deshmukh').valid, true);
  const nameWithDigits = validateFullName('Aarav 123');
  assert.equal(nameWithDigits.valid, false);
  assert.match(nameWithDigits.error, /numbers/i);

  assert.equal(validateAge('34').valid, true);
  assert.equal(validateAge('200').error, 'Age must be between 0 and 120 years');
  assert.match(validateAge('34.5').error, /whole years/i);

  assert.equal(validateDateOfBirth('1995-05-15').valid, true);
  assert.match(validateDateOfBirth('2099-01-01').error, /future/i);

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  assert.match(validateNotPastDate(yesterday).error, /past/i);
  assert.equal(validateNotPastDate(tomorrow).valid, true);

  assert.equal(validateRequiredText('Fever and cough', 'Symptoms').valid, true);
  assert.match(validateRequiredText('', 'Symptoms').error, /required/i);

  assert.equal(validateEmail('doctor@cliniccare.com').valid, true);
  assert.match(validateEmail('bad email@x.com').error, /spaces/i);
  assert.match(validateEmail('not-an-email').error, /valid email/i);

  assert.equal(validatePassword('secret12').valid, true);
  assert.match(validatePassword('123').error, /at least 6/i);

  assert.equal(validateClinicPhone('+91 20 2567 8901').valid, true);
  assert.match(validateClinicPhone('123').error, /8–15 digits/);

  assert.equal(validateAmount('500', 'Consultation fee', { required: true, min: 0 }).valid, true);
  assert.match(validateAmount('7.5', 'Follow-up window', { min: 0, integer: true }).error, /whole number/i);
  assert.equal(validateAmount('7', 'Follow-up window', { min: 0, integer: true }).valid, true);
  assert.match(validateAmount('-10', 'Fee').error, /cannot be less than 0/i);

  assert.equal(validateVitalField('bp', '120/80').valid, true);
  assert.match(validateVitalField('bp', '80/120').error, /Check BP/i);
  assert.match(validateVitalField('bp', '120').error, /Format: 120\/80/i);
  assert.equal(validateVitalField('pulse', '72').valid, true);
  assert.match(validateVitalField('pulse', '500').error, /Expected 30–220/i);
  assert.equal(validateVitalField('temp', '98.6').valid, true);
  assert.equal(validateVitalField('temperature', '99.1').valid, true);
  assert.match(validateVitalField('temperature', '125').error, /Expected 92–108/i);
  assert.equal(validateVitalField('spo2', '98').valid, true);
  assert.match(validateVitalField('spo2', '105').error, /Max 100%/i);
  assert.equal(validateVitalField('weight', '68.5').valid, true);
  assert.match(validateVitalField('weight', '500').error, /0.5–300 kg/);
});

test('Backend patientValidationRules normalizes +91 phone and rejects invalid patients', async () => {
  const validRes = await runValidationMiddleware(patientValidationRules.create, {
    body: {
      fullName: 'Sunita Patil',
      mobileNumber: '+91 98231 45678',
      gender: 'Female',
      dateOfBirth: '1988-03-14',
      bloodGroup: 'B+'
    }
  });
  assert.equal(validRes.nextCalled, true);
  assert.equal(validRes.req.body.mobileNumber, '9823145678');

  const invalidPhone = await runValidationMiddleware(patientValidationRules.create, {
    body: {
      fullName: 'Sunita Patil',
      mobileNumber: '1234567890',
      gender: 'Female'
    }
  });
  assert.equal(invalidPhone.nextCalled, false);
  assert.equal(invalidPhone.statusCode, 400);
  assert.equal(invalidPhone.jsonBody.field, 'mobileNumber');
  assert.match(invalidPhone.jsonBody.error, /10-digit mobile/i);

  const futureDob = await runValidationMiddleware(patientValidationRules.create, {
    body: {
      fullName: 'Sunita Patil',
      mobileNumber: '9823145678',
      gender: 'Female',
      dateOfBirth: '2099-01-01'
    }
  });
  assert.equal(futureDob.statusCode, 400);
  assert.equal(futureDob.jsonBody.field, 'dateOfBirth');
});

test('Backend appointmentValidationRules handles walk-ins, existing patients, and public bookings', async () => {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const validWalkIn = await runValidationMiddleware(appointmentValidationRules.create, {
    body: {
      isWalkIn: true,
      patientName: 'Ramesh Shinde',
      patientPhone: '+91 98765 43210',
      date: tomorrow,
      timeSlot: '10:30',
      reason: 'Fever'
    }
  });
  assert.equal(validWalkIn.nextCalled, true);
  assert.equal(validWalkIn.req.body.patientPhone, '9876543210');

  const walkInMissingPhone = await runValidationMiddleware(appointmentValidationRules.create, {
    body: {
      isWalkIn: true,
      patientName: 'Ramesh Shinde',
      patientPhone: '1234',
      date: tomorrow,
      timeSlot: '10:30'
    }
  });
  assert.equal(walkInMissingPhone.statusCode, 400);
  assert.equal(walkInMissingPhone.jsonBody.field, 'patientPhone');

  const existingPatient = await runValidationMiddleware(appointmentValidationRules.create, {
    body: {
      patientId: 'pat-001',
      date: tomorrow,
      timeSlot: '11:00'
    }
  });
  assert.equal(existingPatient.nextCalled, true);

  const badPublic = await runValidationMiddleware(appointmentValidationRules.publicBooking, {
    body: {
      fullName: '123',
      mobileNumber: '1234',
      age: '25.5',
      date: '2020-01-01',
      timeSlot: '99:99'
    }
  });
  assert.equal(badPublic.statusCode, 400);
  assert.ok(Array.isArray(badPublic.jsonBody.details));
  assert.ok(badPublic.jsonBody.details.length >= 4);

  const okPublic = await runValidationMiddleware(appointmentValidationRules.publicBooking, {
    body: {
      fullName: 'Priya Sharma',
      mobileNumber: '919821456780',
      age: 29,
      gender: 'Female',
      date: tomorrow,
      timeSlot: '09:30'
    }
  });
  assert.equal(okPublic.nextCalled, true);
  assert.equal(okPublic.req.body.mobileNumber, '9821456780');
});

test('Backend consultation, prescription, billing, clinic, document, followUp, and auth rules validate properly', async () => {
  const badVitals = await runValidationMiddleware(consultationValidationRules.create, {
    body: {
      patientId: 'pat-1',
      diagnosis: 'Viral Fever',
      vitals: { bp: '80/120', pulse: 500, spo2: 105 }
    }
  });
  assert.equal(badVitals.statusCode, 400);
  assert.equal(badVitals.jsonBody.field, 'vitals.bp');
  const vitalFields = badVitals.jsonBody.details.map((d) => d.path || d.param);
  assert.ok(vitalFields.includes('vitals.bp'));
  assert.ok(vitalFields.includes('vitals.pulse'));
  assert.ok(vitalFields.includes('vitals.spo2'));

  const goodConsult = await runValidationMiddleware(consultationValidationRules.create, {
    body: {
      patientId: 'pat-1',
      diagnosis: 'Viral Fever',
      vitals: { bp: '120/80', pulse: 76, temp: 99.4, spo2: 98, weight: 65 }
    }
  });
  assert.equal(goodConsult.nextCalled, true);

  const badRx = await runValidationMiddleware(prescriptionValidationRules.create, {
    body: {
      patientId: 'pat-1',
      medicines: [{ name: '   ', dosage: '500mg' }]
    }
  });
  assert.equal(badRx.statusCode, 400);
  assert.match(badRx.jsonBody.error, /medicine name/i);

  const okBill = await runValidationMiddleware(billingValidationRules.create, {
    body: {
      patientId: 'pat-1',
      consultationFee: 50000,
      paidAmount: 50000,
      paymentMethod: 'UPI'
    }
  });
  assert.equal(okBill.nextCalled, true);
  assert.equal(okBill.req.body.paymentMethod, 'upi');

  const badPay = await runValidationMiddleware(billingValidationRules.recordPayment, {
    params: { id: 'bill-1' },
    body: { amount: 0, paymentMethod: 'crypto' }
  });
  assert.equal(badPay.statusCode, 400);

  const badClinic = await runValidationMiddleware(clinicValidationRules.update, {
    body: { email: 'not-email', followUpValidityDays: 7.5 }
  });
  assert.equal(badClinic.statusCode, 400);

  const badDoc = await runValidationMiddleware(documentValidationRules.manualPrescription, {
    body: { patientId: '' }
  });
  assert.equal(badDoc.statusCode, 400);

  const badFollowUp = await runValidationMiddleware(followUpValidationRules.updateStatus, {
    params: { id: 'fu-1' },
    body: { status: 'bogus' }
  });
  assert.equal(badFollowUp.statusCode, 400);

  const badLogin = await runValidationMiddleware(authValidationRules.login, {
    body: { email: 'invalid', password: '' }
  });
  assert.equal(badLogin.statusCode, 400);

  const firebaseLogin = await runValidationMiddleware(authValidationRules.login, {
    body: { idToken: 'mock-firebase-id-token' }
  });
  assert.equal(firebaseLogin.nextCalled, true);

  const badStaff = await runValidationMiddleware(authValidationRules.createStaff, {
    body: { name: 'Nurse 99', email: 'nurse@clinic.com', phone: '1234567890', password: '123' }
  });
  assert.equal(badStaff.statusCode, 400);

  const okStaff = await runValidationMiddleware(authValidationRules.createStaff, {
    body: { name: 'Pooja Verma', email: 'pooja@clinic.com', phone: '+91 98220 11122', role: 'receptionist' }
  });
  assert.equal(okStaff.nextCalled, true);
  assert.equal(okStaff.req.body.phone, '9822011122');
  assert.equal(normalizePhoneInput('+91 98220 11122'), '9822011122');
});
