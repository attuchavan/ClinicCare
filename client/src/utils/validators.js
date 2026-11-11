export const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;
export const NAME_REGEX = /^[\p{L}\s.'-]+$/u;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const BP_REGEX = /^\d{2,3}\/\d{2,3}$/;

const withError = (res) => {
  if (!res || res.valid) return res;
  const error = res.error || res.immediateError || res.blurError || 'Invalid value';
  return error === res.error ? res : { ...res, error };
};

const wrap = (fn) => (...args) => withError(fn(...args));

/**
 * Strip formatting characters (spaces, hyphens, parentheses) and unwrap an explicit
 * +91 / 91 prefix when it wraps a valid 10-digit Indian mobile number.
 */
export const normalizeMobile = (raw = '') => {
  if (typeof raw !== 'string') return '';
  const compact = raw.trim().replace(/[\s()-]/g, '');
  const withCountry = compact.match(/^(?:\+91|91)([6-9]\d{9})$/);
  return withCountry ? withCountry[1] : compact;
};

/**
 * Live validator for Indian 10-digit mobile numbers.
 * Flags impossible inputs immediately (letters, non-6-9 start, >10 digits), shows live
 * digit count while typing, confirms validity immediately at 10 valid digits, and reports
 * incomplete entries on blur or submit.
 */
export const validateMobile = wrap((raw = '', { required = true, label = 'Mobile number' } = {}) => {
  const value = String(raw || '');
  const trimmed = value.trim();

  if (!trimmed) {
    return required
      ? { valid: false, status: 'empty', blurError: `${label} is required`, digits: '' }
      : { valid: true, status: 'idle', digits: '' };
  }

  // Disallow letters and unexpected symbols right away (+ only allowed as leading +91 prefix)
  const hasBadPlus = trimmed.indexOf('+', 1) !== -1;
  if (/[^0-9+\s()-]/.test(trimmed) || hasBadPlus) {
    return {
      valid: false,
      status: 'error',
      immediateError: 'Use digits (0–9) only — letters or symbols are not allowed',
      digits: trimmed.replace(/\D/g, '')
    };
  }

  // Support typing with +91 prefix immediately or full 12-digit 91XXXXXXXXXX
  let localDigits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+91')) {
    localDigits = trimmed.slice(3).replace(/\D/g, '');
  } else if (localDigits.length === 12 && /^91[6-9]\d{9}$/.test(localDigits)) {
    localDigits = localDigits.slice(2);
  }

  if (localDigits.length === 0) {
    return {
      valid: false,
      status: 'incomplete',
      hint: '0/10 digits — enter 10-digit number starting with 6–9',
      blurError: 'Enter all 10 digits starting with 6–9',
      digits: ''
    };
  }

  if (!/^[6-9]/.test(localDigits)) {
    const leadingHint = localDigits.startsWith('0')
      ? 'Start with 6–9 (do not add a leading 0)'
      : 'Mobile number must start with 6, 7, 8, or 9';
    return {
      valid: false,
      status: 'error',
      immediateError: leadingHint,
      digits: localDigits
    };
  }

  if (localDigits.length > 10) {
    return {
      valid: false,
      status: 'error',
      immediateError: `Too many digits (${localDigits.length}/10) — enter exactly 10 digits`,
      digits: localDigits
    };
  }

  if (localDigits.length < 10) {
    const remaining = 10 - localDigits.length;
    return {
      valid: false,
      status: 'incomplete',
      hint: `${localDigits.length}/10 digits — ${remaining} more needed`,
      blurError: `Enter all 10 digits (${localDigits.length}/10 entered)`,
      digits: localDigits
    };
  }

  return {
    valid: true,
    status: 'valid',
    validText: `Valid 10-digit mobile (${localDigits})`,
    normalized: localDigits,
    digits: localDigits
  };
});

/**
 * Live validator for person names (supports Unicode letters, spaces, dots, apostrophes, hyphens).
 */
