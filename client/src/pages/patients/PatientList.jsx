import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users,
  Search,
  UserPlus,
  AlertTriangle,
  Eye,
  Archive,
  Phone,
  Droplet,
  ChevronRight,
  Filter,
  Camera
} from 'lucide-react';
import { api } from '../../services/api.js';
import { Modal } from '../../components/common/Modal.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { formatDate, calculateAge } from '../../utils/formatters.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { PreviousPrescriptionsModal } from '../../components/prescriptions/PreviousPrescriptionsModal.jsx';
import {
  validateFullName,
  validateMobile,
  validateDateOfBirth,
  normalizeMobile
} from '../../utils/validators.js';
import {
  useFormInteraction,
  FieldFeedback,
  buildDescribedBy,
  getValidationInputClasses,
  focusFirstInvalidField
} from '../../components/common/ValidationFeedback.jsx';

export const PatientList = () => {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [gender, setGender] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [prevRxModalOpen, setPrevRxModalOpen] = useState(false);
  const [selectedPatientForRx, setSelectedPatientForRx] = useState(null);

  // Registration Modal state
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const regFormRef = useRef(null);
  const regInteraction = useFormInteraction();

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    dateOfBirth: '',
    gender: 'Male',
    mobileNumber: '',
    address: '',
    emergencyContact: '',
    bloodGroup: '',
    allergies: '',
    medicalHistory: ''
  });

  const { role } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const nameValidation = validateFullName(formData.fullName);
  const mobileValidation = validateMobile(formData.mobileNumber);
  const dobValidation = validateDateOfBirth(formData.dateOfBirth);

  const nameFieldState = regInteraction.getFieldState('fullName', nameValidation);
  const mobileFieldState = regInteraction.getFieldState('mobileNumber', mobileValidation);
  const dobFieldState = regInteraction.getFieldState('dateOfBirth', dobValidation);

  // Check query params if opened with ?action=new
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      regInteraction.resetInteraction();
      setIsRegisterModalOpen(true);
    }
  }, [searchParams]);

  const loadPatients = async () => {
    setIsLoading(true);
    try {
      const res = await api.patients.list({ search, bloodGroup, gender });
      setPatients(res.patients || []);
    } catch (err) {
      showToast('Failed to load patient records', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPatients();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, bloodGroup, gender]);

  // Duplicate Check on form inputs
  const handleCheckDuplicate = async (phone, name) => {
    const normalizedPhone = normalizeMobile(phone);
    if (normalizedPhone || (name && name.trim().length >= 3)) {
      try {
        const res = await api.patients.checkDuplicate({
          mobileNumber: normalizedPhone || phone,
          fullName: name
        });
        if (res.hasDuplicate) {
          setDuplicateWarning(res.duplicates[0]);
        } else {
          setDuplicateWarning(null);
        }
      } catch (err) {
        console.warn('Duplicate check error:', err);
      }
    } else {
      setDuplicateWarning(null);
    }
  };

  const handleInputChange = (field, value) => {
    const nextForm = { ...formData, [field]: value };
    setFormData(nextForm);

    if (field === 'mobileNumber' || field === 'fullName') {
      handleCheckDuplicate(
        field === 'mobileNumber' ? value : nextForm.mobileNumber,
        field === 'fullName' ? value : nextForm.fullName
      );
    }
  };

  const resetRegisterForm = () => {
    setFormData({
      fullName: '',
      dateOfBirth: '',
      gender: 'Male',
      mobileNumber: '',
      address: '',
      emergencyContact: '',
      bloodGroup: '',
      allergies: '',
      medicalHistory: ''
    });
    setDuplicateWarning(null);
    regInteraction.resetInteraction();
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    regInteraction.setSubmitted(true);

    if (!nameValidation.valid || !mobileValidation.valid || !dobValidation.valid) {
      const firstErr = nameValidation.error || mobileValidation.error || dobValidation.error;
      showToast(firstErr || 'Please fix the highlighted patient details', 'warning');
      focusFirstInvalidField(regFormRef.current);
      return;
    }

    setIsSubmitting(true);
    try {
      const newPatient = await api.patients.register({
        ...formData,
        fullName: formData.fullName.trim(),
        mobileNumber: mobileValidation.normalized || normalizeMobile(formData.mobileNumber)
      });
      showToast(`Patient ${newPatient.fullName} registered successfully! (ID: ${newPatient.patientId})`, 'success');
      setIsRegisterModalOpen(false);
      resetRegisterForm();
      loadPatients();
      navigate(`/${role}/patients/${newPatient.id}`);
    } catch (err) {
      showToast(err.message || 'Failed to register patient', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (patient) => {
    if (!window.confirm(`Are you sure you want to archive patient ${patient.fullName}? Medical history will be safely preserved.`)) {
      return;
    }
    try {
      await api.patients.archive(patient.id);
      showToast(`Patient ${patient.fullName} archived successfully`, 'success');
      loadPatients();
    } catch (err) {
      showToast(err.message || 'Failed to archive patient record', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">Patient Directory</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Search, register, and manage digitized medical profiles.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            resetRegisterForm();
            setIsRegisterModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm shadow-md transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Register New Patient
        </button>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="search"
            placeholder="Search by Patient Name, Phone or ID (e.g. CC-2026-0001)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={bloodGroup}
            onChange={(e) => setBloodGroup(e.target.value)}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Blood Groups</option>
            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
              <option key={bg} value={bg}>{bg}</option>
            ))}
          </select>

          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      {/* Patients Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <LoadingSpinner message="Searching patient records..." />
        ) : patients.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No patients found"
            description="No patient records matched your search query. You can add a new patient record now."
            actionText="Register New Patient"
            onAction={() => setIsRegisterModalOpen(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Patient ID</th>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Age / Gender</th>
                  <th className="py-3 px-4">Mobile</th>
                  <th className="py-3 px-4">Blood Group</th>
                  <th className="py-3 px-4">Allergies</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {patients.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-xs text-brand-700 whitespace-nowrap">
                      {p.patientId}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{p.fullName}</div>
                      {p.address && <div className="text-xs text-slate-400 truncate max-w-xs">{p.address}</div>}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                      {p.dateOfBirth ? `${calculateAge(p.dateOfBirth)} Yrs` : 'N/A'} • {p.gender}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 whitespace-nowrap">
                      {p.mobileNumber}
                    </td>
                    <td className="py-3 px-4">
                      {p.bloodGroup ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <Droplet className="w-3 h-3 fill-current text-rose-500" />
                          {p.bloodGroup}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Unspecified</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 max-w-xs truncate">
                      {p.allergies ? (
                        <span className="text-amber-700 font-semibold">{p.allergies}</span>
                      ) : (
                        <span className="text-slate-400">None reported</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPatientForRx(p);
                          setPrevRxModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 transition-colors"
                        title="View or photograph past prescriptions"
                      >
                        <Camera className="w-3.5 h-3.5 text-teal-600" />
                        Prev Rx
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate(`/${role}/patients/${p.id}`)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Profile
                      </button>
                      {role === 'doctor' && (
                        <button
                          type="button"
                          onClick={() => handleArchive(p)}
                          title="Archive Patient"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register Patient Modal with Duplicate Detection Banner */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => {
          setIsRegisterModalOpen(false);
          regInteraction.resetInteraction();
        }}
        title="Register New Patient Record"
        maxWidth="max-w-2xl"
      >
        <form ref={regFormRef} noValidate onSubmit={handleRegister} className="space-y-4">
          {duplicateWarning && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Potential Duplicate Patient Detected:</strong>
                <p className="mt-0.5">
                  A patient named <span className="font-bold">{duplicateWarning.fullName}</span> with phone <span className="font-bold">{duplicateWarning.mobileNumber}</span> is already registered (ID: {duplicateWarning.patientId}).
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterModalOpen(false);
                    navigate(`/${role}/patients/${duplicateWarning.id}`);
                  }}
                  className="mt-2 text-xs font-bold text-brand-700 underline"
                >
                  Open Existing Profile Instead →
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="pl-reg-fullname" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Full Name *
              </label>
              <input
                id="pl-reg-fullname"
                type="text"
                required
                autoComplete="name"
                placeholder="e.g. Ramesh Kulkarni"
                value={formData.fullName}
                aria-invalid={nameFieldState.ariaInvalid}
                aria-describedby={buildDescribedBy({
                  errorId: 'pl-reg-fullname-error',
                  showError: nameFieldState.showError
                })}
                onChange={(e) => handleInputChange('fullName', e.target.value)}
                onBlur={() => regInteraction.markTouched('fullName', nameValidation, 'Full name')}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(
                  nameFieldState,
                  'border-slate-200 focus:border-brand-500 focus:ring-brand-500'
                )}`}
              />
              <FieldFeedback id="pl-reg-fullname-error" state={nameFieldState} />
            </div>

            <div>
              <label htmlFor="pl-reg-mobile" className="block text-xs font-bold text-slate-700 uppercase mb-0.5">
                Mobile Number *
              </label>
              <p id="pl-reg-mobile-hint" className="text-[11px] text-slate-500 mb-1">
                10-digit Indian mobile starting with 6–9 (e.g. 9822012345)
              </p>
              <input
                id="pl-reg-mobile"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={14}
                required
                placeholder="9822012345"
                value={formData.mobileNumber}
                aria-invalid={mobileFieldState.ariaInvalid}
                aria-describedby={buildDescribedBy({
                  hintId: 'pl-reg-mobile-hint',
                  errorId: 'pl-reg-mobile-error',
                  showError: mobileFieldState.showError
                })}
                onChange={(e) => handleInputChange('mobileNumber', e.target.value)}
                onBlur={() => regInteraction.markTouched('mobileNumber', mobileValidation, 'Mobile number')}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(
                  mobileFieldState,
                  'border-slate-200 focus:border-brand-500 focus:ring-brand-500'
                )}`}
              />
              <FieldFeedback id="pl-reg-mobile-error" state={mobileFieldState} />
            </div>

            <div>
              <label htmlFor="pl-reg-dob" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Date of Birth
              </label>
              <input
                id="pl-reg-dob"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={formData.dateOfBirth}
                aria-invalid={dobFieldState.ariaInvalid}
                aria-describedby={buildDescribedBy({
                  errorId: 'pl-reg-dob-error',
                  showError: dobFieldState.showError
                })}
                onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                onBlur={() => regInteraction.markTouched('dateOfBirth', dobValidation, 'Date of birth')}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(
                  dobFieldState,
                  'border-slate-200 focus:border-brand-500 focus:ring-brand-500'
                )}`}
              />
              <FieldFeedback id="pl-reg-dob-error" state={dobFieldState} />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Gender *
              </label>
              <select
                value={formData.gender}
                onChange={(e) => handleInputChange('gender', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-brand-500"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Blood Group (Optional)
              </label>
              <select
                value={formData.bloodGroup}
                onChange={(e) => handleInputChange('bloodGroup', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Unknown / Not Tested</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Emergency Contact
              </label>
              <input
                type="text"
                placeholder="Name & Contact (e.g. Spouse: 9812345678)"
                value={formData.emergencyContact}
                onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Residential Address
              </label>
              <input
                type="text"
                placeholder="Street address, City, Pin Code"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Known Drug Allergies
              </label>
              <input
                type="text"
                placeholder="e.g. Penicillin, Sulfa drugs, NSAIDs"
                value={formData.allergies}
                onChange={(e) => handleInputChange('allergies', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Medical History (Past Surgeries, Hypertension, Diabetes, Thyroid)
              </label>
              <textarea
                rows="2"
                placeholder="e.g. Type 2 Diabetes since 5 yrs on Metformin, Appendectomy in 2018"
                value={formData.medicalHistory}
                onChange={(e) => handleInputChange('medicalHistory', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsRegisterModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Registering...' : 'Register Patient'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Previous Prescriptions & Camera Capture Modal */}
      {prevRxModalOpen && selectedPatientForRx && (
        <PreviousPrescriptionsModal
          isOpen={prevRxModalOpen}
          onClose={() => {
            setPrevRxModalOpen(false);
            setSelectedPatientForRx(null);
          }}
          patientId={selectedPatientForRx.id}
          patientName={selectedPatientForRx.fullName}
        />
      )}
    </div>
  );
};

