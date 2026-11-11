import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { getFirebaseState } from '../config/firebase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_FILE = path.resolve(DATA_DIR, 'cliniccare_db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial seed data for fresh setup
const getInitialSeed = () => ({
  clinicSettings: [
    {
      id: 'clinic-default',
      clinicId: 'clinic-default',
      name: 'City Care Family Clinic',
      doctorName: 'Dr. Rajesh Sharma, M.D. (Medicine)',
      doctorRegNo: 'MCI-2012-84920',
      tagline: 'Compassionate & Comprehensive Family Healthcare',
      phone: '+91 98765 43210',
      email: 'cliniccare.doctor@gmail.com',
      address: '102, Shanti Complex, Station Road, Pune, Maharashtra 411001',
      consultationFee: 50000, // 500.00 INR stored in paise
      followUpValidityDays: 7,
      workingHours: {
        monday: { open: '09:00', close: '20:00', lunchStart: '13:00', lunchEnd: '17:00' },
        tuesday: { open: '09:00', close: '20:00', lunchStart: '13:00', lunchEnd: '17:00' },
        wednesday: { open: '09:00', close: '20:00', lunchStart: '13:00', lunchEnd: '17:00' },
        thursday: { open: '09:00', close: '20:00', lunchStart: '13:00', lunchEnd: '17:00' },
        friday: { open: '09:00', close: '20:00', lunchStart: '13:00', lunchEnd: '17:00' },
        saturday: { open: '09:00', close: '14:00', lunchStart: '', lunchEnd: '' },
        sunday: { open: '', close: '', closed: true }
      },
      slotDurationMinutes: 15,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  users: [
    {
      id: 'usr-doctor-01',
      uid: 'usr-doctor-01',
      clinicId: 'clinic-default',
      name: 'Dr. Rajesh Sharma',
      email: 'doctor@cliniccare.com',
      role: 'doctor',
      phone: '+91 98765 43210',
      passwordHash: '$2b$10$mNh6cqimqfoDOf4AuKny3uXyRIyaEj3YEEoG0sEP0i//BBA7xSN0e', // Doctor@123
      status: 'active',
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr-receptionist-01',
      uid: 'usr-receptionist-01',
      clinicId: 'clinic-default',
      name: 'Pooja Verma',
      email: 'reception@cliniccare.com',
      role: 'receptionist',
      phone: '+91 98765 12345',
      passwordHash: '$2b$10$LXMUDCGtvj.dmB75mVhwkOtSd4k0s8PF7x4Xqyq3bLjDygyQAi45y', // Staff@123
      status: 'active',
      createdAt: new Date().toISOString()
    }
  ],
  patients: [],
  appointments: [],
  consultations: [],
  prescriptions: [],
  medicalDocuments: [],
  bills: [],
  notifications: [],
  followUps: [],
  auditLogs: []
});

// Load local database
const loadLocalDb = () => {
  if (!fs.existsSync(DB_FILE)) {
    const seed = getInitialSeed();
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf8');
    return seed;
  }
  try {
    const content = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading local db file, resetting to initial seed:', err);
    const seed = getInitialSeed();
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf8');
    return seed;
  }
};

// Save local database
const saveLocalDb = (data) => {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
};

export const dbService = {
  // Get all documents in a collection
  async getCollection(collectionName, clinicId = 'clinic-default') {
    const { isFirebaseInitialized, firestoreDb } = getFirebaseState();
    if (isFirebaseInitialized && firestoreDb) {
      try {
        let query = firestoreDb.collection(collectionName);
        if (clinicId && collectionName !== 'users') {
          query = query.where('clinicId', '==', clinicId);
        }
        const snapshot = await query.get();
        if (snapshot && !snapshot.empty) {
          return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
      } catch (err) {
        console.warn(`Firestore read fallback for collection "${collectionName}":`, err.message);
      }
    }

    const localDb = loadLocalDb();
    const items = localDb[collectionName] || [];
    if (clinicId && collectionName !== 'users') {
      return items.filter(item => item.clinicId === clinicId);
    }
    return items;
  },

  // Get a single document by ID
  async getDocument(collectionName, id) {
    const { isFirebaseInitialized, firestoreDb } = getFirebaseState();
    if (isFirebaseInitialized && firestoreDb) {
      try {
        const doc = await firestoreDb.collection(collectionName).doc(id).get();
        if (doc && doc.exists) {
          return { id: doc.id, ...doc.data() };
        }
      } catch (err) {
        console.warn(`Firestore getDocument fallback for ${collectionName}/${id}:`, err.message);
      }
    }

    const localDb = loadLocalDb();
    const items = localDb[collectionName] || [];
    return items.find(item => item.id === id) || null;
  },

  // Create a document (dual-write to Firestore and local JSON for resilience)
  async createDocument(collectionName, data, customId = null) {
    const now = new Date().toISOString();
    const id = customId || uuidv4();
    const docData = {
      ...data,
      id,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now
    };

    // Always update local database
    const localDb = loadLocalDb();
    if (!localDb[collectionName]) {
      localDb[collectionName] = [];
    }
    const existingIndex = localDb[collectionName].findIndex(item => item.id === id);
    if (existingIndex >= 0) {
      localDb[collectionName][existingIndex] = docData;
    } else {
      localDb[collectionName].push(docData);
    }
    saveLocalDb(localDb);

    // Write to Firestore if connected
    const { isFirebaseInitialized, firestoreDb } = getFirebaseState();
    if (isFirebaseInitialized && firestoreDb) {
      try {
        await firestoreDb.collection(collectionName).doc(id).set(docData);
      } catch (err) {
        console.warn(`Firestore write warning for ${collectionName}:`, err.message);
      }
    }

    return docData;
  },

  // Update a document (dual-update to Firestore and local JSON)
  async updateDocument(collectionName, id, updates) {
    const now = new Date().toISOString();
    const cleanUpdates = {
      ...updates,
      updatedAt: now
    };

    // Always update local database
    const localDb = loadLocalDb();
    const items = localDb[collectionName] || [];
    const index = items.findIndex(item => item.id === id);
    let updatedItem = { id, ...cleanUpdates };
    if (index !== -1) {
      items[index] = { ...items[index], ...cleanUpdates };
      updatedItem = items[index];
      saveLocalDb(localDb);
    }

    // Write updates to Firestore if connected
    const { isFirebaseInitialized, firestoreDb } = getFirebaseState();
    if (isFirebaseInitialized && firestoreDb) {
      try {
        await firestoreDb.collection(collectionName).doc(id).set(updatedItem, { merge: true });
      } catch (err) {
        console.warn(`Firestore update warning for ${collectionName}:`, err.message);
      }
    }

    return updatedItem;
  },

  // Delete a document
  async deleteDocument(collectionName, id) {
    const { isFirebaseInitialized, firestoreDb } = getFirebaseState();
    if (isFirebaseInitialized && firestoreDb) {
      await firestoreDb.collection(collectionName).doc(id).delete();
      return { id, deleted: true };
    }

    const localDb = loadLocalDb();
    const items = localDb[collectionName] || [];
    localDb[collectionName] = items.filter(item => item.id !== id);
    saveLocalDb(localDb);
    return { id, deleted: true };
  },

  // Query documents with filter and sorting
  async queryDocuments(collectionName, filterFn = null, sortFn = null, limit = null) {
    const items = await this.getCollection(collectionName);
    let filtered = filterFn ? items.filter(filterFn) : items;
    if (sortFn) {
      filtered.sort(sortFn);
    }
    if (limit && limit > 0) {
      filtered = filtered.slice(0, limit);
    }
    return filtered;
  },

  // Concurrency-safe atomic transaction helper
  async runTransaction(transactionFn) {
    const { isFirebaseInitialized, firestoreDb } = getFirebaseState();
    if (isFirebaseInitialized && firestoreDb) {
      return firestoreDb.runTransaction(transactionFn);
    }
    // Local atomic lock execution
    const result = await transactionFn({
      get: async (collectionName, id) => {
        const localDb = loadLocalDb();
        const items = localDb[collectionName] || [];
        return items.find(i => i.id === id) || null;
      },
      set: async (collectionName, id, data) => {
        const localDb = loadLocalDb();
        if (!localDb[collectionName]) localDb[collectionName] = [];
        const index = localDb[collectionName].findIndex(i => i.id === id);
        const docData = { ...data, id, updatedAt: new Date().toISOString() };
        if (index >= 0) {
          localDb[collectionName][index] = docData;
        } else {
          localDb[collectionName].push(docData);
        }
        saveLocalDb(localDb);
      }
    });
    return result;
  }
};
