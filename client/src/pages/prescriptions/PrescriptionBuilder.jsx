import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileText,
  Plus,
  Trash2,
  Printer,
  Download,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import { api } from '../../services/api.js';
import { pdfService } from '../../services/pdfGenerator.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { formatDate } from '../../utils/formatters.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { PatientSearchSelect } from '../../components/patients/PatientSearchSelect.jsx';

// Common medicine presets for General Physician speed
const COMMON_MEDS = [
  { name: 'Paracetamol', strength: '650 mg', dosage: '1 Tab', route: 'Oral', frequency: '1-0-1', duration: '3 days', instructions: 'After food' },
  { name: 'Amoxicillin + Clavulanic Acid', strength: '625 mg', dosage: '1 Tab', route: 'Oral', frequency: '1-0-1', duration: '5 days', instructions: 'After food' },
  { name: 'Azithromycin', strength: '500 mg', dosage: '1 Tab', route: 'Oral', frequency: '1-0-0', duration: '3 days', instructions: '1 hr before food' },
  { name: 'Pantoprazole', strength: '40 mg', dosage: '1 Tab', route: 'Oral', frequency: '1-0-0', duration: '7 days', instructions: 'Empty stomach (morning)' },
  { name: 'Cetirizine', strength: '10 mg', dosage: '1 Tab', route: 'Oral', frequency: '0-0-1', duration: '5 days', instructions: 'At bedtime' },
  { name: 'Montelukast + Levocetirizine', strength: '10/5 mg', dosage: '1 Tab', route: 'Oral', frequency: '0-0-1', duration: '7 days', instructions: 'At bedtime' },
  { name: 'Metformin', strength: '500 mg', dosage: '1 Tab', route: 'Oral', frequency: '1-0-1', duration: '30 days', instructions: 'With or after meals' },
  { name: 'Telmisartan', strength: '40 mg', dosage: '1 Tab', route: 'Oral', frequency: '1-0-0', duration: '30 days', instructions: 'Morning after food' }
];