export const validateFullName = wrap((raw = '', { required = true, label = 'Full name', min = 2, max = 100 } = {}) => {
  const value = String(raw || '');
  const trimmed = value.trim();

  if (/\d/.test(value)) {
    return {
      valid: false,
      status: 'error',
      immediateError: `${label} cannot contain numbers`
    };
  }

  if (trimmed && !NAME_REGEX.test(trimmed)) {
    return {
      valid: false,
      status: 'error',
      immediateError: `${label} may only contain letters, spaces, dots, or hyphens`
    };
  }

  if (trimmed.length > max) {
    return {
      valid: false,
      status: 'error',
      immediateError: `${label} must be under ${max} characters`
    };
  }

  if (!trimmed) {
    return required
      ? { valid: false, status: 'empty', blurError: `${label} is required` }
      : { valid: true, status: 'idle' };
  }

  if (trimmed.length < min) {
    return {
      valid: false,
      status: 'incomplete',
      blurError: `${label} must be at least ${min} characters`
    };
  }

  return {
    valid: true,
    status: 'valid',
    validText: 'Looks good'
  };
});

/**
 * Live validator for numeric age in whole years (0–120).
 */
export const validateAge = wrap((raw = '', { required = false, min = 0, max = 120 } = {}) => {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) {
    return required
      ? { valid: false, status: 'empty', blurError: 'Age is required' }
      : { valid: true, status: 'idle' };
  }

  if (!/^\d+$/.test(trimmed)) {
    return {
      valid: false,
      status: 'error',
      immediateError: 'Enter whole years (0–120)'
    };
  }

  const num = Number(trimmed);
  if (num < min || num > max) {
    return {
      valid: false,
      status: 'error',
      immediateError: `Age must be between ${min} and ${max} years`
    };
  }

  return {
    valid: true,
    status: 'valid',
    validText: `${num} yrs`
  };
});

/**
 * Live validator for date of birth (YYYY-MM-DD, not in the future, within 130 years).
 */
export const validateDateOfBirth = wrap((raw = '', { required = false } = {}) => {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    return required
      ? { valid: false, status: 'empty', blurError: 'Date of birth is required' }
      : { valid: true, status: 'idle' };
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return {
      valid: false,
      status: 'error',
      immediateError: 'Enter a valid date'
    };
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (parsed > today) {
    return {
      valid: false,
      status: 'error',
      immediateError: 'Date of birth cannot be in the future'
    };
  }

  const oldest = new Date();
  oldest.setFullYear(oldest.getFullYear() - 130);
  if (parsed < oldest) {
    return {
      valid: false,
      status: 'error',
      immediateError: 'Check year — must be within 130 years'
    };
  }

  return { valid: true, status: 'valid', validText: 'Valid date' };
});

/**
 * Validator for appointment / follow-up dates that must not be in the past.
 */
export const validateNotPastDate = wrap((raw = '', { required = true, label = 'Date' } = {}) => {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    return required
      ? { valid: false, status: 'empty', blurError: `${label} is required` }
      : { valid: true, status: 'idle' };
  }
  const todayStr = new Date().toISOString().slice(0, 10);
  if (trimmed < todayStr) {
    return {
      valid: false,
      status: 'error',
      immediateError: `${label} cannot be in the past`
    };
  }
  return { valid: true, status: 'valid' };
});

/**
 * Validator for required clinical/reason text fields.
 */
export const validateRequiredText = wrap((raw = '', label = 'This field', { required = true, min = 2, max = 500 } = {}) => {
  const trimmed = String(raw || '').trim();
  if (trimmed.length > max) {
    return {
      valid: false,
      status: 'error',
      immediateError: `${label} must be under ${max} characters (${trimmed.length}/${max})`
    };
  }
  if (!trimmed) {
    return required
      ? { valid: false, status: 'empty', blurError: `${label} is required` }
      : { valid: true, status: 'idle' };
  }
  if (trimmed.length < min) {
    return {
      valid: false,
      status: 'incomplete',
      blurError: `${label} must be at least ${min} characters`
    };
  }
  return { valid: true, status: 'valid', validText: 'Looks good' };
});

/**
 * Live email validator.
 */
export const validateEmail = wrap((raw = '', { required = true } = {}) => {
  const value = String(raw || '');
  const trimmed = value.trim();

  if (/\s/.test(trimmed)) {
    return {
      valid: false,
      status: 'error',
      immediateError: 'Email address cannot contain spaces'
    };
  }
  if (!trimmed) {
    return required
      ? { valid: false, status: 'empty', blurError: 'Email address is required' }
      : { valid: true, status: 'idle' };
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return {
      valid: false,
      status: 'incomplete',
      blurError: 'Enter a valid email address (e.g. name@clinic.com)'
    };
  }
  return { valid: true, status: 'valid', validText: 'Valid email' };
});

/**
 * Live password validator.
 */
