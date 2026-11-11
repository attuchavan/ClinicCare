import React, { useState, useEffect, useRef } from 'react';
import {
  Receipt,
  Plus,
  Download,
  CreditCard,
  Banknote,
  Search,
  Filter,
  DollarSign,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api } from '../../services/api.js';
import { pdfService } from '../../services/pdfGenerator.js';
import { StatCard } from '../../components/common/StatCard.jsx';
import { Modal } from '../../components/common/Modal.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { formatCurrency, formatDate, getStatusBadgeStyle } from '../../utils/formatters.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { PatientSearchSelect } from '../../components/patients/PatientSearchSelect.jsx';
import { validateAmount } from '../../utils/validators.js';
import {
  useFormInteraction,
  FieldFeedback,
  buildDescribedBy,
  getValidationInputClasses,
  focusFirstInvalidField
} from '../../components/common/ValidationFeedback.jsx';

export const BillingPage = () => {
  const [bills, setBills] = useState([]);
  const [reports, setReports] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // New Bill Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [consultationFee, setConsultationFee] = useState(500); // INR
  const [additionalItems, setAdditionalItems] = useState([]);
  const [paidAmount, setPaidAmount] = useState(500);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Additional payment modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [activeBill, setActiveBill] = useState(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState('cash');

  const createBillFormRef = useRef(null);
  const payFormRef = useRef(null);
  const billInteraction = useFormInteraction();
  const payInteraction = useFormInteraction();

  const { role, clinic } = useAuth();
  const { showToast } = useToast();

  const totalCalculatedINR = Number(consultationFee || 0) + additionalItems.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const feeValidation = validateAmount(consultationFee, 'Consultation fee', { required: true, min: 0, max: 1000000 });
  const paidValidation = validateAmount(paidAmount, 'Amount paid', {
    required: true,
    min: 0,
    max: Math.max(0, totalCalculatedINR)
  });
  const activePendingRupees = activeBill?.pendingAmount ? Number((activeBill.pendingAmount / 100).toFixed(2)) : 100000;
  const duePayValidation = validateAmount(payAmount, 'Payment amount', {
    required: true,
    min: 1,
    max: activePendingRupees
  });

  const feeState = billInteraction.getFieldState('consultationFee', feeValidation);
  const paidState = billInteraction.getFieldState('paidAmount', paidValidation);
  const duePayState = payInteraction.getFieldState('payAmount', duePayValidation);

  const loadBillingData = async () => {
    setIsLoading(true);
    try {
      const [billList, rep] = await Promise.all([
        api.billing.list({ ...(statusFilter && { paymentStatus: statusFilter }) }),
        role === 'doctor' ? api.billing.getReports() : Promise.resolve(null)
      ]);
      setBills(billList || []);
      setReports(rep);
    } catch (err) {
      showToast('Failed to load billing records', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBillingData();
  }, [statusFilter]);

  useEffect(() => {
    if (isCreateModalOpen) {
      api.patients.list({ limit: 500 })
        .then(res => setPatients(res.patients || []))
        .catch(err => console.error(err));
    }
  }, [isCreateModalOpen]);

  const addExtraCharge = () => {
    setAdditionalItems([...additionalItems, { item: '', amount: 100 }]);
  };

  const removeExtraCharge = (index) => {
    setAdditionalItems(additionalItems.filter((_, i) => i !== index));
  };

  const updateExtraCharge = (index, field, val) => {
    const list = [...additionalItems];
    list[index][field] = val;
    setAdditionalItems(list);
  };

  const handleCreateBill = async (e) => {
    e.preventDefault();
    billInteraction.setSubmitted(true);

    if (!selectedPatientId) {
      showToast('Please select a patient', 'warning');
      focusFirstInvalidField(createBillFormRef.current);
      return;
    }

    const invalidExtra = additionalItems.find(i => !validateAmount(i.amount, 'Extra charge amount', { required: true, min: 0, max: 1000000 }).valid);
    if (!feeValidation.valid || !paidValidation.valid || invalidExtra) {
      showToast(feeValidation.error || paidValidation.error || 'Please verify bill fee and payment amounts', 'warning');
      focusFirstInvalidField(createBillFormRef.current);
      return;
    }

    setIsSubmitting(true);
    try {
      const newBill = await api.billing.create({
        patientId: selectedPatientId,
        consultationFee: Math.round(Number(consultationFee) * 100),
        additionalCharges: additionalItems.map(i => ({
          item: i.item || 'Additional Charge',
          amount: Math.round(Number(i.amount) * 100)
        })),
        paidAmount: Math.round(Number(paidAmount) * 100),
        paymentMethod,
        notes
      });

      showToast(`Receipt #${newBill.receiptNumber} generated!`, 'success');
      setIsCreateModalOpen(false);
      setSelectedPatientId('');
      setAdditionalItems([]);
      billInteraction.resetInteraction();
      loadBillingData();
      pdfService.generateReceiptPDF(newBill, clinic);
    } catch (err) {
      showToast(err.message || 'Failed to create bill', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    payInteraction.setSubmitted(true);
    if (!duePayValidation.valid) {
      showToast(duePayValidation.error || 'Please enter a valid payment amount', 'warning');
      focusFirstInvalidField(payFormRef.current);
      return;
    }

    try {
      await api.billing.recordPayment(activeBill.id, {
        amount: Math.round(Number(payAmount) * 100),
        paymentMethod: payMethod
      });
      showToast('Payment recorded successfully', 'success');
      setPaymentModalOpen(false);
      setActiveBill(null);
      payInteraction.resetInteraction();
      loadBillingData();
    } catch (err) {
      showToast(err.message || 'Payment update failed', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-7 h-7 text-emerald-600" />
            Clinic Billing & Income Collections
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Generate printable payment receipts, track dues, and review daily cash/UPI totals.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setPaidAmount(consultationFee);
            setIsCreateModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          Generate New Bill / Receipt
        </button>
      </div>

      {/* Financial Reports (Doctor Only) */}
      {role === 'doctor' && reports && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Today's Total Collection"
            value={formatCurrency(reports.today?.totalCollected || 0)}
            icon={DollarSign}
            subtext={`Cash: ${formatCurrency(reports.today?.cash || 0)} | UPI: ${formatCurrency(reports.today?.upi || 0)}`}
            color="emerald"
          />
          <StatCard
            title="Monthly Revenue"
            value={formatCurrency(reports.month?.collected || 0)}
            icon={Receipt}
            subtext={`Total Billed: ${formatCurrency(reports.month?.billed || 0)}`}
            color="blue"
          />
          <StatCard
            title="Cash Received (Month)"
            value={formatCurrency(reports.month?.cash || 0)}
            icon={Banknote}
            subtext="Cash in register"
            color="amber"
          />
          <StatCard
            title="Outstanding Patient Dues"
            value={formatCurrency(reports.overallPendingDues || 0)}
            icon={AlertCircle}
            subtext="Pending payment balance"
            color="purple"
          />
        </div>
      )}

      {/* Filters & Status */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-4">
        <div className="flex gap-2">
          {['', 'paid', 'partially_paid', 'pending'].map(st => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {st ? st.replace('_', ' ') : 'All Receipts'}
            </button>
          ))}
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <LoadingSpinner message="Loading financial records..." />
        ) : bills.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No receipts found"
            description="Create a receipt to record consultation and treatment charges."
            actionText="Generate Receipt"
            onAction={() => setIsCreateModalOpen(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Paid</th>
                  <th className="py-3 px-4">Balance</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bills.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-xs text-slate-900 whitespace-nowrap">
                      {b.receiptNumber}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(b.createdAt)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{b.patientName}</div>
                      <div className="text-xs text-slate-400">{b.patientPhone}</div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {formatCurrency(b.totalAmount)}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-emerald-600">
                      {formatCurrency(b.paidAmount)}
                    </td>
                    <td className="py-3.5 px-4">
                      {b.pendingAmount > 0 ? (
                        <span className="font-bold text-rose-600 text-xs">
                          {formatCurrency(b.pendingAmount)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Nil</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 uppercase text-xs font-semibold text-slate-600">
                      {b.paymentMethod}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full border capitalize ${getStatusBadgeStyle(b.paymentStatus)}`}>
                        {b.paymentStatus.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-2">
                      {b.pendingAmount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveBill(b);
                            setPayAmount(b.pendingAmount / 100);
                            setPaymentModalOpen(true);
                          }}
                          className="px-2.5 py-1 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-xs"
                        >
                          Collect Due
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => pdfService.generateReceiptPDF(b, clinic)}
                        title="Download Receipt PDF"
                        className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Bill Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          billInteraction.resetInteraction();
        }}
        title="Create Patient Bill & Official Receipt"
        maxWidth="max-w-2xl"
      >
        <form ref={createBillFormRef} noValidate onSubmit={handleCreateBill} className="space-y-4">
          <div>
            <PatientSearchSelect
              patients={patients}
              value={selectedPatientId}
              onChange={(id) => setSelectedPatientId(id)}
              label="Select Patient"
              required
              invalid={billInteraction.submitted && !selectedPatientId}
              error={billInteraction.submitted && !selectedPatientId ? 'Please select a patient.' : ''}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="bp-consult-fee" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Doctor Consultation Fee (₹) *
              </label>
              <input
                id="bp-consult-fee"
                type="text"
                inputMode="decimal"
                required
                value={consultationFee}
                aria-invalid={feeState.ariaInvalid}
                aria-describedby={buildDescribedBy({
                  errorId: 'bp-consult-fee-error',
                  showError: feeState.showError
                })}
                onChange={(e) => {
                  const val = e.target.value;
                  setConsultationFee(val);
                  const extras = additionalItems.reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
                  setPaidAmount((Number(val) || 0) + extras);
                }}
                onBlur={() => billInteraction.markTouched('consultationFee', feeValidation, 'Consultation fee')}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(feeState)}`}
              />
              <FieldFeedback id="bp-consult-fee-error" state={feeState} />
            </div>

            <div>
              <label htmlFor="bp-pay-method" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Payment Method
              </label>
              <select
                id="bp-pay-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI (GPay / PhonePe / QR)</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Additional Charges Section */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700 uppercase">Additional Services / Tests (e.g. ECG, Injection)</span>
              <button
                type="button"
                onClick={addExtraCharge}
                className="text-xs font-bold text-brand-600 hover:underline"
              >
                + Add Service
              </button>
            </div>

            {additionalItems.map((item, idx) => {
              const extraAmtCheck = validateAmount(item.amount, 'Extra amount', { required: true, min: 0, max: 1000000 });
              const extraInvalid = !extraAmtCheck.valid;
              return (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Service Name (e.g. ECG, Dressing)"
                    value={item.item}
                    onChange={(e) => updateExtraCharge(idx, 'item', e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Amount ₹"
                    value={item.amount}
                    aria-invalid={extraInvalid ? 'true' : 'false'}
                    onChange={(e) => updateExtraCharge(idx, 'amount', e.target.value)}
                    className={`w-28 px-3 py-1.5 bg-slate-50 border rounded-lg text-xs font-bold text-slate-800 ${
                      extraInvalid ? 'border-rose-400 bg-rose-50/40' : 'border-slate-200'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => removeExtraCharge(idx)}
                    aria-label="Remove charge"
                    className="text-slate-400 hover:text-rose-600 text-xs px-1"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>

          <div className="p-4 bg-slate-50 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Total Calculated Bill:</span>
              <span className="font-bold text-sm text-slate-900">₹{totalCalculatedINR.toFixed(2)}</span>
            </div>
            <div>
              <div className="flex justify-between items-center text-slate-600">
                <label htmlFor="bp-paid-today" className="font-bold">Amount Paid Today (₹):</label>
                <input
                  id="bp-paid-today"
                  type="text"
                  inputMode="decimal"
                  value={paidAmount}
                  aria-invalid={paidState.ariaInvalid}
                  aria-describedby={buildDescribedBy({
                    errorId: 'bp-paid-today-error',
                    showError: paidState.showError
                  })}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  onBlur={() => billInteraction.markTouched('paidAmount', paidValidation, 'Amount paid today')}
                  className={`w-32 px-3 py-1 bg-white border rounded-lg text-right font-bold text-emerald-600 text-sm focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(paidState)}`}
                />
              </div>
              <FieldFeedback id="bp-paid-today-error" state={paidState} className="justify-end text-right" />
            </div>
            <div className="flex justify-between text-rose-600 font-bold">
              <span>Balance Due:</span>
              <span>₹{Math.max(0, totalCalculatedINR - Number(paidAmount || 0)).toFixed(2)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsCreateModalOpen(false);
                billInteraction.resetInteraction();
              }}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
            >
              {isSubmitting ? 'Generating...' : 'Save & Download Receipt'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Additional Payment Modal */}
      <Modal
        isOpen={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          payInteraction.resetInteraction();
        }}
        title="Record Payment On Existing Due"
        maxWidth="max-w-md"
      >
        <form ref={payFormRef} noValidate onSubmit={handleRecordPayment} className="space-y-4">
          <p className="text-xs text-slate-600">
            Collecting payment for Receipt <strong className="font-mono text-slate-800">{activeBill?.receiptNumber}</strong>
          </p>

          <div>
            <label htmlFor="bp-due-pay" className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Amount to Collect (₹) *
            </label>
            <input
              id="bp-due-pay"
              type="text"
              inputMode="decimal"
              required
              value={payAmount}
              aria-invalid={duePayState.ariaInvalid}
              aria-describedby={buildDescribedBy({
                errorId: 'bp-due-pay-error',
                showError: duePayState.showError
              })}
              onChange={(e) => setPayAmount(e.target.value)}
              onBlur={() => payInteraction.markTouched('payAmount', duePayValidation, 'Payment amount')}
              className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm font-bold text-emerald-600 focus:bg-white focus:outline-none focus:ring-2 transition-colors ${getValidationInputClasses(duePayState)}`}
            />
            <FieldFeedback id="bp-due-pay-error" state={duePayState} />
          </div>

          <div>
            <label htmlFor="bp-due-method" className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Payment Method
            </label>
            <select
              id="bp-due-method"
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold"
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
              <option value="card">Card</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setPaymentModalOpen(false);
                payInteraction.resetInteraction();
              }}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm"
            >
              Confirm Payment
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

