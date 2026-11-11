import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Calendar,
  Clock,
  Stethoscope,
  AlertTriangle,
  CheckCircle2,
  Play,
  FileText,
  RefreshCw,
  Search,
  Phone,
  Pill,
  Camera,
  ArrowRight
} from 'lucide-react';
import { api } from '../../services/api.js';
import { StatCard } from '../../components/common/StatCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { calculateAge, formatDate, getStatusBadgeStyle } from '../../utils/formatters.js';
import { useToast } from '../../context/ToastContext.jsx';
import { PreviousPrescriptionsModal } from '../../components/prescriptions/PreviousPrescriptionsModal.jsx';

export const DoctorDashboard = () => {
  const [todayQueue, setTodayQueue] = useState([]);
  const [patientsMap, setPatientsMap] = useState({});
  const [prevRxSummaryMap, setPrevRxSummaryMap] = useState({});
  const [filterTab, setFilterTab] = useState('all'); // 'waiting' | 'all' | 'completed'
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [prevRxModalOpen, setPrevRxModalOpen] = useState(false);
  const [selectedPatientForRx, setSelectedPatientForRx] = useState(null);

  const navigate = useNavigate();
  const { showToast } = useToast();
  const todayStr = new Date().toISOString().slice(0, 10);

  const loadPrevRxSummaries = async (queueItems) => {
    const uniqueIds = [...new Set(queueItems.map(a => a.patientId).filter(Boolean))];
    if (uniqueIds.length === 0) {
      setPrevRxSummaryMap({});
      return;
    }

    const results = await Promise.allSettled(
      uniqueIds.map(id =>
        api.documents.getPreviousPrescriptions(id).then(res => {
          const docs = res.documents || [];
          const rxs = res.clinicPrescriptions || [];
          const latestDoc = docs[0];
          const latestRx = rxs[0];
          let snippet = '';
          if (latestDoc?.prescribedMedicines) {
            snippet = latestDoc.prescribedMedicines.split('\n')[0];
          } else if (latestDoc?.title) {
            snippet = latestDoc.title;
          } else if (latestRx?.diagnosis) {
            snippet = `${latestRx.diagnosis} (${(latestRx.medicines || []).length} meds)`;
          }
          return [id, { totalCount: res.totalCount || 0, hasPhoto: docs.some(d => Boolean(d.fileUrl)), snippet }];
        })
      )
    );

    const map = {};
    results.forEach(r => {
      if (r.status === 'fulfilled') {
        const [id, info] = r.value;
        map[id] = info;
      }
    });
    setPrevRxSummaryMap(map);
  };

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [appointments, patientsRes] = await Promise.all([
        api.appointments.list({ date: todayStr }),
        api.patients.list({ limit: 200 })
      ]);

      const queue = appointments || [];
      const pMap = {};
      (patientsRes?.patients || []).forEach(p => {
        pMap[p.id] = p;
      });

      setTodayQueue(queue);
      setPatientsMap(pMap);
      loadPrevRxSummaries(queue);
    } catch (err) {
      console.error('Failed to load doctor dashboard:', err);
      showToast('Error loading today patient queue', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const openCasePaper = (appointment) => {
    const params = new URLSearchParams({
      patientId: appointment.patientId || '',
      appointmentId: appointment.id,
      name: appointment.patientName || '',
      reason: appointment.reason || ''
    });
    navigate(`/doctor/case-paper?${params.toString()}`);
  };

  const handleStartConsultation = async (appointment) => {
    try {
      if (appointment.status !== 'in-consultation' && appointment.status !== 'completed') {
        await api.appointments.updateStatus(appointment.id, 'in-consultation');
      }
      openCasePaper(appointment);
    } catch (err) {
      showToast(err.message || 'Failed to open consultation', 'error');
    }
  };

  const waitingCount = todayQueue.filter(a => a.status === 'checked-in' || a.status === 'in-consultation').length;
  const completedCount = todayQueue.filter(a => a.status === 'completed').length;
  const totalCount = todayQueue.length;

  const filteredQueue = todayQueue.filter(item => {
    if (filterTab === 'waiting' && item.status !== 'checked-in' && item.status !== 'in-consultation') return false;
    if (filterTab === 'completed' && item.status !== 'completed') return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (item.patientName || '').toLowerCase().includes(q) ||
      (item.patientPhone || '').includes(q) ||
      (item.reason || '').toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return <LoadingSpinner message="Loading today's patients..." size="lg" />;
  }

  return (
    <div className="space-y-6">
      {/* Clean Physician Header */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-soft p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-50 border border-teal-200/80 px-2.5 py-0.5 rounded-full">
            <Stethoscope className="w-3.5 h-3.5" />
            <span>Doctor's Cabin</span>
            <span>•</span>
            <span>{formatDate(todayStr)}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Today's Patient Queue
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            See every arriving patient, why they came, allergies, and past prescriptions — click once to write Rx.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={loadDashboardData}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            title="Refresh Queue"
            aria-label="Refresh Queue"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/doctor/case-paper')}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-sm shadow-teal-600/20 transition-all"
          >
            <FileText className="w-4 h-4" />
            <span>New Case Paper / Rx</span>
          </button>
        </div>
      </div>

      {/* 3 Simple Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Ready / Waiting"
          value={waitingCount}
          icon={Clock}
          subtext="Checked in & inside cabin"
          color="amber"
        />
        <StatCard
          title="Consulted Today"
          value={completedCount}
          icon={CheckCircle2}
          subtext="Prescriptions completed"
          color="emerald"
        />
        <StatCard
          title="Total Scheduled"
          value={totalCount}
          icon={Users}
          subtext="All appointments today"
          color="teal"
        />
      </div>

      {/* Patient Queue List */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-soft overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: 'all', label: `All Today (${totalCount})` },
              { key: 'waiting', label: `Waiting / Active (${waitingCount})` },
              { key: 'completed', label: `Completed (${completedCount})` }
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterTab(tab.key)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  filterTab === tab.key
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="search"
              placeholder="Search patient or complaint..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {filteredQueue.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No patients in this queue"
            description="Patients scheduled or checked in by the receptionist will appear here automatically."
            actionText="Open Blank Case Paper"
            onAction={() => navigate('/doctor/case-paper')}
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredQueue.map(item => {
              const pat = item.patientId ? patientsMap[item.patientId] : null;
              const age = pat?.dateOfBirth ? calculateAge(pat.dateOfBirth) : null;
              const rxInfo = item.patientId ? prevRxSummaryMap[item.patientId] : null;

              return (
                <div
                  key={item.id}
                  className={`p-5 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                    item.status === 'checked-in' ? 'bg-amber-50/25 hover:bg-amber-50/40' : 'hover:bg-slate-50/70'
                  }`}
                >
                  {/* Patient Info + Why Came + Old Rx Summary */}
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200/80 text-center shrink-0 min-w-[76px]">
                      <div className="text-sm font-extrabold text-slate-900">{item.timeSlot}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        {item.isWalkIn ? 'Walk-in' : 'Booked'}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.patientId ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/doctor/patients/${item.patientId}`)}
                            className="text-base font-extrabold text-slate-900 hover:text-teal-700 hover:underline text-left"
                          >
                            {item.patientName}
                          </button>
                        ) : (
                          <span className="text-base font-extrabold text-slate-900">{item.patientName}</span>
                        )}

                        {pat && (
                          <span className="text-xs font-semibold text-slate-500">
                            {age ? `${age} Yrs • ` : ''}{pat.gender}{pat.bloodGroup ? ` • ${pat.bloodGroup}` : ''}
                          </span>
                        )}

                        {item.patientPhone && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                            <Phone className="w-3 h-3" />
                            {item.patientPhone}
                          </span>
                        )}

                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold rounded-full border capitalize ${getStatusBadgeStyle(item.status)}`}>
                          {item.status === 'checked-in' ? 'Waiting Outside' : item.status.replace('-', ' ')}
                        </span>

                        {pat?.allergies && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            Allergy: {pat.allergies}
                          </span>
                        )}
                      </div>

                      {/* Why Patient Came Today */}
                      <div className="inline-flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 text-sm">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-700">
                          Why Came:
                        </span>
                        <span className="font-semibold text-slate-800">
                          {item.reason || 'General Consultation'}
                        </span>
                      </div>

                      {/* Previous Prescription Snapshot */}
                      {rxInfo && rxInfo.totalCount > 0 && (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-1 font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                            <Pill className="w-3 h-3" />
                            {rxInfo.totalCount} Previous Rx
                            {rxInfo.hasPhoto && ' (Includes Photo/PDF)'}
                          </span>
                          {rxInfo.snippet && (
                            <span className="truncate max-w-md text-slate-600 font-medium">
                              Latest: {rxInfo.snippet}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {item.patientId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPatientForRx({ id: item.patientId, name: item.patientName });
                          setPrevRxModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                      >
                        <Camera className="w-3.5 h-3.5 text-teal-600" />
                        <span>Past Rx{rxInfo?.totalCount ? ` (${rxInfo.totalCount})` : ''}</span>
                      </button>
                    )}

                    {item.status === 'completed' ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/doctor/patients/${item.patientId}`)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
                      >
                        <span>View History</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStartConsultation(item)}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-colors"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>
                          {item.status === 'in-consultation' ? 'Continue Case Paper' : 'Open & Prescribe'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Previous Prescriptions Viewer Modal */}
      {prevRxModalOpen && selectedPatientForRx && (
        <PreviousPrescriptionsModal
          isOpen={prevRxModalOpen}
          onClose={() => {
            setPrevRxModalOpen(false);
            setSelectedPatientForRx(null);
            loadDashboardData();
          }}
          patientId={selectedPatientForRx.id}
          patientName={selectedPatientForRx.name}
          onPrescriptionAdded={() => loadDashboardData()}
        />
      )}
    </div>
  );
};
