import { body, param, validationResult } from 'express-validator';

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;
const NAME_REGEX = /^[\p{L}\s.'-]+$/u;
const TIME_SLOT_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const BP_REGEX = /^\d{2,3}\/\d{2,3}$/;
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDERS = ['Male', 'Female', 'Other'];
const PAYMENT_METHODS = ['cash', 'upi', 'card', 'netbanking', 'other'];

/**
 * Strip formatting characters (spaces, hyphens, parentheses) and unwrap an explicit
 * +91 / 91 country code when it wraps a valid 10-digit Indian mobile number.
 */
export const normalizePhoneInput = (value) => {
  if (typeof value !== 'string') return value;
  const compact = value.trim().replace(/[\s()-]/g, '');
  const withCountry = compact.match(/^(?:\+91|91)([6-9]\d{9})$/);
  return withCountry ? withCountry[1] : compact;
};

const validateNotFutureDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Date must be formatted as YYYY-MM-DD');
  }
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (parsed > today) {
    throw new Error('Date of birth cannot be in the future');
  }
  const oldestAllowed = new Date();
  oldestAllowed.setFullYear(oldestAllowed.getFullYear() - 130);
  if (parsed < oldestAllowed) {
    throw new Error('Date of birth cannot be more than 130 years ago');
  }
  return true;
};

const validateVitalsRules = [
  body('vitals.bp')
    .optional({ values: 'falsy' })
    .trim()
    .matches(BP_REGEX).withMessage('Blood pressure must be formatted as systolic/diastolic (e.g. 120/80)')
    .custom((val) => {
      const [sys, dia] = val.split('/').map(Number);
      if (sys < 50 || sys > 260 || dia < 30 || dia > 160 || sys <= dia) {
        throw new Error('Blood pressure values look physiologically out of range (e.g. 120/80)');
      }
      return true;
    }),
  body('vitals.pulse')
    .optional({ values: 'falsy' })
    .isFloat({ min: 30, max: 220 }).withMessage('Pulse rate must be between 30 and 220 bpm'),
  body('vitals.temp')
    .optional({ values: 'falsy' })
    .isFloat({ min: 90, max: 110 }).withMessage('Temperature must be between 90 and 110 °F'),
  body('vitals.temperature')
    .optional({ values: 'falsy' })
    .isFloat({ min: 90, max: 110 }).withMessage('Temperature must be between 90 and 110 °F'),
  body('vitals.spo2')
    .optional({ values: 'falsy' })
    .isFloat({ min: 50, max: 100 }).withMessage('SpO2 must be between 50% and 100%'),
  body('vitals.weight')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0.5, max: 300 }).withMessage('Weight must be between 0.5 and 300 kg')
];

/**
 * Middleware to run all validation rules and return structured error payloads.
 */
export const validate = (validations) => {
  return async (req, res, next) => {
    for (const validation of validations) {
      await validation.run(req);
    }

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const allErrors = errors.array();
    const firstError = allErrors[0];
    return res.status(400).json({
      error: firstError.msg || 'Invalid request parameters',
      field: firstError.path || firstError.param,
      details: allErrors
    });
  };
};

/**
 * Validation rules for Patient operations
 */
