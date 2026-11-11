import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const saPath = path.resolve(__dirname, '../serviceAccountKey.json');
const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));

const app = admin.initializeApp({
  credential: admin.credential.cert(sa),
  projectId: sa.project_id
});

const db = getFirestore(app, 'default');
console.log('====================================================');
console.log('🔥 LIVE CLOUD FIRESTORE COLLECTIONS & DOCUMENT COUNTS:');
console.log('Project:', sa.project_id);
console.log('====================================================');

const collections = [
  'patients',
  'consultations',
  'prescriptions',
  'medicalDocuments',
  'appointments',
  'bills',
  'followUps',
  'users',
  'clinicSettings'
];

for (const col of collections) {
  const snap = await db.collection(col).get();
  console.log(`  • ${col.padEnd(20)}: ${snap.size} documents in Cloud Firestore`);
}

const samplePat = await db.collection('patients').limit(3).get();
console.log('\nSample Patients in Cloud Firestore:');
samplePat.docs.forEach(d => {
  const p = d.data();
  console.log(`  - ${p.patientId}: ${p.fullName} (${p.gender}) - History: ${p.medicalHistory}`);
});

process.exit(0);