export const PrescriptionBuilder = () => {
  const [searchParams] = useSearchParams();
  const patientIdParam = searchParams.get('patientId') || '';
  const consultationIdParam = searchParams.get('consultationId') || '';
  const diagnosisParam = searchParams.get('diagnosis') || '';
  const adviceParam = searchParams.get('advice') || '';
  const followUpDateParam = searchParams.get('followUpDate') || '';

  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(patientIdParam);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const [diagnosis, setDiagnosis] = useState(diagnosisParam);
  const [generalAdvice, setGeneralAdvice] = useState(adviceParam);
  const [dietaryAdvice, setDietaryAdvice] = useState('');
  const [followUpDate, setFollowUpDate] = useState(followUpDateParam);

  const [medicines, setMedicines] = useState([
    {
      name: 'Paracetamol',
      strength: '650 mg',
      dosage: '1 Tab',
      route: 'Oral',
      frequency: '1-0-1',
      duration: '3 days',
      quantity: '6',
      instructions: 'After food'
    }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedPrescription, setSavedPrescription] = useState(null);

  const { clinic, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    api.patients.list({ limit: 500 })
      .then(res => setPatients(res.patients || []))
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (selectedPatientId) {
      api.patients.get(selectedPatientId)
        .then(p => setSelectedPatient(p))
        .catch(err => console.error(err));
    }
  }, [selectedPatientId]);

  const addMedicine = (preset = null) => {
    if (preset) {
      setMedicines([...medicines, { ...preset, quantity: '10' }]);
    } else {
      setMedicines([
        ...medicines,
        {
          name: '',
          strength: '',
          dosage: '1 Tab',
          route: 'Oral',
          frequency: '1-0-1',
          duration: '5 days',
          quantity: '10',
          instructions: 'After food'
        }
      ]);
    }
  };

  const removeMedicine = (index) => {
    if (medicines.length <= 1) {
      showToast('Prescription must contain at least one medicine', 'warning');
      return;
    }
    setMedicines(medicines.filter((_, i) => i !== index));
  };

  const updateMedicine = (index, field, value) => {
    const updated = [...medicines];
    updated[index][field] = value;
    setMedicines(updated);
  };

  const handleSaveAndApprove = async () => {
    if (!selectedPatientId) {
      showToast('Please select a patient', 'warning');
      return;
    }
    if (!diagnosis || !diagnosis.trim()) {
      showToast('Please enter a clinical diagnosis for the prescription', 'warning');
      return;
    }
    if (!medicines || medicines.length === 0) {
      showToast('Please prescribe at least one medicine before approving', 'warning');
      return;
    }
    const hasEmptyMeds = medicines.some(m => !m.name.trim());
    if (hasEmptyMeds) {
      showToast('Please specify the medicine name for all prescribed items', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const rx = await api.prescriptions.create({
        patientId: selectedPatientId,
        consultationId: consultationIdParam || null,
        diagnosis,
        medicines,
        generalAdvice,
        dietaryAdvice,
        followUpDate,
        status: 'approved'
      });

      setSavedPrescription(rx);
      showToast('Prescription approved and saved successfully!', 'success');
      // Trigger automatic PDF generation
      pdfService.generatePrescriptionPDF(rx, clinic);
    } catch (err) {
      showToast(err.message || 'Failed to save prescription', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print">
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-1"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight flex items-center gap-2">
            <FileText className="w-7 h-7 text-teal-600" />
            Digital Prescription Builder
          </h1>
          <p className="text-xs text-slate-500">
            Formulate multi-drug digital prescriptions with regulatory physician sign-off.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {savedPrescription && (
            <>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
              >
                <Printer className="w-4 h-4" /> Print
              </button>
              <button
                type="button"
                onClick={() => pdfService.generatePrescriptionPDF(savedPrescription, clinic)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-colors"
              >
                <Download className="w-4 h-4" /> Download PDF
              </button>
            </>
          )}

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSaveAndApprove}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-teal-600/30 disabled:opacity-50 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isSubmitting ? 'Signing...' : 'Approve & Generate PDF'}
          </button>
        </div>
      </div>

      {/* Patient & Diagnosis Information */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <PatientSearchSelect
              patients={patients}
              value={selectedPatientId}
              onChange={(id) => setSelectedPatientId(id)}
              label="Select Patient"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Clinical Diagnosis *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Acute Bronchitis / Hypertension"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-navy-900"
            />
          </div>
        </div>

        {selectedPatient?.allergies && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>Patient Drug Allergies: {selectedPatient.allergies}</span>
          </div>
        )}
      </div>

      {/* Quick Medication Chips */}
      <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200/60 no-print">
        <p className="text-xs font-bold text-slate-600 mb-2.5 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-teal-600" /> Quick Add Common Medications:
        </p>
        <div className="flex flex-wrap gap-2">
          {COMMON_MEDS.map(preset => (
            <button
              key={preset.name}
              type="button"
              onClick={() => addMedicine(preset)}
              className="px-2.5 py-1 bg-white hover:bg-teal-50 hover:border-teal-300 border border-slate-200 text-xs font-semibold text-slate-700 rounded-lg transition-colors"
            >
              + {preset.name} ({preset.strength})
            </button>
          ))}
        </div>
      </div>

      {/* Medicines Table Builder */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 no-print">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand-700 flex items-center gap-2">
            Rx Medicines ({medicines.length})
          </h2>
          <button
            type="button"
            onClick={() => addMedicine()}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg text-xs font-bold border border-brand-200 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Medicine
          </button>
        </div>

        <div className="space-y-4">
          {medicines.map((med, idx) => (
            <div key={idx} className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                  Item #{idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeMedicine(idx)}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                  title="Remove Medicine"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Medicine Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Paracetamol"
                    value={med.name}
                    onChange={(e) => updateMedicine(idx, 'name', e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Strength
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 650 mg"
                    value={med.strength}
                    onChange={(e) => updateMedicine(idx, 'strength', e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Dosage & Route
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1 Tab (Oral)"
                    value={med.dosage}
                    onChange={(e) => updateMedicine(idx, 'dosage', e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Frequency (M-A-N)
                  </label>
                  <select
                    value={med.frequency}
                    onChange={(e) => updateMedicine(idx, 'frequency', e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold"
                  >
                    <option value="1-0-1">1-0-1 (Twice daily)</option>
                    <option value="1-1-1">1-1-1 (Thrice daily)</option>
                    <option value="1-0-0">1-0-0 (Morning only)</option>
                    <option value="0-1-0">0-1-0 (Afternoon only)</option>
                    <option value="0-0-1">0-0-1 (Night / Bedtime)</option>
                    <option value="SOS / As needed">SOS / As needed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Duration
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 5 days"
                    value={med.duration}
                    onChange={(e) => updateMedicine(idx, 'duration', e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Specific Timing / Instructions
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. After food with warm water"
                    value={med.instructions}
                    onChange={(e) => updateMedicine(idx, 'instructions', e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Advice & Follow-up */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 no-print">
        <h2 className="text-sm font-bold uppercase tracking-wider text-brand-700">
          General Advice & Follow-up
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              General Doctor Advice
            </label>
            <textarea
              rows="2"
              placeholder="e.g. Take adequate rest. Complete the antibiotic course."
              value={generalAdvice}
              onChange={(e) => setGeneralAdvice(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Dietary Instructions
            </label>
            <textarea
              rows="2"
              placeholder="e.g. Avoid oily, spicy food. Drink at least 3 liters of water."
              value={dietaryAdvice}
              onChange={(e) => setDietaryAdvice(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Next Review / Follow-up Date
            </label>
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold"
            />
          </div>
        </div>
      </div>

      {/* Printable Area for Browser Printing (Only shown during window.print()) */}
      <div className="printable-area hidden print:block">
        <div className="border-b-2 border-slate-900 pb-4 mb-4 flex justify-between">
          <div>
            <h1 className="text-2xl font-bold">{clinic?.name || 'City Care Family Clinic'}</h1>
            <p className="text-sm">{clinic?.address} | Ph: {clinic?.phone}</p>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-bold">{clinic?.doctorName || 'Dr. Rajesh Sharma, M.D.'}</h2>
            <p className="text-xs">Reg No: {clinic?.doctorRegNo || 'MCI-2012-84920'}</p>
          </div>
        </div>

        <div className="bg-slate-100 p-3 rounded mb-4 text-xs flex justify-between">
          <div>Patient: <strong>{selectedPatient?.fullName}</strong> ({selectedPatient?.patientId})</div>
          <div>Age: {selectedPatient?.dateOfBirth ? `${new Date().getFullYear() - new Date(selectedPatient.dateOfBirth).getFullYear()} Yrs` : 'N/A'} / {selectedPatient?.gender}</div>
          <div>Date: {formatDate(new Date())}</div>
        </div>

        <div className="mb-4">
          <p className="text-sm font-bold">Diagnosis: {diagnosis}</p>
        </div>

        <h3 className="text-base font-bold text-teal-700 mb-2">Rx</h3>
        <table className="w-full text-xs border border-collapse mb-4">
          <thead>
            <tr className="bg-slate-100 border-b text-left">
              <th className="p-2">#</th>
              <th className="p-2">Medicine</th>
              <th className="p-2">Frequency</th>
              <th className="p-2">Duration</th>
              <th className="p-2">Instructions</th>
            </tr>
          </thead>
          <tbody>
            {medicines.map((m, i) => (
              <tr key={i} className="border-b">
                <td className="p-2">{i + 1}</td>
                <td className="p-2 font-bold">{m.name} {m.strength}</td>
                <td className="p-2">{m.frequency}</td>
                <td className="p-2">{m.duration}</td>
                <td className="p-2">{m.instructions}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {generalAdvice && <p className="text-xs mb-2"><strong>Advice:</strong> {generalAdvice}</p>}
        {followUpDate && <p className="text-xs mb-8"><strong>Follow-up on:</strong> {formatDate(followUpDate)}</p>}

        <div className="text-right mt-16 pt-4 border-t w-64 ml-auto">
          <p className="font-bold text-sm">{clinic?.doctorName || 'Dr. Rajesh Sharma'}</p>
          <p className="text-xs text-slate-500">Digitally Approved</p>
        </div>
      </div>
    </div>
  );
};