export const patientValidationRules = {
  create: [
    body('fullName')
      .trim()
      .notEmpty().withMessage('Patient full name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
      .matches(NAME_REGEX).withMessage('Patient name may only contain letters, spaces, dots, or hyphens'),
    body('mobileNumber')
      .customSanitizer(normalizePhoneInput)
      .notEmpty().withMessage('Mobile contact number is required')
      .matches(INDIAN_MOBILE_REGEX).withMessage('Please enter a valid 10-digit mobile number starting with 6–9'),
    body('gender')
      .trim()
      .notEmpty().withMessage('Gender is required')
      .isIn(GENDERS).withMessage('Gender must be Male, Female, or Other'),
    body('dateOfBirth')
      .optional({ values: 'falsy' })
      .isISO8601().withMessage('Date of birth must be a valid date (YYYY-MM-DD)')
      .custom(validateNotFutureDate),
    body('bloodGroup')
      .optional({ values: 'falsy' })
      .isIn(BLOOD_GROUPS).withMessage('Invalid blood group'),
    body('allergies')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ max: 300 }).withMessage('Allergies note must be under 300 characters'),
    body('address')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ max: 500 }).withMessage('Address must be under 500 characters'),
    body('emergencyContact')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ max: 120 }).withMessage('Emergency contact must be under 120 characters')
  ],
  update: [
    param('id').notEmpty().withMessage('Patient ID parameter is required'),
    body('fullName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
      .matches(NAME_REGEX).withMessage('Patient name may only contain letters, spaces, dots, or hyphens'),
    body('mobileNumber')
      .optional()
      .customSanitizer(normalizePhoneInput)
      .matches(INDIAN_MOBILE_REGEX).withMessage('Please enter a valid 10-digit mobile number starting with 6–9'),
    body('gender')
      .optional({ values: 'falsy' })
      .isIn(GENDERS).withMessage('Gender must be Male, Female, or Other'),
    body('dateOfBirth')
      .optional({ values: 'falsy' })
      .isISO8601().withMessage('Date of birth must be a valid date (YYYY-MM-DD)')
      .custom(validateNotFutureDate),
    body('bloodGroup')
      .optional({ values: 'falsy' })
      .isIn(BLOOD_GROUPS).withMessage('Invalid blood group')
  ]
};

/**
 * Validation rules for Appointment operations
 */
export const appointmentValidationRules = {
  create: [
    body('patientId')
      .if((value, { req }) => !req.body.isWalkIn)
      .notEmpty().withMessage('Patient selection is required'),
    body('patientName')
      .if((value, { req }) => !req.body.patientId)
      .trim()
      .notEmpty().withMessage('Patient full name is required for walk-in appointments')
      .isLength({ min: 2, max: 100 }).withMessage('Patient name must be between 2 and 100 characters')
      .matches(NAME_REGEX).withMessage('Patient name may only contain letters, spaces, dots, or hyphens'),
    body('patientPhone')
      .if((value, { req }) => !req.body.patientId || Boolean(value))
      .customSanitizer(normalizePhoneInput)
      .notEmpty().withMessage('Valid 10-digit mobile number is required for walk-in appointments')
      .matches(INDIAN_MOBILE_REGEX).withMessage('Please enter a valid 10-digit mobile number starting with 6–9'),
    body('date')
      .notEmpty().withMessage('Appointment date is required')
      .isISO8601().withMessage('Date must be formatted as YYYY-MM-DD'),
    body('timeSlot')
      .notEmpty().withMessage('Time slot is required')
      .matches(TIME_SLOT_REGEX).withMessage('Time slot must be formatted as HH:MM (e.g. 09:30)'),
    body('reason')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ max: 500 }).withMessage('Reason / symptoms must be under 500 characters'),
    body('status')
      .optional()
      .isIn(['requested', 'confirmed', 'checked-in', 'in-consultation', 'completed', 'cancelled', 'no-show'])
      .withMessage('Invalid appointment status')
  ],
  publicBooking: [
    body('fullName')
      .trim()
      .notEmpty().withMessage('Full name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
      .matches(NAME_REGEX).withMessage('Name may only contain letters, spaces, dots, or hyphens'),
    body('mobileNumber')
      .customSanitizer(normalizePhoneInput)
      .notEmpty().withMessage('Mobile number is required')
      .matches(INDIAN_MOBILE_REGEX).withMessage('Please enter a valid 10-digit mobile number starting with 6–9'),
    body('age')
      .optional({ values: 'falsy' })
      .isInt({ min: 0, max: 120 }).withMessage('Age must be a whole number between 0 and 120'),
    body('gender')
      .optional({ values: 'falsy' })
      .isIn(GENDERS).withMessage('Gender must be Male, Female, or Other'),
    body('date')
      .notEmpty().withMessage('Consultation date is required')
      .isISO8601().withMessage('Date must be formatted as YYYY-MM-DD')
      .custom((value) => {
        const todayStr = new Date().toISOString().slice(0, 10);
        if (value < todayStr) {
          throw new Error('Appointment date cannot be in the past');
        }
        return true;
      }),
    body('timeSlot')
      .notEmpty().withMessage('Time slot is required')
      .matches(TIME_SLOT_REGEX).withMessage('Time slot must be formatted as HH:MM (e.g. 09:30)'),
    body('reason')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ max: 500 }).withMessage('Reason must be under 500 characters')
  ],
  status: [
    param('id').notEmpty().withMessage('Appointment ID is required'),
    body('status')
      .notEmpty().withMessage('Status is required')
      .isIn(['requested', 'confirmed', 'checked-in', 'in-consultation', 'completed', 'cancelled', 'no-show'])
      .withMessage('Invalid appointment status')
  ],
  reschedule: [
    param('id').notEmpty().withMessage('Appointment ID is required'),
    body('date')
      .notEmpty().withMessage('New appointment date is required')
      .isISO8601().withMessage('Date must be formatted as YYYY-MM-DD'),
    body('timeSlot')
      .notEmpty().withMessage('New time slot is required')
      .matches(TIME_SLOT_REGEX).withMessage('Time slot must be formatted as HH:MM (e.g. 09:30)')
  ]
};

