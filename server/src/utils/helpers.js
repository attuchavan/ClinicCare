/**
 * Format a Date (or current time) as YYYY-MM-DD in the clinic's local timezone
 * (defaults to Asia/Kolkata so IST midnight never shifts queue dates).
 */
export const getClinicDateString = (date = new Date(), timeZone = process.env.CLINIC_TIMEZONE || 'Asia/Kolkata') => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
};

/**
 * Compute lowercase weekday key from a YYYY-MM-DD string in UTC so server timezone
 * never shifts the weekday off by one day.
 */
export const getWeekdayKeyFromDateStr = (dateStr) => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const match = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const dt = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return days[dt.getUTCDay()];
  }
  return days[new Date(dateStr).getUTCDay()];
};

/**
 * Compute the next collision-free sequential code (`<prefix><paddedNumber>`), scanning
 * existing records instead of using `array.length + 1`.
 */
export const getNextSequenceCode = (records = [], field, prefix, padLength = 4) => {
  let maxNum = 0;
  for (const item of records) {
    const val = item?.[field];
    if (typeof val === 'string' && val.startsWith(prefix)) {
      const num = parseInt(val.slice(prefix.length), 10);
      if (!Number.isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }
  return `${prefix}${String(maxNum + 1).padStart(padLength, '0')}`;
};

/**
 * Remove sensitive credential fields before returning a staff/user object over HTTP.
 */
export const sanitizeUser = (user) => {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
};

