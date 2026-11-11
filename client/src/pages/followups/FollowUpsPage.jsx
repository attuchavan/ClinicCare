import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Calendar,
  Send,
  CheckCircle2,
  AlertCircle,
  Phone,
  User,
  Filter
} from 'lucide-react';
import { api } from '../../services/api.js';
import { StatCard } from '../../components/common/StatCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { formatDate, getStatusBadgeStyle } from '../../utils/formatters.js';
import { useToast } from '../../context/ToastContext.jsx';

export const FollowUpsPage = () => {
  const [followUps, setFollowUps] = useState([]);
  const [filter, setFilter] = useState('all'); // all, due_today, overdue, upcoming, completed
  const [counts, setCounts] = useState({ dueToday: 0, overdue: 0, upcoming: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const { showToast } = useToast();
  const navigate = useNavigate();

  const loadFollowUps = async () => {
    setIsLoading(true);
    try {
      const res = await api.followUps.list({ filter });
      setFollowUps(res.followUps || []);
      setCounts({
        dueToday: res.dueTodayCount || 0,
        overdue: res.overdueCount || 0,
        upcoming: res.upcomingCount || 0
      });
    } catch (err) {
      showToast('Failed to load follow-up records', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFollowUps();
  }, [filter]);

  const handleUpdateStatus = async (id, status) => {
    try {
      await api.followUps.updateStatus(id, status);
      showToast(`Follow-up marked as ${status}`, 'success');
      loadFollowUps();
    } catch (err) {
      showToast(err.message || 'Failed to update follow-up', 'error');
    }
  };

  const handleSendReminder = async (item) => {
    try {
      await api.notifications.send({
        recipientPhone: item.patientPhone,
        recipientName: item.patientName,
        type: 'followup_reminder',
        channel: 'whatsapp',
        metadata: {
          followUpDate: item.followUpDate,
          diagnosis: item.diagnosis
        }
      });
      await api.followUps.updateStatus(item.id, 'reminder_sent');
      showToast(`WhatsApp reminder dispatched to ${item.patientPhone}!`, 'success');
      loadFollowUps();
    } catch (err) {
      showToast(err.message || 'Failed to dispatch reminder', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight flex items-center gap-2">
          <Clock className="w-7 h-7 text-teal-600" />
          Patient Follow-up & Review Tracker
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Monitor due consultations, send automatic WhatsApp reminders, and track chronic patient continuity.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Due Today"
          value={counts.dueToday}
          icon={Calendar}
          subtext="Scheduled for today"
          color="amber"
        />
        <StatCard
          title="Overdue Reviews"
          value={counts.overdue}
          icon={AlertCircle}
          subtext="Missed follow-up dates"
          color="purple"
        />
        <StatCard
          title="Upcoming Follow-ups"
          value={counts.upcoming}
          icon={Clock}
          subtext="Scheduled in future"
          color="teal"
        />
      </div>

      {/* Filter Tabs */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap gap-2 text-xs">
        {[
          { key: 'all', label: 'All Follow-ups' },
          { key: 'due_today', label: 'Due Today' },
          { key: 'overdue', label: 'Overdue' },
          { key: 'upcoming', label: 'Upcoming' },
          { key: 'completed', label: 'Completed' }
        ].map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`px-3.5 py-2 rounded-xl font-bold transition-colors ${
              filter === tab.key
                ? 'bg-slate-900 text-white'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Follow-ups List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <LoadingSpinner message="Checking follow-up schedules..." />
        ) : followUps.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No follow-up visits matching filter"
            description="Patients scheduled for follow-up will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Diagnosis / Condition</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {followUps.map(f => (
                  <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                      {formatDate(f.followUpDate)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{f.patientName}</div>
                      {f.notes && <div className="text-xs text-slate-400 italic">"{f.notes}"</div>}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-600 whitespace-nowrap">
                      {f.patientPhone}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-bold text-teal-700">
                      {f.diagnosis || 'Clinical Review'}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full border capitalize ${getStatusBadgeStyle(f.status)}`}>
                        {f.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-2">
                      {f.status !== 'completed' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSendReminder(f)}
                            title="Send WhatsApp Reminder"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200"
                          >
                            <Send className="w-3 h-3" /> Remind
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(f.id, 'completed')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Done
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

