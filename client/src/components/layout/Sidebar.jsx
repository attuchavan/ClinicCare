import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Users,
  Calendar,
  FileText,
  Receipt,
  Settings,
  ExternalLink,
  Activity,
  Stethoscope
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export const Sidebar = ({ isOpen, onClose }) => {
  const { role, clinic } = useAuth();

  const doctorNav = [
    { label: "Doctor's Desk (Queue)", to: '/doctor', icon: Stethoscope },
    { label: 'Write Case / Rx', to: '/doctor/case-paper', icon: FileText },
    { label: 'All Patients', to: '/doctor/patients', icon: Users },
    { label: 'Billing & Reports', to: '/doctor/billing', icon: Receipt },
    { label: 'Clinic Settings', to: '/doctor/settings', icon: Settings },
  ];

  const receptionistNav = [
    { label: "Front Desk (Today)", to: '/receptionist', icon: Calendar },
    { label: 'All Patients', to: '/receptionist/patients', icon: Users },
    { label: 'Billing & Receipts', to: '/receptionist/billing', icon: Receipt },
  ];

  const navItems = role === 'doctor' ? doctorNav : receptionistNav;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-30 lg:hidden"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-40 w-64 bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800/80">
          <div className="p-2.5 rounded-xl bg-teal-600 text-white shadow-lg shadow-teal-900/40">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg leading-tight tracking-tight text-white">ClinicCare</h1>
            <p className="text-[11px] text-teal-400 font-semibold tracking-wide uppercase">Clinic Software</p>
          </div>
        </div>

        {/* Clinic info tag */}
        <div className="px-6 py-3.5 bg-slate-950/50 text-xs border-b border-slate-800/70">
          <span className="font-bold text-slate-200 block truncate">
            {clinic?.name || 'ClinicCare'}
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] capitalize text-slate-400 font-medium truncate">
              {role === 'doctor' ? (clinic?.doctorName || "Doctor's Desk") : `${role} Portal Active`}
            </span>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 px-3.5 py-5 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/doctor' || item.to === '/receptionist'}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-md shadow-teal-950/40 font-bold'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Patient public booking quick link */}
        <div className="p-4 border-t border-slate-800/80">
          <a
            href="/book"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 text-xs font-semibold text-teal-300 transition-colors"
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5" />
              Patient Booking Link
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-teal-500/20 text-teal-300 font-bold">Public</span>
          </a>
        </div>
      </aside>
    </>
  );
};
