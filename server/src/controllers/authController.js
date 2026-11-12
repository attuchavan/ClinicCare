import bcrypt from 'bcryptjs';
import { dbService } from '../services/db.js';
import { logAudit } from '../utils/auditLogger.js';
import { getFirebaseState } from '../config/firebase.js';
import { signSessionToken } from '../utils/sessionToken.js';
import { sanitizeUser } from '../utils/helpers.js';

export const authController = {
  // Login handler
  async login(req, res) {
    try {
      const { email, password, role, idToken } = req.body;
      const { isFirebaseInitialized, firebaseAuth } = getFirebaseState();

      // Case A: Real Firebase ID Token provided
      if (idToken) {
        if (isFirebaseInitialized && firebaseAuth) {
          try {
            const decoded = await firebaseAuth.verifyIdToken(idToken);
            const userEmail = decoded.email || email;
            const uid = decoded.uid;

            const users = await dbService.getCollection('users');
            const normalizedEmail = userEmail?.toLowerCase();
            // Match primary email account first (with passwordHash or doctor/receptionist id), else UID
            let user =
              users.find(u => normalizedEmail && u.email?.toLowerCase() === normalizedEmail && u.passwordHash) ||
              users.find(u => normalizedEmail && u.email?.toLowerCase() === normalizedEmail) ||
              users.find(u => u.uid === uid);

            if (!user) {
              const inferredRole = users.length === 0
                ? 'doctor'
                : (decoded.role || 'receptionist');
              user = await dbService.createDocument('users', {
                uid,
                name: decoded.name || userEmail?.split('@')[0] || 'Clinic Staff',
                email: normalizedEmail || '',
                role: inferredRole,
                clinicId: decoded.clinicId || 'clinic-default',
                status: 'active'
              }, uid);
            }

            if (user.status !== 'active') {
              return res.status(403).json({ error: 'This account has been deactivated. Please contact the clinic doctor.' });
            }

            await logAudit({
              clinicId: user.clinicId,
              actorId: user.id || uid,
              actorName: user.name,
              actorRole: user.role,
              action: 'USER_LOGIN',
              resourceType: 'users',
              resourceId: user.id || uid,
              ipAddress: req.ip,
              details: { method: 'firebase_id_token', uid }
            });

            return res.json({
              token: idToken,
              user: {
                id: user.id,
                uid: user.uid || uid,
                name: user.name,
                email: user.email,
                role: user.role,
                clinicId: user.clinicId,
                phone: user.phone || ''
              }
            });
          } catch (fbErr) {
            console.error('Firebase ID token verification failed in login:', fbErr.message);
            return res.status(401).json({ error: 'Invalid or expired Firebase authentication token' });
          }
        }
      }

      // Case B: Email/Password login (Direct or Dev/Demo Fallback)
      if (!email) {
        return res.status(400).json({ error: 'Email address is required' });
      }
      if (!password) {
        return res.status(400).json({ error: 'Password is required' });
      }

      const users = await dbService.getCollection('users');
      const normalizedEmail = email.toLowerCase();
      let user =
        users.find(u => u.email?.toLowerCase() === normalizedEmail && u.passwordHash) ||
        users.find(u => u.email?.toLowerCase() === normalizedEmail);

      if (!user) {
        return res.status(401).json({ error: 'User not found or invalid credentials' });
      }

      if (user.status !== 'active') {
        return res.status(403).json({ error: 'This account has been deactivated. Please contact the clinic doctor.' });
      }

      // Enforce bcrypt password verification
      if (user.passwordHash) {
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
          return res.status(401).json({ error: 'Invalid password. Please check your credentials.' });
        }
      } else {
        // Legacy seed record check & automated hash upgrade
        const isDefaultDoc = user.role === 'doctor' && (password === 'Doctor@123' || password === 'admin123');
        const isDefaultStaff = user.role === 'receptionist' && (password === 'Staff@123' || password === 'reception123');
        if (!isDefaultDoc && !isDefaultStaff) {
          return res.status(401).json({ error: 'Invalid password. Please check your credentials.' });
        }
        // Upgrade record with bcrypt hash
        const upgradedHash = await bcrypt.hash(password, 10);
        await dbService.updateDocument('users', user.id, { passwordHash: upgradedHash });
      }

      // Issue cryptographically signed API session token for email/password fallback
      const sessionToken = signSessionToken({
        uid: user.uid || user.id,
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        clinicId: user.clinicId || 'clinic-default'
      });

      await logAudit({
        clinicId: user.clinicId,
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'USER_LOGIN',
        resourceType: 'users',
        resourceId: user.id,
        ipAddress: req.ip,
        details: { method: 'password' }
      });

      return res.json({
        token: sessionToken,
        user: {
          id: user.id,
          uid: user.uid || user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          clinicId: user.clinicId,
          phone: user.phone || ''
        }
      });
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ error: 'Failed to process login request' });
    }
  },

  // Get current user session
  async getMe(req, res) {
    try {
      const user = await dbService.getDocument('users', req.user.id || req.user.uid);
      const clinic = await dbService.getDocument('clinicSettings', req.user.clinicId || 'clinic-default');
      return res.json({
        user: sanitizeUser(user) || sanitizeUser(req.user),
        clinic: clinic || null
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to retrieve user profile' });
    }
  },

  // Create receptionist account (Doctor only)
  async createStaff(req, res) {
    try {
      const { name, email, phone, role = 'receptionist', password = 'Staff@123' } = req.body;
      if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required for staff registration' });
      }

      const users = await dbService.getCollection('users');
      const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (existing) {
        return res.status(409).json({ error: 'A staff member with this email address already exists' });
      }

      let firebaseUid = null;
      const { isFirebaseInitialized, firebaseAuth } = getFirebaseState();
      if (isFirebaseInitialized && firebaseAuth) {
        try {
          const userRecord = await firebaseAuth.createUser({
            email: email.toLowerCase(),
            password: password || 'Staff@123',
            displayName: name,
            emailVerified: true
          });
          firebaseUid = userRecord.uid;
          await firebaseAuth.setCustomUserClaims(firebaseUid, {
            role: role === 'doctor' ? 'doctor' : 'receptionist',
            clinicId: req.user.clinicId || 'clinic-default'
          });
        } catch (fbErr) {
          console.warn('Firebase Auth staff creation note:', fbErr.message);
          if (fbErr.code === 'auth/email-already-exists') {
            try {
              const existingFbUser = await firebaseAuth.getUserByEmail(email.toLowerCase());
              firebaseUid = existingFbUser.uid;
            } catch { }
          }
        }
      }

      const passwordHash = await bcrypt.hash(password || 'Staff@123', 10);

      const newStaff = await dbService.createDocument('users', {
        uid: firebaseUid || undefined,
        name,
        email: email.toLowerCase(),
        phone: phone || '',
        role: role === 'doctor' ? 'doctor' : 'receptionist',
        clinicId: req.user.clinicId,
        status: 'active',
        passwordHash,
        createdBy: req.user.id
      }, firebaseUid || undefined);

      await logAudit({
        clinicId: req.user.clinicId,
        actorId: req.user.id,
        actorName: req.user.name,
        actorRole: req.user.role,
        action: 'STAFF_CREATE',
        resourceType: 'users',
        resourceId: newStaff.id,
        details: { name, email, role: newStaff.role, firebaseSynced: Boolean(firebaseUid) }
      });

      return res.status(201).json(sanitizeUser(newStaff));
    } catch (err) {
      console.error('Failed to register staff account:', err);
      return res.status(500).json({ error: 'Failed to register staff account' });
    }
  },

  // List staff members (Doctor only)
  async listStaff(req, res) {
    try {
      const users = await dbService.getCollection('users', req.user.clinicId);
      const staffList = users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt
      }));
      return res.json(staffList);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch staff members' });
    }
  },

  // Toggle staff status (Doctor only)
  async toggleStaffStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be active or inactive.' });
      }

      if (id === req.user.id) {
        return res.status(400).json({ error: 'You cannot deactivate your own account.' });
      }

      const user = await dbService.getDocument('users', id);
      const updated = await dbService.updateDocument('users', id, { status });

      // Synchronize account state with Firebase Auth if initialized
      const { isFirebaseInitialized, firebaseAuth } = getFirebaseState();
      if (isFirebaseInitialized && firebaseAuth && (user?.uid || id)) {
        try {
          await firebaseAuth.updateUser(user?.uid || id, {
            disabled: status === 'inactive'
          });
        } catch (fbErr) {
          console.warn('Firebase Auth toggle status note:', fbErr.message);
        }
      }

      await logAudit({
        clinicId: req.user.clinicId,
        actorId: req.user.id,
        actorName: req.user.name,
        actorRole: req.user.role,
        action: 'STAFF_STATUS_UPDATE',
        resourceType: 'users',
        resourceId: id,
        details: { status }
      });

      return res.json(sanitizeUser(updated));
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update staff status' });
    }
  },

  // Request password reset
  async requestPasswordReset(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email address is required' });
      }

      const { isFirebaseInitialized, firebaseAuth } = getFirebaseState();
      let resetLinkGenerated = false;

      if (isFirebaseInitialized && firebaseAuth) {
        try {
          const resetLink = await firebaseAuth.generatePasswordResetLink(email.toLowerCase());
          resetLinkGenerated = true;
          console.log(`🔑 Generated Firebase password reset link for ${email}: ${resetLink}`);
        } catch (fbErr) {
          console.warn('Firebase Auth password reset link note:', fbErr.message);
        }
      }

      await logAudit({
        actorId: 'system',
        actorName: 'System Auth',
        actorRole: 'system',
        action: 'PASSWORD_RESET_REQUESTED',
        resourceType: 'users',
        details: { email, resetLinkGenerated }
      });

      return res.json({
        message: 'If an active account exists with this email, password recovery instructions have been sent.'
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to process password reset' });
    }
  }
};
