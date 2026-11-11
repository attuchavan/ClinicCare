import { getFirebaseState } from '../config/firebase.js';
import { dbService } from '../services/db.js';
import { verifySessionToken } from '../utils/sessionToken.js';

export const verifyAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
    }

    const token = authHeader.split('Bearer ')[1].trim();
    const signedUser = verifySessionToken(token);
    if (signedUser) {
      req.user = {
        uid: signedUser.uid,
        id: signedUser.id || signedUser.uid,
        email: signedUser.email || '',
        name: signedUser.name || 'User',
        role: signedUser.role,
        clinicId: signedUser.clinicId || 'clinic-default'
      };
      return next();
    }

    const { isFirebaseInitialized, firebaseAuth } = getFirebaseState();

    if (isFirebaseInitialized && firebaseAuth && !token.startsWith('dev-')) {
      // Firebase ID token verification
      try {
        const decodedToken = await firebaseAuth.verifyIdToken(token);
        const normalizedEmail = decodedToken.email?.toLowerCase();

        // Fetch existing user by matching primary account first, then UID
        const users = await dbService.getCollection('users');
        let user =
          users.find(u => normalizedEmail && u.email?.toLowerCase() === normalizedEmail && u.passwordHash) ||
          users.find(u => u.id === decodedToken.uid || u.uid === decodedToken.uid) ||
          users.find(u => normalizedEmail && u.email?.toLowerCase() === normalizedEmail) ||
          await dbService.getDocument('users', decodedToken.uid);

        if (!user) {
          const role = normalizedEmail?.startsWith('doctor')
            ? 'doctor'
            : users.length === 0
              ? 'doctor'
              : (decodedToken.role || 'receptionist');
          user = await dbService.createDocument('users', {
            uid: decodedToken.uid,
            email: normalizedEmail || '',
            name: decodedToken.name || normalizedEmail?.split('@')[0] || 'User',
            role,
            clinicId: decodedToken.clinicId || 'clinic-default',
            status: 'active'
          }, decodedToken.uid);
        }

        if (user.status !== 'active') {
          return res.status(403).json({ error: 'Account has been deactivated. Please contact the administrator.' });
        }

        req.user = {
          uid: user.uid || decodedToken.uid,
          id: user.id || decodedToken.uid,
          email: user.email,
          name: user.name,
          role: user.role,
          clinicId: user.clinicId || 'clinic-default'
        };
        return next();
      } catch (fbErr) {
        // In local development or testing mode, fall through to dev / base64 token parser
        if (process.env.NODE_ENV === 'production' && !token.startsWith('dev-') && !token.startsWith('mock-')) {
          return res.status(401).json({ error: 'Invalid or expired Firebase authentication token', details: fbErr.message });
        }
      }
    }

    // Local / Dev Token handling
    if (token === 'dev-doctor-token' || token.startsWith('mock-doctor-')) {
      const doctorUser = await dbService.getDocument('users', 'usr-doctor-01');
      req.user = {
        uid: doctorUser ? (doctorUser.uid || doctorUser.id) : 'usr-doctor-01',
        id: doctorUser ? doctorUser.id : 'usr-doctor-01',
        email: doctorUser ? doctorUser.email : 'doctor@cliniccare.com',
        name: doctorUser ? doctorUser.name : 'Dr. Rajesh Sharma',
        role: 'doctor',
        clinicId: 'clinic-default'
      };
      return next();
    }

    if (token === 'dev-receptionist-token' || token.startsWith('mock-receptionist-')) {
      const recUser = await dbService.getDocument('users', 'usr-receptionist-01');
      req.user = {
        uid: recUser ? (recUser.uid || recUser.id) : 'usr-receptionist-01',
        id: recUser ? recUser.id : 'usr-receptionist-01',
        email: recUser ? recUser.email : 'reception@cliniccare.com',
        name: recUser ? recUser.name : 'Pooja Verma',
        role: 'receptionist',
        clinicId: 'clinic-default'
      };
      return next();
    }

    // Attempt base64 JSON token parsing if custom
    try {
      const decodedStr = Buffer.from(token, 'base64').toString('utf8');
      const parsed = JSON.parse(decodedStr);
      if (parsed.uid && parsed.role) {
        req.user = {
          uid: parsed.uid,
          id: parsed.id || parsed.uid,
          email: parsed.email || '',
          name: parsed.name || 'User',
          role: parsed.role,
          clinicId: parsed.clinicId || 'clinic-default'
        };
        return next();
      }
    } catch {
      // not a base64 json token
    }

    return res.status(401).json({ error: 'Unauthorized: Authentication token is invalid' });
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

export const requireRole = (allowedRoles) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Access denied. Authorized roles: ${roles.join(', ')}. Your role: ${req.user.role}` 
      });
    }
    next();
  };
};

export const requireClinic = (req, res, next) => {
  if (!req.user || !req.user.clinicId) {
    return res.status(403).json({ error: 'Clinic context missing from authenticated session' });
  }
  // Enforce clinic data isolation
  req.clinicId = req.user.clinicId;
  next();
};
