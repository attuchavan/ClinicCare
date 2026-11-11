import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.resolve(DATA_DIR, 'cliniccare_db.json');
const UPLOADS_DIR = path.resolve(__dirname, '../uploads/documents');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Helper to generate a clean sample prescription image/SVG
const createSamplePrescriptionFile = (fileName, doctorName, patientName, rxText) => {
  const filePath = path.join(UPLOADS_DIR, fileName);
  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="600" height="800" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="800" fill="#fdfbf7" stroke="#cbd5e1" stroke-width="2"/>
  <!-- Clinic Header -->
  <rect width="600" height="90" fill="#0f2744"/>
  <text x="30" y="42" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#ffffff">${doctorName}</text>
  <text x="30" y="65" font-family="Arial, sans-serif" font-size="12" fill="#38bdf8">M.B.B.S., M.D. (Medicine) • General Physician • Reg: MCI-2009-4182</text>
  <text x="570" y="45" font-family="Arial, sans-serif" font-size="11" fill="#cbd5e1" text-anchor="end">Phone: +91 98230 00111</text>
  <text x="570" y="65" font-family="Arial, sans-serif" font-size="10" fill="#94a3b8" text-anchor="end">Station Road, Sangli / Pune</text>
  
  <!-- Patient Header -->
  <rect x="25" y="110" width="550" height="60" rx="8" fill="#f1f5f9" stroke="#e2e8f0"/>
  <text x="40" y="135" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#1e293b">Patient: ${patientName}</text>
  <text x="40" y="155" font-family="Arial, sans-serif" font-size="11" fill="#64748b">Date: Previous Visit (Prescription Record)</text>
  <text x="550" y="145" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#0d9488" text-anchor="end">PREVIOUS RX</text>

  <!-- Rx symbol -->
  <text x="40" y="225" font-family="Georgia, serif" font-size="34" font-style="italic" font-weight="bold" fill="#0d9488">Rx</text>
  <line x1="40" y1="235" x2="560" y2="235" stroke="#cbd5e1" stroke-width="1.5"/>

  <!-- Medicines Content -->
  ${rxText}

  <!-- Footer -->
  <line x1="400" y1="720" x2="550" y2="720" stroke="#64748b" stroke-width="1.5"/>
  <text x="475" y="740" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#334155" text-anchor="middle">Dr. Signature</text>
  <text x="300" y="780" font-family="Arial, sans-serif" font-size="10" fill="#94a3b8" text-anchor="middle">Scan / Photo of original physical prescription</text>
</svg>`;

  fs.writeFileSync(filePath, svgContent, 'utf8');
};

export const seed10ClinicalCases = () => {
  console.log('🌱 Seeding 10 diverse Indian clinical cases with complete history...');

  // Create sample image files in uploads
  createSamplePrescriptionFile(
    'prev-rx-aarav.svg',
    'Dr. K. M. Mehta Clinic',
    'Aarav Deshmukh',
    `<text x="45" y="270" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0f172a">1. Tab Telmisartan 40mg</text>
     <text x="65" y="290" font-family="Arial, sans-serif" font-size="11" fill="#475569">Dosage: 1-0-0 (Morning after breakfast) x 30 Days</text>
     <text x="45" y="330" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0f172a">2. Tab Atorvastatin 10mg</text>
     <text x="65" y="350" font-family="Arial, sans-serif" font-size="11" fill="#475569">Dosage: 0-0-1 (Night at bedtime) x 30 Days</text>
     <text x="45" y="390" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0f172a">3. Low salt, low oil diet. Daily 30 min brisk walk.</text>`
  );

  createSamplePrescriptionFile(
    'prev-rx-sunita.svg',
    'Dr. V. N. Joshi Diabetes Care',
    'Sunita Patil',
    `<text x="45" y="270" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0f172a">1. Tab Glycomet-GP 1 (Metformin 500 + Glimepiride 1)</text>
     <text x="65" y="290" font-family="Arial, sans-serif" font-size="11" fill="#475569">Dosage: 1-0-0 (15 mins before breakfast) x 30 Days</text>
     <text x="45" y="330" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0f172a">2. Cap Neurobion Forte (Vit B-Complex)</text>
     <text x="65" y="350" font-family="Arial, sans-serif" font-size="11" fill="#475569">Dosage: 0-0-1 (Night after food) x 30 Days for tingling</text>
     <text x="45" y="390" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0f172a">3. Check Fasting & PP Blood Sugar every 15 days.</text>`
  );

  createSamplePrescriptionFile(
    'prev-rx-suresh.svg',
    'Apollo Life Heart Clinic',
    'Suresh Gaikwad',
    `<text x="45" y="270" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0f172a">1. Tab Ecosprin 75mg</text>
     <text x="65" y="290" font-family="Arial, sans-serif" font-size="11" fill="#475569">Dosage: 0-1-0 (After lunch) x 30 Days</text>
     <text x="45" y="330" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0f172a">2. Tab Rosuvas 20mg</text>
     <text x="65" y="350" font-family="Arial, sans-serif" font-size="11" fill="#475569">Dosage: 0-0-1 (Night after food) x 30 Days</text>
     <text x="45" y="390" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0f172a">3. Tab Metolar-XR 25mg (1-0-0)</text>`
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  // 10 Diverse Patient Profiles
  const patients = [
    {
      id: 'pat-001',
      clinicId: 'clinic-default',
      patientId: 'CC-2026-0001',
      fullName: 'Aarav Deshmukh',
      dateOfBirth: '1985-06-15',
      gender: 'Male',
      mobileNumber: '9822012345',
      address: 'Flat 402, Shivajinagar, Pune',
      bloodGroup: 'B+',
      allergies: 'Penicillin allergy',
      medicalHistory: 'Hypertension since 3 years, mild hyperlipidemia',
      status: 'active',
      createdAt: '2026-10-15T09:00:00.000Z'
    },
    {
      id: 'pat-002',
      clinicId: 'clinic-default',
      patientId: 'CC-2026-0002',
      fullName: 'Atharv Chavan',
      dateOfBirth: '2006-02-10',
      gender: 'Male',
      mobileNumber: '09657065330',
      address: 'Nagargojewadi, Bedag, Tal. Miraj, Dist. Sangli',
      bloodGroup: 'A+',
      allergies: 'Sulfa drugs',
      medicalHistory: 'Seasonal allergic rhinitis, frequent pharyngitis in winters',
      status: 'active',
      createdAt: '2026-10-20T10:30:00.000Z'
    },
    {
      id: 'pat-003',
      clinicId: 'clinic-default',
      patientId: 'CC-2026-0003',
      fullName: 'Sunita Patil',
      dateOfBirth: '1974-08-22',
      gender: 'Female',
      mobileNumber: '9823145678',
      address: 'Plot 12, Kothrud, Pune',
      bloodGroup: 'O+',
      allergies: 'None',
      medicalHistory: 'Type 2 Diabetes Mellitus since 6 years on oral hypoglycemics',
      status: 'active',
      createdAt: '2026-10-22T11:00:00.000Z'
    },
    {
      id: 'pat-004',
      clinicId: 'clinic-default',
      patientId: 'CC-2026-0004',
      fullName: 'Rajesh Kulkarni',
      dateOfBirth: '1961-03-12',
      gender: 'Male',
      mobileNumber: '9822345679',
      address: 'Near Ganpati Temple, Vishrambag, Sangli',
      bloodGroup: 'AB+',
      allergies: 'Aspirin / NSAID gastritis',
      medicalHistory: 'Bilateral knee osteoarthritis, chronic acid peptic disease',
      status: 'active',
      createdAt: '2026-10-25T09:15:00.000Z'
    },
    {
      id: 'pat-005',
      clinicId: 'clinic-default',
      patientId: 'CC-2026-0005',
      fullName: 'Priya Sharma',
      dateOfBirth: '1998-11-05',
      gender: 'Female',
      mobileNumber: '9821456780',
      address: 'A-203, Magarpatta City, Pune',
      bloodGroup: 'B-',
      allergies: 'None',
      medicalHistory: 'Migraine with visual aura triggered by stress / screen time',
      status: 'active',
      createdAt: '2026-10-28T14:00:00.000Z'
    },
    {
      id: 'pat-006',
      clinicId: 'clinic-default',
      patientId: 'CC-2026-0006',
      fullName: 'Vikram Joshi',
      dateOfBirth: '1992-07-19',
      gender: 'Male',
      mobileNumber: '9820567891',
      address: 'Chandan Nagar, Pune',
      bloodGroup: 'O-',
      allergies: 'None',
      medicalHistory: 'No chronic illness, occasional IBS episodes',
      status: 'active',
      createdAt: '2026-11-01T08:30:00.000Z'
    },
    {
      id: 'pat-007',
      clinicId: 'clinic-default',
      patientId: 'CC-2026-0007',
      fullName: 'Ananya Deshpande',
      dateOfBirth: '2018-04-14',
      gender: 'Female',
      mobileNumber: '9819678902',
      address: 'Brahmin Puri, Miraj',
      bloodGroup: 'A+',
      allergies: 'Dust & Pollen',
      medicalHistory: 'Childhood bronchial asthma, gets wheezing on weather change',
      status: 'active',
      createdAt: '2026-11-02T16:00:00.000Z'
    },
    {
      id: 'pat-008',
      clinicId: 'clinic-default',
      patientId: 'CC-2026-0008',
      fullName: 'Suresh Gaikwad',
      dateOfBirth: '1968-09-30',
      gender: 'Male',
      mobileNumber: '9818789013',
      address: 'Kupwad Road, Sangli',
      bloodGroup: 'B+',
      allergies: 'None',
      medicalHistory: 'Post-PTCA stent placed in 2022, hypertension, dyslipidemia',
      status: 'active',
      createdAt: '2026-11-03T10:00:00.000Z'
    },
    {
      id: 'pat-009',
      clinicId: 'clinic-default',
      patientId: 'CC-2026-0009',
      fullName: 'Meena Shinde',
      dateOfBirth: '1981-12-08',
      gender: 'Female',
      mobileNumber: '9817890124',
      address: 'Baner Road, Pune',
      bloodGroup: 'O+',
      allergies: 'Iodine contrast dye',
      medicalHistory: 'Hypothyroidism since 4 years, on regular Eltroxin',
      status: 'active',
      createdAt: '2026-11-03T11:30:00.000Z'
    },
    {
      id: 'pat-010',
      clinicId: 'clinic-default',
      patientId: 'CC-2026-0010',
      fullName: 'Amit Kadam',
      dateOfBirth: '2002-05-18',
      gender: 'Male',
      mobileNumber: '9816901235',
      address: 'Karve Nagar, Pune',
      bloodGroup: 'A-',
      allergies: 'None',
      medicalHistory: 'College athlete, no major medical history',
      status: 'active',
      createdAt: '2026-11-04T08:00:00.000Z'
    }
  ];

  // Consultations
  const consultations = [
    {
      id: 'con-001',
      clinicId: 'clinic-default',
      patientId: 'pat-001',
      patientName: 'Aarav Deshmukh',
      consultationDate: '2026-10-15',
      vitals: { bp: '148/94', pulse: '78', temperature: '98.4', weight: '74', spo2: '98' },
      symptoms: 'Mild occipital headache in morning, work stress, occasional palpitation',
      diagnosis: 'Essential Hypertension (Stage 1) with Grade 1 Dyslipidemia',
      doctorAdvice: 'Low sodium diet (<2g/day), brisk walking 40 mins/day, avoid tobacco',
      followUpDate: '2026-11-15',
      createdAt: '2026-10-15T09:15:00.000Z'
    },
    {
      id: 'con-002',
      clinicId: 'clinic-default',
      patientId: 'pat-002',
      patientName: 'Atharv Chavan',
      consultationDate: '2026-10-20',
      vitals: { bp: '118/76', pulse: '82', temperature: '99.8', weight: '65', spo2: '99' },
      symptoms: 'Throat irritation, painful swallowing, clear nasal discharge x 3 days',
      diagnosis: 'Acute Viral Pharyngitis with Upper Respiratory Infection',
      doctorAdvice: 'Warm saline gargle 3 times a day, drink warm water, avoid cold beverages',
      followUpDate: '2026-10-25',
      createdAt: '2026-10-20T10:45:00.000Z'
    },
    {
      id: 'con-003',
      clinicId: 'clinic-default',
      patientId: 'pat-003',
      patientName: 'Sunita Patil',
      consultationDate: '2026-10-22',
      vitals: { bp: '130/84', pulse: '76', temperature: '98.6', weight: '68', spo2: '98' },
      symptoms: 'Burning and tingling sensation in soles of feet (worse at night), mild thirst',
      diagnosis: 'Type 2 Diabetes Mellitus with Diabetic Peripheral Neuropathy',
      doctorAdvice: 'Strict diabetic diet, avoid sugar, inspect feet daily, wear soft footwear',
      followUpDate: '2026-11-22',
      createdAt: '2026-10-22T11:20:00.000Z'
    },
    {
      id: 'con-004',
      clinicId: 'clinic-default',
      patientId: 'pat-004',
      patientName: 'Rajesh Kulkarni',
      consultationDate: '2026-10-25',
      vitals: { bp: '136/82', pulse: '72', temperature: '98.2', weight: '78', spo2: '97' },
      symptoms: 'Both knee joints painful on standing and climbing stairs, morning stiffness for 15 mins',
      diagnosis: 'Bilateral Primary Osteoarthritis of Knees (Grade 2)',
      doctorAdvice: 'Quadriceps strengthening exercises, avoid squatting and sitting on floor, hot fomentation',
      followUpDate: '2026-11-10',
      createdAt: '2026-10-25T09:40:00.000Z'
    },
    {
      id: 'con-005',
      clinicId: 'clinic-default',
      patientId: 'pat-005',
      patientName: 'Priya Sharma',
      consultationDate: '2026-10-28',
      vitals: { bp: '112/74', pulse: '80', temperature: '98.4', weight: '54', spo2: '99' },
      symptoms: 'Right-sided pulsating headache since morning, visual flashing zig-zag lights, vomiting x 2',
      diagnosis: 'Classic Migraine with Visual Aura',
      doctorAdvice: 'Rest in a quiet dark room, stay well hydrated, maintain a headache trigger diary',
      followUpDate: '2026-11-12',
      createdAt: '2026-10-28T14:25:00.000Z'
    }
  ];

  // Prescriptions
  const prescriptions = [
    {
      id: 'rx-001',
      clinicId: 'clinic-default',
      patientId: 'pat-001',
      rxNumber: 'RX-2026-00001',
      prescriptionDate: '2026-10-15',
      diagnosis: 'Essential Hypertension with Dyslipidemia',
      medicines: [
        { name: 'Tab Telmisartan 40mg', strength: '40mg', dosage: '1-0-0', duration: '30 Days', instructions: 'After Breakfast' },
        { name: 'Tab Atorvastatin 10mg', strength: '10mg', dosage: '0-0-1', duration: '30 Days', instructions: 'After Dinner at Bedtime' }
      ],
      generalAdvice: 'Low salt, low cholesterol diet. Recheck BP after 30 days.',
      followUpDate: '2026-11-15',
      status: 'approved',
      createdAt: '2026-10-15T09:20:00.000Z'
    },
    {
      id: 'rx-002',
      clinicId: 'clinic-default',
      patientId: 'pat-002',
      rxNumber: 'RX-2026-00002',
      prescriptionDate: '2026-10-20',
      diagnosis: 'Acute Viral Pharyngitis',
      medicines: [
        { name: 'Tab Dolo 650mg', strength: '650mg', dosage: '1-0-1', duration: '5 Days', instructions: 'After food with warm water' },
        { name: 'Tab Montair-LC (Montelukast + Levocetirizine)', strength: '10/5mg', dosage: '0-0-1', duration: '7 Days', instructions: 'At Bedtime' },
        { name: 'Betadine 2% Gargle Solution', strength: '2%', dosage: '10ml', duration: '5 Days', instructions: 'Gargle with warm water 3 times a day' }
      ],
      generalAdvice: 'Warm fluids, steam inhalation, voice rest.',
      followUpDate: '2026-10-25',
      status: 'approved',
      createdAt: '2026-10-20T10:50:00.000Z'
    },
    {
      id: 'rx-003',
      clinicId: 'clinic-default',
      patientId: 'pat-003',
      rxNumber: 'RX-2026-00003',
      prescriptionDate: '2026-10-22',
      diagnosis: 'Type 2 Diabetes Mellitus with Peripheral Neuropathy',
      medicines: [
        { name: 'Tab Glycomet-GP 1', strength: 'Metformin 500 + Glimepiride 1', dosage: '1-0-0', duration: '30 Days', instructions: '15 mins before breakfast' },
        { name: 'Cap Neurobion Forte', strength: 'B-Complex', dosage: '0-0-1', duration: '30 Days', instructions: 'After Dinner' }
      ],
      generalAdvice: 'Strict diabetic diet. Daily foot inspection for cuts.',
      followUpDate: '2026-11-22',
      status: 'approved',
      createdAt: '2026-10-22T11:25:00.000Z'
    },
    {
      id: 'rx-004',
      clinicId: 'clinic-default',
      patientId: 'pat-004',
      rxNumber: 'RX-2026-00004',
      prescriptionDate: '2026-10-25',
      diagnosis: 'Bilateral Primary Osteoarthritis of Knees',
      medicines: [
        { name: 'Tab Hifenac-P (Aceclofenac + Paracetamol)', strength: '100/325mg', dosage: '1-0-1', duration: '5 Days', instructions: 'Strictly after food' },
        { name: 'Cap Pan-D (Pantoprazole + Domperidone)', strength: '40/30mg', dosage: '1-0-0', duration: '7 Days', instructions: '30 mins before breakfast' },
        { name: 'Tab Shelcal 500 (Calcium + Vit D3)', strength: '500mg', dosage: '0-1-0', duration: '30 Days', instructions: 'After lunch' }
      ],
      generalAdvice: 'Avoid sitting on floor. Ice pack application for 15 mins twice daily.',
      followUpDate: '2026-11-10',
      status: 'approved',
      createdAt: '2026-10-25T09:45:00.000Z'
    },
    {
      id: 'rx-005',
      clinicId: 'clinic-default',
      patientId: 'pat-005',
      rxNumber: 'RX-2026-00005',
      prescriptionDate: '2026-10-28',
      diagnosis: 'Migraine with Visual Aura',
      medicines: [
        { name: 'Tab Rizact 10mg (Rizatriptan)', strength: '10mg', dosage: 'SOS', duration: '3 Tabs', instructions: 'Take 1 tab immediately at onset of headache/aura' },
        { name: 'Tab Domstal (Domperidone)', strength: '10mg', dosage: '1-0-0', duration: '3 Days', instructions: 'Before food for nausea' },
        { name: 'Tab Naprosyn 500mg', strength: '500mg', dosage: '1-0-1', duration: '3 Days', instructions: 'After food' }
      ],
      generalAdvice: 'Dark quiet room rest. Avoid skipping meals and bright screens.',
      followUpDate: '2026-11-12',
      status: 'approved',
      createdAt: '2026-10-28T14:30:00.000Z'
    }
  ];

  // Previous Prescription Photos & Documents
  const medicalDocuments = [
    {
      id: 'doc-001',
      clinicId: 'clinic-default',
      patientId: 'pat-001',
      patientName: 'Aarav Deshmukh',
      title: 'Previous Prescription (Dr. K. M. Mehta Clinic)',
      category: 'Previous Prescription',
      originalDocumentDate: '2026-09-10',
      doctorName: 'Dr. K. M. Mehta',
      prescribedMedicines: 'Tab Telmisartan 40mg, Tab Atorvastatin 10mg',
      notes: 'Previous cardiologist prescription showing baseline blood pressure 150/96 mmHg',
      fileName: 'prev-rx-aarav.svg',
      originalName: 'Dr_Mehta_Rx_Sept2026.svg',
      mimeType: 'image/svg+xml',
      fileSize: 2048,
      fileUrl: '/api/documents/file/prev-rx-aarav.svg',
      isManualEntry: false,
      isArchived: false,
      uploadedBy: 'usr-doctor-01',
      uploadedByName: 'Dr. Rajesh Sharma',
      uploadedByRole: 'doctor',
      createdAt: '2026-10-15T09:05:00.000Z'
    },
    {
      id: 'doc-002',
      clinicId: 'clinic-default',
      patientId: 'pat-003',
      patientName: 'Sunita Patil',
      title: 'Previous Diabetes Prescription (Joshi Diabetes Care)',
      category: 'Previous Prescription',
      originalDocumentDate: '2026-09-20',
      doctorName: 'Dr. V. N. Joshi',
      prescribedMedicines: 'Tab Glycomet-GP 1, Cap Neurobion Forte',
      notes: 'HbA1c was 8.2% on last test. Fasting sugar was 168 mg/dL.',
      fileName: 'prev-rx-sunita.svg',
      originalName: 'Joshi_Diabetic_Rx_Sept2026.svg',
      mimeType: 'image/svg+xml',
      fileSize: 2200,
      fileUrl: '/api/documents/file/prev-rx-sunita.svg',
      isManualEntry: false,
      isArchived: false,
      uploadedBy: 'usr-receptionist-01',
      uploadedByName: 'Pooja Verma',
      uploadedByRole: 'receptionist',
      createdAt: '2026-10-22T11:05:00.000Z'
    },
    {
      id: 'doc-003',
      clinicId: 'clinic-default',
      patientId: 'pat-008',
      patientName: 'Suresh Gaikwad',
      title: 'Post-Angioplasty Hospital Prescription (Apollo Heart)',
      category: 'Previous Prescription',
      originalDocumentDate: '2026-08-15',
      doctorName: 'Dr. A. S. Patil (Interventional Cardiologist)',
      prescribedMedicines: 'Tab Ecosprin 75mg, Tab Rosuvas 20mg, Tab Metolar-XR 25',
      notes: 'Discharge prescription post DES Stent in LAD.',
      fileName: 'prev-rx-suresh.svg',
      originalName: 'Apollo_Cardiac_Discharge_Rx.svg',
      mimeType: 'image/svg+xml',
      fileSize: 2150,
      fileUrl: '/api/documents/file/prev-rx-suresh.svg',
      isManualEntry: false,
      isArchived: false,
      uploadedBy: 'usr-doctor-01',
      uploadedByName: 'Dr. Rajesh Sharma',
      uploadedByRole: 'doctor',
      createdAt: '2026-11-03T10:05:00.000Z'
    },
    {
      id: 'doc-004',
      clinicId: 'clinic-default',
      patientId: 'pat-002',
      patientName: 'Atharv Chavan',
      title: 'Previous Prescription (Sangli ENT Hospital)',
      category: 'Previous Prescription',
      originalDocumentDate: '2026-07-12',
      doctorName: 'Dr. S. K. Kulkarni (ENT Specialist)',
      prescribedMedicines: 'Tab Cetirizine 10mg, Otrivin Nasal Drops, Paracetamol 650',
      notes: 'Handwritten prescription paper from ENT visit for severe allergic rhinitis and sinusitis',
      fileName: 'prev-rx-aarav.svg',
      originalName: 'ENT_Sangli_Prescription.svg',
      mimeType: 'image/svg+xml',
      fileSize: 1980,
      fileUrl: '/api/documents/file/prev-rx-aarav.svg',
      isManualEntry: false,
      isArchived: false,
      uploadedBy: 'usr-receptionist-01',
      uploadedByName: 'Pooja Verma',
      uploadedByRole: 'receptionist',
      createdAt: '2026-10-20T10:35:00.000Z'
    },
    {
      id: 'doc-005',
      clinicId: 'clinic-default',
      patientId: 'pat-007',
      patientName: 'Ananya Deshpande',
      title: 'Previous Pediatrician Prescription (Children Hospital)',
      category: 'Previous Prescription',
      originalDocumentDate: '2026-06-25',
      doctorName: 'Dr. Rekha Joshi (MD Pediatrics)',
      prescribedMedicines: 'Syr Asthalin 2.5ml TDS, Syr Montair-LC Kid, Nebulization with Duolin',
      notes: 'Emergency OPD prescription for acute asthmatic bronchospasm',
      fileName: 'prev-rx-sunita.svg',
      originalName: 'Pediatric_Asthma_Rx.svg',
      mimeType: 'image/svg+xml',
      fileSize: 2050,
      fileUrl: '/api/documents/file/prev-rx-sunita.svg',
      isManualEntry: false,
      isArchived: false,
      uploadedBy: 'usr-receptionist-01',
      uploadedByName: 'Pooja Verma',
      uploadedByRole: 'receptionist',
      createdAt: '2026-11-02T16:05:00.000Z'
    }
  ];

  // Appointments for Today's Live Queue (Waiting, In-Consultation, Scheduled)
  const appointments = [
    {
      id: 'apt-001',
      clinicId: 'clinic-default',
      patientId: 'pat-002',
      patientName: 'Atharv Chavan',
      patientPhone: '09657065330',
      date: todayStr,
      timeSlot: '09:00',
      reason: 'Follow-up for sore throat & cold symptoms',
      status: 'in-consultation',
      isWalkIn: false,
      bookedByRole: 'receptionist',
      createdAt: now
    },
    {
      id: 'apt-002',
      clinicId: 'clinic-default',
      patientId: 'pat-003',
      patientName: 'Sunita Patil',
      patientPhone: '9823145678',
      date: todayStr,
      timeSlot: '09:15',
      reason: 'Fasting blood sugar review & foot pain',
      status: 'checked-in',
      isWalkIn: false,
      bookedByRole: 'receptionist',
      createdAt: now
    },
    {
      id: 'apt-003',
      clinicId: 'clinic-default',
      patientId: 'pat-006',
      patientName: 'Vikram Joshi',
      patientPhone: '9820567891',
      date: todayStr,
      timeSlot: '09:30',
      reason: 'Severe stomach pain & loose motions (Emergency walk-in)',
      status: 'checked-in',
      isWalkIn: true,
      bookedByRole: 'receptionist',
      createdAt: now
    },
    {
      id: 'apt-004',
      clinicId: 'clinic-default',
      patientId: 'pat-004',
      patientName: 'Rajesh Kulkarni',
      patientPhone: '9822345679',
      date: todayStr,
      timeSlot: '09:45',
      reason: 'Knee joint pain & prescription refill',
      status: 'confirmed',
      isWalkIn: false,
      bookedByRole: 'patient',
      createdAt: now
    },
    {
      id: 'apt-005',
      clinicId: 'clinic-default',
      patientId: 'pat-005',
      patientName: 'Priya Sharma',
      patientPhone: '9821456780',
      date: todayStr,
      timeSlot: '10:00',
      reason: 'Migraine episode review',
      status: 'confirmed',
      isWalkIn: false,
      bookedByRole: 'patient',
      createdAt: now
    },
    {
      id: 'apt-006',
      clinicId: 'clinic-default',
      patientId: 'pat-007',
      patientName: 'Ananya Deshpande',
      patientPhone: '9819678902',
      date: todayStr,
      timeSlot: '10:15',
      reason: 'Childhood cough & wheezing checkup',
      status: 'confirmed',
      isWalkIn: false,
      bookedByRole: 'receptionist',
      createdAt: now
    },
    {
      id: 'apt-007',
      clinicId: 'clinic-default',
      patientId: 'pat-008',
      patientName: 'Suresh Gaikwad',
      patientPhone: '9818789013',
      date: todayStr,
      timeSlot: '10:30',
      reason: 'Cardiac routine review & BP check',
      status: 'confirmed',
      isWalkIn: false,
      bookedByRole: 'receptionist',
      createdAt: now
    },
    {
      id: 'apt-008',
      clinicId: 'clinic-default',
      patientId: 'pat-010',
      patientName: 'Amit Kadam',
      patientPhone: '9816901235',
      date: todayStr,
      timeSlot: '10:45',
      reason: 'Gym back spasm & pain',
      status: 'confirmed',
      isWalkIn: true,
      bookedByRole: 'receptionist',
      createdAt: now
    },
    {
      id: 'apt-009',
      clinicId: 'clinic-default',
      patientId: 'pat-001',
      patientName: 'Aarav Deshmukh',
      patientPhone: '9822012345',
      date: todayStr,
      timeSlot: '11:00',
      reason: 'BP follow-up check',
      status: 'completed',
      isWalkIn: false,
      bookedByRole: 'doctor',
      createdAt: now
    },
    {
      id: 'apt-010',
      clinicId: 'clinic-default',
      patientId: 'pat-009',
      patientName: 'Meena Shinde',
      patientPhone: '9817890124',
      date: todayStr,
      timeSlot: '11:15',
      reason: 'Thyroid report review & dose adjustment',
      status: 'confirmed',
      isWalkIn: false,
      bookedByRole: 'receptionist',
      createdAt: now
    }
  ];

  // Bills
  const bills = [
    {
      id: 'bill-001',
      clinicId: 'clinic-default',
      patientId: 'pat-001',
      patientName: 'Aarav Deshmukh',
      receiptNumber: 'REC-20261015-0001',
      consultationFee: 50000,
      additionalCharges: [],
      totalAmount: 50000,
      paidAmount: 50000,
      pendingAmount: 0,
      paymentMethod: 'upi',
      paymentStatus: 'paid',
      createdAt: '2026-10-15T09:25:00.000Z'
    },
    {
      id: 'bill-002',
      clinicId: 'clinic-default',
      patientId: 'pat-002',
      patientName: 'Atharv Chavan',
      receiptNumber: 'REC-20261020-0002',
      consultationFee: 50000,
      additionalCharges: [],
      totalAmount: 50000,
      paidAmount: 50000,
      pendingAmount: 0,
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      createdAt: '2026-10-20T10:55:00.000Z'
    },
    {
      id: 'bill-003',
      clinicId: 'clinic-default',
      patientId: 'pat-003',
      patientName: 'Sunita Patil',
      receiptNumber: 'REC-20261022-0003',
      consultationFee: 50000,
      additionalCharges: [{ item: 'Random Blood Sugar Test', amount: 10000 }],
      totalAmount: 60000,
      paidAmount: 60000,
      pendingAmount: 0,
      paymentMethod: 'upi',
      paymentStatus: 'paid',
      createdAt: '2026-10-22T11:30:00.000Z'
    }
  ];

  // Load existing DB or initialize
  let currentDb = {};
  if (fs.existsSync(DB_FILE)) {
    try {
      currentDb = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch { }
  }

  // Update DB with 10 test patients and their cases
  const updatedDb = {
    ...currentDb,
    clinicSettings: currentDb.clinicSettings || [
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
        consultationFee: 50000,
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
        createdAt: now,
        updatedAt: now
      }
    ],
    users: currentDb.users || [
      {
        id: 'usr-doctor-01',
        uid: 'usr-doctor-01',
        clinicId: 'clinic-default',
        name: 'Dr. Rajesh Sharma',
        email: 'doctor@cliniccare.com',
        role: 'doctor',
        phone: '+91 98765 43210',
        passwordHash: '$2b$10$mNh6cqimqfoDOf4AuKny3uXyRIyaEj3YEEoG0sEP0i//BBA7xSN0e',
        status: 'active',
        createdAt: now
      },
      {
        id: 'usr-receptionist-01',
        uid: 'usr-receptionist-01',
        clinicId: 'clinic-default',
        name: 'Pooja Verma',
        email: 'reception@cliniccare.com',
        role: 'receptionist',
        phone: '+91 98765 12345',
        passwordHash: '$2b$10$LXMUDCGtvj.dmB75mVhwkOtSd4k0s8PF7x4Xqyq3bLjDygyQAi45y',
        status: 'active',
        createdAt: now
      }
    ],
    patients,
    consultations,
    prescriptions,
    medicalDocuments,
    appointments,
    bills
  };

  fs.writeFileSync(DB_FILE, JSON.stringify(updatedDb, null, 2), 'utf8');
  console.log(`✅ Successfully seeded:`);
  console.log(`   • ${patients.length} Patient Profiles (CC-2026-0001 to CC-2026-0010)`);
  console.log(`   • ${consultations.length} Clinical Consultations`);
  console.log(`   • ${prescriptions.length} Digital Prescriptions`);
  console.log(`   • ${medicalDocuments.length} Previous Prescription Documents & Photos`);
  console.log(`   • ${appointments.length} Appointments in Today's Queue`);
  console.log(`   • ${bills.length} Billing Receipts`);
};

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('seed-10-cases.js')) {
  seed10ClinicalCases();
}

