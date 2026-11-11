import React from 'react';
import { Menu, LogOut, User, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

export const Navbar = ({ onToggleSidebar }) => {
  const { user, clinic, role, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200/80 px-4 lg:px-8 py-3.5 flex items-center justify-between shadow-xs">
      {/* Left side: Hamburger on mobile + Clinic header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-2 -ml-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg lg:hidden"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:block">
          <h2 className="text-base font-bold text-slate-900 leading-tight">
            {clinic?.name || 'City Care Family Clinic'}
          </h2>
          <p className="text-xs text-slate-500">
            {clinic?.doctorName || 'Dr. Rajesh Sharma, M.D.'} • General Physician
          </p>
        </div>
      </div>

      {/* Right side: User Profile & Actions */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-slate-800 leading-tight">{user?.name || 'User'}</p>
            <span className="inline-block px-2 py-0.5 text-[11px] font-semibold uppercase rounded-full bg-teal-50 text-teal-700 border border-teal-200">
              {role}
            </span>
          </div>

          <div className="w-9 h-9 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            title="Log Out"
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1"
            aria-label="Log Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

