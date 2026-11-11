import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';

import { MainLayout } from './components/layout/MainLayout.jsx';
import { ProtectedRoute } from './components/layout/ProtectedRoute.jsx';

// Pages
import { Login } from './pages/auth/Login.jsx';
import { PublicBooking } from './pages/public/PublicBooking.jsx';

// Doctor Pages
import { DoctorDashboard } from './pages/doctor/DoctorDashboard.jsx';
import { PatientList } from './pages/patients/PatientList.jsx';
import { PatientProfile } from './pages/patients/PatientProfile.jsx';
import { AppointmentsPage } from './pages/appointments/AppointmentsPage.jsx';
import { ConsultationForm } from './pages/consultations/ConsultationForm.jsx';
import { PrescriptionBuilder } from './pages/prescriptions/PrescriptionBuilder.jsx';
import { CasePaper } from './pages/casepaper/CasePaper.jsx';
import { DocumentManager } from './pages/documents/DocumentManager.jsx';
import { BillingPage } from './pages/billing/BillingPage.jsx';
import { FollowUpsPage } from './pages/followups/FollowUpsPage.jsx';
import { StaffManagement } from './pages/doctor/StaffManagement.jsx';
import { ClinicSettings } from './pages/doctor/ClinicSettings.jsx';

// Receptionist Pages
import { ReceptionistDashboard } from './pages/receptionist/ReceptionistDashboard.jsx';

// Root redirector based on authentication and role
const HomeRedirect = () => {
  const { isAuthenticated, role, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={role === 'doctor' ? '/doctor' : '/receptionist'} replace />;
};

export const App = () => {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public Entry Points */}
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/book" element={<PublicBooking />} />

            {/* Doctor Protected Routes */}
            <Route element={<ProtectedRoute allowedRoles={['doctor']} />}>
              <Route element={<MainLayout />}>
                <Route path="/doctor" element={<DoctorDashboard />} />
                <Route path="/doctor/patients" element={<PatientList />} />
                <Route path="/doctor/patients/:id" element={<PatientProfile />} />
                <Route path="/doctor/appointments" element={<AppointmentsPage />} />
                <Route path="/doctor/case-paper" element={<CasePaper />} />
                <Route path="/doctor/consultations" element={<AppointmentsPage />} />
                <Route path="/doctor/consultations/new" element={<CasePaper />} />
                <Route path="/doctor/prescriptions/new" element={<CasePaper />} />
                <Route path="/doctor/documents" element={<DocumentManager />} />
                <Route path="/doctor/billing" element={<BillingPage />} />
                <Route path="/doctor/follow-ups" element={<FollowUpsPage />} />
                <Route path="/doctor/staff" element={<StaffManagement />} />
                <Route path="/doctor/settings" element={<ClinicSettings />} />
              </Route>
            </Route>

            {/* Receptionist Protected Routes */}
            <Route element={<ProtectedRoute allowedRoles={['receptionist']} />}>
              <Route element={<MainLayout />}>
                <Route path="/receptionist" element={<ReceptionistDashboard />} />
                <Route path="/receptionist/patients" element={<PatientList />} />
                <Route path="/receptionist/patients/:id" element={<PatientProfile />} />
                <Route path="/receptionist/appointments" element={<AppointmentsPage />} />
                <Route path="/receptionist/billing" element={<BillingPage />} />
                <Route path="/receptionist/documents" element={<DocumentManager />} />
              </Route>
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;