/**
 * Validation rules for Consultation operations
 */
export const consultationValidationRules = {
  create: [
    body('patientId').notEmpty().withMessage('Patient ID is required'),
    body('diagnosis')
      .trim()
      .notEmpty().withMessage('Clinical diagnosis or working impression is required')
      .isLength({ min: 2, max: 500 }).withMessage('Diagnosis must be between 2 and 500 characters'),
    body('followUpDate')
      .optional({ values: 'falsy' })
      .isISO8601().withMessage('Follow-up date must be formatted as YYYY-MM-DD'),
    ...validateVitalsRules
  ],
  update: [
    param('id').notEmpty().withMessage('Consultation ID is required'),
    body('diagnosis')
      .optional()
      .trim()
      .isLength({ min: 2, max: 500 }).withMessage('Diagnosis must be between 2 and 500 characters'),
    body('followUpDate')
      .optional({ values: 'falsy' })
      .isISO8601().withMessage('Follow-up date must be formatted as YYYY-MM-DD'),
    ...validateVitalsRules
  ]
};

/**
 * Validation rules for Prescription operations
 */
export const prescriptionValidationRules = {
  create: [
    body('patientId').notEmpty().withMessage('Patient ID is required'),
    body('medicines')
      .isArray({ min: 1 }).withMessage('At least one medicine item is required on the prescription'),
    body('medicines.*.name')
      .trim()
      .notEmpty().withMessage('Every prescribed item must include a medicine name'),
    body('diagnosis')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ max: 500 }).withMessage('Diagnosis must be under 500 characters'),
    body('followUpDate')
      .optional({ values: 'falsy' })
      .isISO8601().withMessage('Follow-up date must be formatted as YYYY-MM-DD')
  ],
  update: [
    param('id').notEmpty().withMessage('Prescription ID is required'),
    body('medicines')
      .optional()
      .isArray({ min: 1 }).withMessage('At least one medicine item is required on the prescription'),
    body('medicines.*.name')
      .optional()
      .trim()
      .notEmpty().withMessage('Every prescribed item must include a medicine name'),
    body('followUpDate')
      .optional({ values: 'falsy' })
      .isISO8601().withMessage('Follow-up date must be formatted as YYYY-MM-DD')
  ]
};

/**
 * Validation rules for Billing operations
 */
export const billingValidationRules = {
  create: [
    body('patientId').notEmpty().withMessage('Patient ID is required'),
    body('consultationFee')
      .optional()
      .isInt({ min: 0 }).withMessage('Consultation fee must be a non-negative integer in paise'),
    body('paidAmount')
      .optional()
      .isInt({ min: 0 }).withMessage('Paid amount must be a non-negative integer in paise'),
    body('additionalCharges')
      .optional()
      .isArray().withMessage('Additional charges must be an array'),
    body('additionalCharges.*.amount')
      .optional()
      .isInt({ min: 0 }).withMessage('Additional service amounts must be non-negative'),
    body('paymentMethod')
      .optional()
      .customSanitizer((val) => (typeof val === 'string' ? val.toLowerCase() : val))
      .isIn(PAYMENT_METHODS).withMessage('Invalid payment method')
  ],
  recordPayment: [
    param('id').notEmpty().withMessage('Bill ID is required'),
    body('amount')
      .notEmpty().withMessage('Payment amount is required')
      .isInt({ min: 1 }).withMessage('Payment amount must be greater than 0'),
    body('paymentMethod')
      .optional()
      .customSanitizer((val) => (typeof val === 'string' ? val.toLowerCase() : val))
      .isIn(PAYMENT_METHODS).withMessage('Invalid payment method')
  ]
};

