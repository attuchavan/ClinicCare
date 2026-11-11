# ClinicCare - Digital Clinic Management System

ClinicCare is a professional, responsive, and secure Digital Clinic Management System engineered specifically for a General Physician clinic. It replaces paper records, prescriptions, physical report archives, and appointment registers with a modern, digitized medical workflow.

---

## 1. System Architecture & Tech Stack

- **Frontend**: React.js 18, Vite, JavaScript, Tailwind CSS, React Router DOM v6, Lucide React icons.
- **Backend**: Node.js, Express.js, RESTful APIs, Helmet, CORS, Rate Limiting, Multer.
- **Database**: Firebase Cloud Firestore with automatic local fallback database for zero-friction setup and development.
- **Authentication**: Firebase Authentication with token verification via Firebase Admin SDK and role-based access control.
- **File Storage**: Firebase Storage with scoped clinic access rules and local multipart upload handler.
- **PDF Generation**: jsPDF & jsPDF-AutoTable for professional prescription and receipt printing.
- **Security**: Strict Firestore Security Rules (`firestore.rules`), Storage Rules (`storage.rules`), audit logging, input validation, and clinic data isolation.

---

## 2. User Roles & Permissions

| Feature / Module | Doctor | Receptionist | Patient (Public) |
|------------------|--------|--------------|------------------|
| **Patient Registration** | Full Access | Full Access | N/A |
| **Patient Demographics Edit** | Full Access | Demographics Only | N/A |
| **Medical History & Timeline** | Full Access | Restricted | N/A |
| **Clinical Consultations & Vitals** | Create & Edit | No Access (Forbidden) | N/A |
| **Prescription Builder & PDF** | Create & Approve | View & Print Only | N/A |
| **Document Uploads & Preview** | Full Access | Upload & View | N/A |
| **Document Archival / Delete** | Full Access | Forbidden | N/A |
| **OCR Prescription Verification** | Doctor Verification | Forbidden | N/A |
| **Appointments & Walk-ins** | Full Access | Full Access | Request Booking |
| **Billing & Receipt Generation** | Full Access | Collect Cash/UPI | N/A |
| **Financial & Income Reports** | Full Access | Forbidden | N/A |
| **Staff Provisioning & Settings** | Full Access | Forbidden | N/A |

---

## 3. Core Modules

1. **Authentication & RBAC**:
   - Secure session management with custom token verification.
   - Doctor provisions receptionist accounts; public staff registration is blocked.
   - Deactivate compromised or inactive staff accounts instantly.

2. **Patient Management**:
   - Unique sequential Patient ID generation (`CC-YYYY-XXXX`).
   - Duplicate detection warns on matching mobile number or name before record creation.
   - Demographic editing and archival preservation without destroying past medical history.

3. **Appointment Management & Calendar**:
   - Daily, weekly, and monthly appointment schedules.
   - Working hours and slot duration engine calculating dynamic available slots.
   - Concurrency-safe slot collision detection preventing double bookings.
   - Walk-in tokens and live status lifecycle (`requested` → `confirmed` → `checked-in` → `in-consultation` → `completed` → `cancelled` → `no-show`).

4. **Clinical Consultations**:
   - Comprehensive vitals logging (BP mmHg, Pulse bpm, Temp °F, SpO2 %, Weight kg).
   - Chief complaints, physical examination findings, clinical diagnosis, and doctor advice.
   - Auto-transitions appointments to completed and schedules follow-up visits.

5. **Digital Prescriptions**:
   - Multi-drug formulation with strength, dosage, route, frequency (1-0-1), duration, and instructions.
   - Quick medication presets for rapid physician entry.
   - Regulatory physician sign-off with MCI registration number.
   - Version history preservation: amended records archive previous versions instead of silently overwriting.
   - Pixel-perfect PDF generation and print formatting.

6. **Medical Document Management**:
   - Supports JPG, PNG, and PDF files up to 15MB.
   - Categorized archival (Blood reports, X-Rays, ECG, CT/MRI, Handwritten prescriptions).
   - In-app previewer and camera capture integration for physical paper scanning.

7. **Patient Medical Timeline**:
   - Unified chronological feed across registrations, consultations, prescriptions, reports, follow-ups, and receipts.
   - One-click category filters for rapid review of patient history.

8. **Billing & Income Collections**:
   - Financial calculations strictly in integer paise (e.g. ₹500.00 = 50000 paise).
   - Consultation fee + itemized extra services/tests.
   - Cash and UPI payment mode recording.
   - Official receipt generation (`REC-YYYYMMDD-XXXX`) and PDF receipt download.
   - Financial intelligence: today's collection, monthly revenue, and outstanding dues.

9. **Follow-up Management**:
   - Tracks due today, overdue, and upcoming patient reviews.
   - One-click WhatsApp reminder triggers.

10. **Notifications Architecture**:
    - Queue with idempotency key preventing duplicate dispatches.
    - Official Meta WhatsApp Business Cloud API architecture.

11. **OCR Handwritten Prescription Transcription**:
    - Machine extraction of candidate medicines and instructions.
    - Mandatory human-in-the-loop doctor verification protocol: OCR output cannot diagnose or automatically prescribe.

---

## 4. Setup & Running the Application

### Prerequisites
- Node.js `v18+` (Tested on `v22.16.0`)
- npm `v10+`

### Step 1: Install Dependencies
From the repository root:
```bash
npm run install:all
```

### Step 2: Configure Environment Variables
Copy example files:
```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

### Step 3: Firebase Configuration (Optional for Production)
- Place your Firebase Admin service account JSON file at `server/serviceAccountKey.json`, or populate `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` in `server/.env`.
- Deploy security rules:
  ```bash
  firebase deploy --only firestore:rules,storage
  ```
*Note: If Firebase credentials are not yet supplied, ClinicCare automatically operates in an internal Firestore-compatible local persistent mode (`server/data/cliniccare_db.json`), enabling immediate out-of-the-box development and testing with zero crashes.*

### Step 4: Run Development Servers
```bash
npm run dev
```
- Frontend will open at: `http://localhost:5173`
- Backend API will run at: `http://localhost:5000`
- Patient Public Booking: `http://localhost:5173/book`

---

## 5. Demo Credentials for Testing

| Role | Email | Password |
|------|-------|----------|
| **Doctor** | `doctor@cliniccare.com` | `Doctor@123` |
| **Receptionist** | `reception@cliniccare.com` | `Staff@123` |

*(Convenient one-click autofill buttons are also provided on the login page).*

