import crypto from 'crypto';

const getSigningSecret = () =>
  process.env.SESSION_SECRET || process.env.FIREBASE_PROJECT_ID || 'cliniccare-local-session-secret';

// Sign compact session payload as cc.<base64url>.<hmac>
export const signSessionToken = (payload) => {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + 24 * 60 * 60 * 1000 }),
    'utf8'
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', getSigningSecret()).update(body).digest('base64url');
  return `cc.${body}.${sig}`;
};

// Verify signed session token and return payload or null
export const verifySessionToken = (token) => {
  if (!token || typeof token !== 'string' || !token.startsWith('cc.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [, body, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', getSigningSecret()).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (parsed.exp && Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
};