/**
 * Validation rules for Clinic settings
 */
export const clinicValidationRules = {
  update: [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 120 }).withMessage('Clinic name must be between 2 and 120 characters'),
    body('doctorName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 120 }).withMessage('Doctor name must be between 2 and 120 characters'),
    body('doctorRegNo')
      .optional()
      .trim()
      .isLength({ min: 2, max: 60 }).withMessage('Registration number must be between 2 and 60 characters'),
    body('phone')
      .optional({ values: 'falsy' })
      .trim()
      .matches(/^[+\d\s()-]{8,20}$/).withMessage('Enter a valid clinic phone number (8–20 digits/symbols)'),
    body('email')
      .optional({ values: 'falsy' })
      .trim()
      .isEmail().withMessage('Enter a valid clinic email address'),
    body('consultationFee')
      .optional()
      .isInt({ min: 0, max: 10000000 }).withMessage('Consultation fee must be 0 or greater'),
    body('followUpValidityDays')
      .optional()
      .isInt({ min: 0, max: 365 }).withMessage('Follow-up validity days must be between 0 and 365'),
    body('slotDurationMinutes')
      .optional()
      .isInt({ min: 5, max: 120 }).withMessage('Slot duration must be between 5 and 120 minutes')
  ]
};

/**
 * Validation rules for Document / Manual Prescription records
 */
export const documentValidationRules = {
  manualPrescription: [
    body('patientId').notEmpty().withMessage('Patient ID is required'),
    body('originalDocumentDate')
      .optional({ values: 'falsy' })
      .isISO8601().withMessage('Document date must be formatted as YYYY-MM-DD'),
    body('doctorName')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ max: 120 }).withMessage('Doctor name must be under 120 characters'),
    body('prescribedMedicines')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ max: 2000 }).withMessage('Prescribed medicines text is too long'),
    body('notes')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ max: 2000 }).withMessage('Clinical notes text is too long')
  ]
};

/**
 * Validation rules for Follow-ups
 */
export const followUpValidationRules = {
  updateStatus: [
    param('id').notEmpty().withMessage('Follow-up ID is required'),
    body('status')
      .notEmpty().withMessage('Status is required')
      .isIn(['scheduled', 'reminder_sent', 'completed', 'cancelled'])
      .withMessage('Invalid follow-up status')
  ]
};

/**
 * Validation rules for Authentication & Staff
 */
export const authValidationRules = {
  login: [
    body('email')
      .if((value, { req }) => !req.body.idToken)
      .trim()
      .notEmpty().withMessage('Email address is required')
      .isEmail().withMessage('Valid email format is required'),
    body('password')
      .if((value, { req }) => !req.body.idToken)
      .notEmpty().withMessage('Password is required')
  ],
  resetPassword: [
    body('email')
      .trim()
      .notEmpty().withMessage('Email address is required')
      .isEmail().withMessage('Valid email format is required')
  ],
  createStaff: [
    body('name')
      .trim()
      .notEmpty().withMessage('Staff full name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
      .matches(NAME_REGEX).withMessage('Staff name may only contain letters, spaces, dots, or hyphens'),
    body('email')
      .trim()
      .notEmpty().withMessage('Staff email address is required')
      .isEmail().withMessage('Valid email address is required'),
    body('phone')
      .optional({ values: 'falsy' })
      .customSanitizer(normalizePhoneInput)
      .matches(INDIAN_MOBILE_REGEX).withMessage('Please enter a valid 10-digit mobile number starting with 6–9'),
    body('role')
      .optional()
      .isIn(['doctor', 'receptionist']).withMessage('Role must be doctor or receptionist'),
    body('password')
      .optional({ values: 'falsy' })
      .isLength({ min: 6, max: 100 }).withMessage('Password must be at least 6 characters')
  ],
  toggleStatus: [
    param('id').notEmpty().withMessage('Staff ID is required'),
    body('status')
      .notEmpty().withMessage('Status is required')
      .isIn(['active', 'inactive']).withMessage('Status must be active or inactive')
  ]
};