export const validatePassword = wrap((raw = '', { required = true, min = 6, max = 100 } = {}) => {
  const value = String(raw || '');
  if (!value) {
    return required
      ? { valid: false, status: 'empty', blurError: 'Password is required' }
      : { valid: true, status: 'idle' };
  }
  if (value.length > max) {
    return {
      valid: false,
      status: 'error',
      immediateError: `Password must be under ${max} characters`
    };
  }
  if (value.length < min) {
    return {
      valid: false,
      status: 'incomplete',
      hint: `${value.length}/${min}+ characters`,
      blurError: `Password must be at least ${min} characters`
    };
  }
  return { valid: true, status: 'valid', validText: 'Valid length' };
});

/**
 * Clinic phone / helpline validator (supports +91, STD landline or mobile 8–20 chars).
 */
export const validateClinicPhone = wrap((raw = '', { required = true } = {}) => {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    return required
      ? { valid: false, status: 'empty', blurError: 'Clinic phone number is required' }
      : { valid: true, status: 'idle' };
  }
  if (/[^+\d\s()-]/.test(trimmed)) {
    return {
      valid: false,
      status: 'error',
      immediateError: 'Use valid phone characters (+, spaces, digits) only'
    };
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) {
    return {
      valid: false,
      status: 'incomplete',
      blurError: 'Enter a valid clinic phone number (8–15 digits)'
    };
  }
  return { valid: true, status: 'valid', validText: 'Valid clinic phone' };
});

/**
 * Positive amount / fee / integer window validator.
 */
export const validateAmount = wrap((raw = '', label = 'Amount', { required = false, min = 0, max = 1000000, integer = false } = {}) => {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) {
    return required
      ? { valid: false, status: 'empty', blurError: `${label} is required` }
      : { valid: true, status: 'idle' };
  }
  const num = Number(trimmed);
  if (Number.isNaN(num)) {
    return { valid: false, status: 'error', immediateError: `Enter a valid numeric ${label.toLowerCase()}` };
  }
  if (integer && !Number.isInteger(num)) {
    return { valid: false, status: 'error', immediateError: `${label} must be a whole number` };
  }
  if (num < min) {
    return { valid: false, status: 'error', immediateError: `${label} cannot be less than ${min}` };
  }
  if (num > max) {
    return { valid: false, status: 'error', immediateError: `${label} exceeds maximum (${max})` };
  }
  return { valid: true, status: 'valid' };
});

/**
 * Clinical vitals field live validator.
 */
export const validateVitalField = wrap((field, raw = '') => {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return { valid: true, status: 'idle' };

  if (field === 'bp') {
    if (/[^\d/]/.test(trimmed)) {
      return { valid: false, status: 'error', immediateError: 'Use format 120/80' };
    }
    if (!BP_REGEX.test(trimmed)) {
      return { valid: false, status: 'incomplete', blurError: 'Format: 120/80' };
    }
    const [sys, dia] = trimmed.split('/').map(Number);
    if (sys < 50 || sys > 260 || dia < 30 || dia > 160 || sys <= dia) {
      return { valid: false, status: 'error', immediateError: 'Check BP (e.g. 120/80)' };
    }
    return { valid: true, status: 'valid' };
  }

  const num = Number(trimmed);
  if (Number.isNaN(num)) {
    return { valid: false, status: 'error', immediateError: 'Numbers only' };
  }

  if (field === 'pulse') {
    if (num < 0 || num > 300) return { valid: false, status: 'error', immediateError: 'Expected 30–220' };
    if (num < 30 || num > 220) return { valid: false, status: 'incomplete', blurError: 'Range: 30–220 bpm' };
    return { valid: true, status: 'valid' };
  }

  if (field === 'temperature' || field === 'temp') {
    if (num < 0 || num > 115) return { valid: false, status: 'error', immediateError: 'Expected 92–108 °F' };
    if (num < 92 || num > 108) return { valid: false, status: 'incomplete', blurError: 'Range: 92–108 °F' };
    return { valid: true, status: 'valid' };
  }

  if (field === 'spo2') {
    if (num < 0 || num > 100) return { valid: false, status: 'error', immediateError: 'Max 100%' };
    if (num < 50) return { valid: false, status: 'incomplete', blurError: 'Range: 50–100%' };
    return { valid: true, status: 'valid' };
  }

  if (field === 'weight') {
    if (num < 0.5 || num > 300) return { valid: false, status: 'error', immediateError: 'Range: 0.5–300 kg' };
    return { valid: true, status: 'valid' };
  }

  return { valid: true, status: 'idle' };
});
