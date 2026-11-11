import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initFirebase, getFirebaseState } from '../src/config/firebase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DB_FILE = path.resolve(__dirname, '../data/cliniccare_db.json');

const syncDataToFirestore = async () => {
  console.log('🔄 ClinicCare: Starting Cloud Firestore Data Synchronization...\n');

  // Initialize Firebase
  initFirebase();
  const { isFirebaseInitialized, firestoreDb, firebaseAuth } = getFirebaseState();

  if (!isFirebaseInitialized || !firestoreDb) {
    console.error('❌ Firebase connection could not be established.');
    console.error('\nTo connect to Firebase:');
    console.error('1. Go to Firebase Console -> Project Settings -> Service Accounts');
    console.error('2. Click "Generate new private key" to download your serviceAccountKey.json');
    console.error('3. Place serviceAccountKey.json in the project root or in the /server folder.');
    process.exit(1);
  }

  // 1. Provision Default Staff Accounts in Firebase Auth
  if (firebaseAuth) {
    console.log('🔐 Synchronizing Staff Accounts with Firebase Authentication...');
    const defaultStaff = [
      { email: 'doctor@cliniccare.com', password: 'Doctor@123', displayName: 'Dr. Rajesh Sharma' },
      { email: 'reception@cliniccare.com', password: 'Staff@123', displayName: 'Pooja Verma' }
    ];

    for (const staff of defaultStaff) {
      try {
        await firebaseAuth.getUserByEmail(staff.email);
        console.log(`   ✓ Staff account exists in Firebase Auth: ${staff.email}`);
      } catch (authErr) {
        if (authErr.code === 'auth/user-not-found') {
          await firebaseAuth.createUser({
            email: staff.email,
            password: staff.password,
            displayName: staff.displayName
          });
          console.log(`   ✅ Created staff login in Firebase Auth: ${staff.email}`);
        } else {
          console.warn(`   ⚠️ Auth check note for ${staff.email}:`, authErr.message);
        }
      }
    }
    console.log('');
  }

  // 2. Check Cloud Firestore Database Connectivity
  try {
    await firestoreDb.collection('clinicSettings').limit(1).get();
  } catch (dbErr) {
    if (dbErr.code === 5 || dbErr.message?.includes('NOT_FOUND')) {
      console.error('\n========================================================================');
      console.error('⚠️  ACTION REQUIRED: Cloud Firestore Database is not enabled yet!');
      console.error('========================================================================');
      console.error('Your serviceAccountKey.json and Firebase Auth are 100% connected,');
      console.error('but the Firestore Database has not been created yet in the Firebase Console.\n');
      console.error('👉 Please open this direct link to enable Firestore with 1 click:');
      console.error(`   https://console.firebase.google.com/project/${process.env.FIREBASE_PROJECT_ID || 'cliniccare-90255'}/firestore\n`);
      console.error('1. Click "Create database"');
      console.error('2. Select your location (e.g. asia-south1 / Mumbai) and click Next');
      console.error('3. Choose "Start in production mode" (or test mode) and click Create');
      console.error('4. Once created, run this sync command again:');
      console.error('   npm --prefix server run sync:firebase');
      console.error('========================================================================\n');
      process.exit(1);
    } else {
      console.error('Database connection test error:', dbErr);
      throw dbErr;
    }
  }

  if (!fs.existsSync(DB_FILE)) {
    console.error(`❌ Local database file not found at: ${DB_FILE}`);
    process.exit(1);
  }

  const localData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  const collections = Object.keys(localData);

  console.log(`📦 Found ${collections.length} collections in local database:`);
  collections.forEach(col => {
    console.log(`   • ${col}: ${localData[col]?.length || 0} records`);
  });
  console.log('\n🚀 Uploading records to Cloud Firestore...');

  let totalUploaded = 0;

  for (const collectionName of collections) {
    const items = localData[collectionName] || [];
    if (items.length === 0) continue;

    const BATCH_SIZE = 400; // Firestore max batch is 500
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const chunk = items.slice(i, i + BATCH_SIZE);
      const batch = firestoreDb.batch();

      for (const item of chunk) {
        const docId = item.id || item.uid || firestoreDb.collection(collectionName).doc().id;
        const docRef = firestoreDb.collection(collectionName).doc(docId);
        batch.set(docRef, { ...item, id: docId }, { merge: true });
      }

      await batch.commit();
      totalUploaded += chunk.length;
    }

    console.log(`  ✅ Synced collection: ${collectionName} (${items.length} documents)`);
  }

  console.log(`\n🎉 Successfully migrated ${totalUploaded} documents to Cloud Firestore!`);
  console.log('Your ClinicCare system is now running live on Cloud Firestore.');
  process.exit(0);
};

syncDataToFirestore().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

