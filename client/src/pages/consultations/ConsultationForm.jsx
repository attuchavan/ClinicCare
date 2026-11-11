import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Stethoscope,
  Activity,
  Heart,
  Thermometer,
  Gauge,
  Weight,
  Calendar,
  Save,
  FileText,
  ArrowLeft
} from 'lucide-react';
import { api } from '../../services/api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { PatientSearchSelect } from '../../components/patients/PatientSearchSelect.jsx';
import { validateVitalField, validateRequiredText, validateNotPastDate } from '../../utils/validators.js';
import {
  useFormInteraction,
  FieldFeedback,
  buildDescribedBy,
  getValidationInputClasses,
  focusFirstInvalidField
} from '../../components/common/ValidationFeedback.jsx';

export const ConsultationForm = () => {
  const [searchParams] = useSearchParams();
  const patientIdParam = searchParams.get('patientId') || '';
  const appointmentIdParam = searchParams.get('appointmentId') || '';
  const patientNameParam = searchParams.get('name') || '';

  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(patientIdParam);
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Form Fields
  const [vitals, setVitals] = useState({
    bp: '',
    pulse: '',
    temp: '',
    spo2: '',
    weight: ''
  });
  const [symptoms, setSymptoms] = useState('');
  const [examinationFindings, setExaminationFindings] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatmentNotes, setTreatmentNotes] = useState('');
  const [doctorAdvice, setDoctorAdvice] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const { showToast } = useToast();
  const formRef = useRef(null);
  const interaction = useFormInteraction();

  const bpValidation = validateVitalField('bp', vitals.bp);
  const pulseValidation = validateVitalField('pulse', vitals.pulse);
  const tempValidation = validateVitalField('temp', vitals.temp);
  const spo2Validation = validateVitalField('spo2', vitals.spo2);
  const weightValidation = validateVitalField('weight', vitals.weight);
  const diagnosisValidation = validateRequiredText(diagnosis, 'Clinical diagnosis', { min: 2, max: 1000 });
  const followUpValidation = validateNotPastDate(followUpDate, { required: false, label: 'Follow-up date' });

  const bpState = interaction.getFieldState('bp', bpValidation);
  const pulseState = interaction.getFieldState('pulse', pulseValidation);
  const tempState = interaction.getFieldState('temp', tempValidation);
  const spo2State = interaction.getFieldState('spo2', spo2Validation);
  const weightState = interaction.getFieldState('weight', weightValidation);
  const diagnosisState = interaction.getFieldState('diagnosis', diagnosisValidation);
  const followUpState = interaction.getFieldState('followUpDate', followUpValidation);

  useEffect(() => {
    api.patients.list({ limit: 500 })
      .then(res => setPatients(res.patients || []))
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (selectedPatientId) {
      api.patients.get(selectedPatientId)
        .then(data => setSelectedPatient(data))
        .catch(err => console.error(err));
    } else {
      setSelectedPatient(null);
    }
  }, [selectedPatientId]);

  const handleSubmit = async (e, proceedToPrescription = false) => {
    e.preventDefault();
    interaction.setSubmitted(true);

    if (!selectedPatientId) {
      showToast('Please select a patient for this consultation', 'warning');
      focusFirstInvalidField(formRef.current);
      return;
    }

    const vitalChecks = [bpValidation, pulseValidation, tempValidation, spo2Validation, weightValidation];
    const invalidVital = vitalChecks.find(v => !v.valid);
    if (invalidVital) {
      showToast(invalidVital.error || 'Please verify clinical vitals', 'warning');
      focusFirstInvalidField(formRef.current);
      return;
    }

    if (!diagnosisValidation.valid) {
      showToast(diagnosisValidation.error || 'Please enter a clinical diagnosis or provisional impression', 'warning');
      focusFirstInvalidField(formRef.current);
      return;
    }

    if (!followUpValidation.valid) {
      showToast(followUpValidation.error || 'Please choose a valid follow-up date', 'warning');
      focusFirstInvalidField(formRef.current);
      return;
    }

    setIsSubmitting(true);
    try {
      const consultation = await api.consultations.create({
        patientId: selectedPatientId,
        appointmentId: appointmentIdParam || null,
        vitals,
        symptoms,
        examinationFindings,
        diagnosis,
        treatmentNotes,
        doctorAdvice,
        followUpDate
      });

      showToast('Consultation recorded successfully!', 'success');

      if (proceedToPrescription) {
        navigate(`/doctor/prescriptions/new?patientId=${selectedPatientId}&consultationId=${consultation.id}&diagnosis=${encodeURIComponent(diagnosis)}&advice=${encodeURIComponent(doctorAdvice)}&followUpDate=${followUpDate}`);
      } else {
        navigate(`/doctor/patients/${selectedPatientId}`);
      }
    } catch (err) {
      showToast(err.message || 'Failed to save consultation', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-1"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight flex items-center gap-2">
            <Stethoscope className="w-7 h-7 text-brand-600" />
            Clinical Consultation Note
          </h1>
          <p className="text-xs text-slate-500">
            Record clinical signs, vitals, examination findings, and diagnosis.
          </p>
        </div>
      </div>

      <form ref={formRef} noValidate onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
        {/* Step 1: Patient Selection */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand-700 flex items-center gap-2">
            1. Patient Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <PatientSearchSelect
                patients={patients}
                value={selectedPatientId}
                onChange={(id) => setSelectedPatientId(id)}
                label="Select Patient"
                required
                invalid={interaction.submitted && !selectedPatientId}
                error={interaction.submitted && !selectedPatientId ? 'Please select a patient.' : ''}
              />
            </div>

            {selectedPatient && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800 block text-sm">{selectedPatient.fullName}</span>
                  <span className="text-slate-500">{selectedPatient.gender} • ID: {selectedPatient.patientId}</span>
                </div>
                {selectedPatient.allergies && (
                  <span className="text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200 font-semibold">
                    Allergies: {selectedPatient.allergies}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Patient Vitals */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand-700 flex items-center gap-2">
            <Activity className="w-4 h-4" /> 2. Clinical Vitals
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <label htmlFor="cf-bp" className="block text-xs font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5 text-rose-500" /> Blood Pressure
              </label>
              <input
                id="cf-bp"
                type="text"
                placeholder="120/80"
                value={vitals.bp}
                aria-invalid={bpState.ariaInvalid}
                aria-describedby={buildDescribedBy({ errorId: 'cf-bp-error', showError: bpState.showError })}
                onChange={(e) => setVitals({ ...vitals, bp: e.target.value })}
                onBlur={() => interaction.markTouched('bp', bpValidation, 'Blood pressure')}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(bpState)}`}
              />
              <span className="text-[10px] text-slate-400">mmHg</span>
              <FieldFeedback id="cf-bp-error" state={bpState} compact />
            </div>

            <div>
              <label htmlFor="cf-pulse" className="block text-xs font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 text-rose-500" /> Pulse Rate
              </label>
              <input
                id="cf-pulse"
                type="text"
                inputMode="numeric"
                placeholder="72"
                value={vitals.pulse}
                aria-invalid={pulseState.ariaInvalid}
                aria-describedby={buildDescribedBy({ errorId: 'cf-pulse-error', showError: pulseState.showError })}
                onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })}
                onBlur={() => interaction.markTouched('pulse', pulseValidation, 'Pulse rate')}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(pulseState)}`}
              />
              <span className="text-[10px] text-slate-400">bpm</span>
              <FieldFeedback id="cf-pulse-error" state={pulseState} compact />
            </div>

            <div>
              <label htmlFor="cf-temp" className="block text-xs font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
                <Thermometer className="w-3.5 h-3.5 text-amber-500" /> Temperature
              </label>
              <input
                id="cf-temp"
                type="text"
                inputMode="decimal"
                placeholder="98.6"
                value={vitals.temp}
                aria-invalid={tempState.ariaInvalid}
                aria-describedby={buildDescribedBy({ errorId: 'cf-temp-error', showError: tempState.showError })}
                onChange={(e) => setVitals({ ...vitals, temp: e.target.value })}
                onBlur={() => interaction.markTouched('temp', tempValidation, 'Temperature')}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(tempState)}`}
              />
              <span className="text-[10px] text-slate-400">°F</span>
              <FieldFeedback id="cf-temp-error" state={tempState} compact />
            </div>

            <div>
              <label htmlFor="cf-spo2" className="block text-xs font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-teal-500" /> SpO2
              </label>
              <input
                id="cf-spo2"
                type="text"
                inputMode="numeric"
                placeholder="98"
                value={vitals.spo2}
                aria-invalid={spo2State.ariaInvalid}
                aria-describedby={buildDescribedBy({ errorId: 'cf-spo2-error', showError: spo2State.showError })}
                onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
                onBlur={() => interaction.markTouched('spo2', spo2Validation, 'SpO2 saturation')}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(spo2State)}`}
              />
              <span className="text-[10px] text-slate-400">% saturation</span>
              <FieldFeedback id="cf-spo2-error" state={spo2State} compact />
            </div>

            <div>
              <label htmlFor="cf-weight" className="block text-xs font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
                <Weight className="w-3.5 h-3.5 text-indigo-500" /> Weight
              </label>
              <input
                id="cf-weight"
                type="text"
                inputMode="decimal"
                placeholder="68"
                value={vitals.weight}
                aria-invalid={weightState.ariaInvalid}
                aria-describedby={buildDescribedBy({ errorId: 'cf-weight-error', showError: weightState.showError })}
                onChange={(e) => setVitals({ ...vitals, weight: e.target.value })}
                onBlur={() => interaction.markTouched('weight', weightValidation, 'Weight')}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(weightState)}`}
              />
              <span className="text-[10px] text-slate-400">kg</span>
              <FieldFeedback id="cf-weight-error" state={weightState} compact />
            </div>
          </div>
        </div>

        {/* Step 3: Clinical Findings & Diagnosis */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand-700 flex items-center gap-2">
            3. Clinical Examination & Diagnosis
          </h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="cf-symptoms" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Chief Complaints / Symptoms
              </label>
              <textarea
                id="cf-symptoms"
                rows="2"
                placeholder="e.g. Dry cough x 4 days, mild fever in evenings, body ache"
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white"
              />
            </div>

            <div>
              <label htmlFor="cf-exam" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Physical Examination Findings
              </label>
              <textarea
                id="cf-exam"
                rows="2"
                placeholder="e.g. Throat congested, bilateral chest clear on auscultation, no lymphadenopathy"
                value={examinationFindings}
                onChange={(e) => setExaminationFindings(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white"
              />
            </div>

            <div>
              <label htmlFor="cf-diagnosis" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Diagnosis *
              </label>
              <input
                id="cf-diagnosis"
                type="text"
                required
                placeholder="e.g. Acute Viral Upper Respiratory Tract Infection (URTI)"
                value={diagnosis}
                aria-invalid={diagnosisState.ariaInvalid}
                aria-describedby={buildDescribedBy({
                  errorId: 'cf-diagnosis-error',
                  showError: diagnosisState.showError
                })}
                onChange={(e) => setDiagnosis(e.target.value)}
                onBlur={() => interaction.markTouched('diagnosis', diagnosisValidation, 'Clinical diagnosis')}
                className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm font-bold text-navy-900 focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(diagnosisState)}`}
              />
              <FieldFeedback id="cf-diagnosis-error" state={diagnosisState} />
            </div>

            <div>
              <label htmlFor="cf-treatment" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Treatment Notes & Plan
              </label>
              <textarea
                id="cf-treatment"
                rows="2"
                placeholder="e.g. Symptomatic management, adequate oral hydration, rest"
                value={treatmentNotes}
                onChange={(e) => setTreatmentNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cf-advice" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Doctor's Advice to Patient
                </label>
                <input
                  id="cf-advice"
                  type="text"
                  placeholder="e.g. Steam inhalation BD, drink warm fluids, avoid cold drinks"
                  value={doctorAdvice}
                  onChange={(e) => setDoctorAdvice(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white"
                />
              </div>

              <div>
                <label htmlFor="cf-followup" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Next Follow-up Due Date
                </label>
                <input
                  id="cf-followup"
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={followUpDate}
                  aria-invalid={followUpState.ariaInvalid}
                  aria-describedby={buildDescribedBy({
                    errorId: 'cf-followup-error',
                    showError: followUpState.showError
                  })}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  onBlur={() => interaction.markTouched('followUpDate', followUpValidation, 'Follow-up date')}
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm focus:bg-white font-medium focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(followUpState)}`}
                />
                <FieldFeedback id="cf-followup-error" state={followUpState} />
              </div>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Consultation Only
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={(e) => handleSubmit(e, true)}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-lg shadow-teal-600/30 transition-all flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Save & Write Prescription →
          </button>
        </div>
      </form>
    </div>
  );
};

