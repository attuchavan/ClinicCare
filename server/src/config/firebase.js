import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let isFirebaseInitialized = false;
let firestoreDb = null;
let firebaseAuth = null;
let firebaseStorage = null;

const resolveFirestoreInstance = (appInstance) => {
  const dbId = process.env.FIREBASE_DATABASE_ID || 'default';
  try {
    return getFirestore(appInstance, dbId);
  } catch (err) {
    try {
      return getFirestore(appInstance);
    } catch {
      return admin.firestore();
    }
  }
};

export const initFirebase = () => {
  if (process.env.CLINICCARE_USE_LOCAL_DB === 'true') {
    isFirebaseInitialized = false;
    firestoreDb = null;
    firebaseAuth = null;
    firebaseStorage = null;
    console.log('ℹ️ CLINICCARE_USE_LOCAL_DB=true set. Operating in isolated local data mode.');
    return { isFirebaseInitialized, firestoreDb, firebaseAuth, firebaseStorage };
  }

  if (admin.apps.length > 0) {
    isFirebaseInitialized = true;
    firestoreDb = resolveFirestoreInstance(admin.apps[0]);
    firebaseAuth = admin.auth();
    firebaseStorage = admin.storage();
    return { isFirebaseInitialized, firestoreDb, firebaseAuth, firebaseStorage };
  }

  // Check candidate locations for serviceAccountKey.json
  const candidatePaths = [
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ? path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH) : null,
    path.resolve(__dirname, '../../../serviceAccountKey.json'),
    path.resolve(process.cwd(), '../serviceAccountKey.json'),
    path.resolve(__dirname, '../../serviceAccountKey.json'),
    path.resolve(process.cwd(), 'serviceAccountKey.json'),
    path.resolve(process.cwd(), 'server/serviceAccountKey.json')
  ].filter(Boolean);

  let serviceAccountPath = null;
  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      serviceAccountPath = candidate;
      break;
    }
  }

  if (serviceAccountPath) {
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      const app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.appspot.com`
      });
      isFirebaseInitialized = true;
      firestoreDb = resolveFirestoreInstance(app);
      firebaseAuth = admin.auth();
      firebaseStorage = admin.storage();
      console.log(`✅ Firebase Admin SDK initialized successfully using: ${path.basename(serviceAccountPath)} (Project: ${serviceAccount.project_id})`);
    } catch (err) {
      console.warn('⚠️ Failed to initialize Firebase Admin from serviceAccountKey.json:', err.message);
    }
  } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
      const app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`
      });
      isFirebaseInitialized = true;
      firestoreDb = resolveFirestoreInstance(app);
      firebaseAuth = admin.auth();
      firebaseStorage = admin.storage();
      console.log(`✅ Firebase Admin SDK initialized successfully via environment variables (Project: ${process.env.FIREBASE_PROJECT_ID})`);
    } catch (err) {
      console.warn('⚠️ Failed to initialize Firebase Admin from env variables:', err.message);
    }
  } else {
    console.log('ℹ️ Firebase credentials not detected. Operating in Firestore-compatible local data mode.');
  }

  return { isFirebaseInitialized, firestoreDb, firebaseAuth, firebaseStorage };
};

export const getFirebaseState = () => ({
  isFirebaseInitialized,
  firestoreDb,
  firebaseAuth,
  firebaseStorage
});
