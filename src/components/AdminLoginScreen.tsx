import React, { useState } from 'react';
import {
  ShieldCheck,
  User,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { ShopSettings, AuthSession } from '../types';
import { getShopLogoUrl } from '../utils/formatters';
import {
  verifyAdminCredentials,
  saveAdminUser,
  loadAdminUsers,
  setActiveAuthSession,
} from '../utils/auth';

interface AdminLoginScreenProps {
  settings: ShopSettings;
  onLoginSuccess: (session: AuthSession) => void;
}

export const AdminLoginScreen: React.FC<AdminLoginScreenProps> = ({
  settings,
  onLoginSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Register form state (Only Admin ID & Password)
  const [regAdminId, setRegAdminId] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  // Handle Login Submit
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!loginId.trim()) {
      setLoginError('Please enter your Admin ID or username');
      return;
    }
    if (!loginPassword) {
      setLoginError('Please enter your password');
      return;
    }

    const verified = verifyAdminCredentials(loginId, loginPassword);
    if (!verified) {
      setLoginError('Invalid Admin ID or Password. Please try again or create a new admin.');
      return;
    }

    const session: AuthSession = {
      adminId: verified.adminId,
      name: verified.name,
      loginTime: new Date().toISOString(),
    };

    setActiveAuthSession(session);
    onLoginSuccess(session);
  };

  // Handle Register New Admin (Only Admin ID & Password)
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    const cleanId = regAdminId.trim().toLowerCase();

    if (!cleanId || cleanId.length < 3) {
      setRegError('Admin ID must be at least 3 characters');
      return;
    }
    if (!regPassword || regPassword.length < 4) {
      setRegError('Password must be at least 4 characters');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setRegError('Passwords do not match');
      return;
    }

    // Check if ID already exists
    const existing = loadAdminUsers();
    if (existing.some((u) => u.adminId.toLowerCase() === cleanId)) {
      setRegError(`Admin ID "${cleanId}" already exists. Please choose a different ID or sign in.`);
      return;
    }

    const newAdmin = {
      adminId: cleanId,
      name: cleanId, // Single identifier: Admin ID is the admin identity
      password: regPassword,
      role: 'admin' as const,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    saveAdminUser(newAdmin);

    const session: AuthSession = {
      adminId: newAdmin.adminId,
      name: newAdmin.adminId,
      loginTime: new Date().toISOString(),
    };

    setActiveAuthSession(session);
    setRegSuccess('Admin account registered! Logging in...');

    setTimeout(() => {
      onLoginSuccess(session);
    }, 400);
  };

  // Quick fill default admin
  const handleFillDemo = () => {
    setLoginId('admin');
    setLoginPassword('admin');
    setLoginError('');
  };

  return (
    <div className="min-h-screen w-full bg-linear-to-br from-slate-50 via-orange-50/20 to-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 select-none font-sans">
      {/* Modern Card */}
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-xl overflow-hidden">
        {/* Card Header */}
        <div className="px-6 pt-6 pb-5 text-center border-b border-slate-100 bg-linear-to-b from-white to-slate-50/50">
          <div className="w-16 h-16 mx-auto mb-3 bg-white border border-slate-200/80 rounded-2xl shadow-xs flex items-center justify-center p-1.5">
            <img
              src={getShopLogoUrl(settings)}
              alt="Store Logo"
              className="max-w-full max-h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">
            {settings.shopName || 'Store'}
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            POS Billing & Inventory Management
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
            <button
              type="button"
              id="tab-admin-login"
              onClick={() => {
                setMode('login');
                setLoginError('');
              }}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-orange-600 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Admin Sign In</span>
            </button>
            <button
              type="button"
              id="tab-admin-create"
              onClick={() => {
                setMode('register');
                setRegError('');
              }}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-orange-600 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>New Admin ID</span>
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6">
          {mode === 'login' ? (
            /* Login Form */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {loginError && (
                <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-xl text-xs text-rose-800 flex items-start gap-2.5 animate-fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="font-medium">{loginError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Admin ID
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    id="input-admin-id"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder="Enter Admin ID"
                    autoFocus
                    autoCapitalize="none"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50/50 hover:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    id="input-admin-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter Password"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50/50 hover:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    title={showLoginPassword ? 'Hide password' : 'Show password'}
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                id="btn-submit-admin-login"
                className="w-full py-3 px-4 bg-linear-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <ShieldCheck className="w-4 h-4 text-white" />
                <span>Sign In to POS</span>
              </button>

              {/* Quick Preset Assist */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Default access:</span>
                <button
                  type="button"
                  id="btn-fill-demo-credentials"
                  onClick={handleFillDemo}
                  className="font-mono text-xs font-semibold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100/80 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
                >
                  Quick fill (admin / admin)
                </button>
              </div>
            </form>
          ) : (
            /* Register Form */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {regError && (
                <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-xl text-xs text-rose-800 flex items-start gap-2.5 animate-fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="font-medium">{regError}</span>
                </div>
              )}
              {regSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs text-emerald-800 flex items-start gap-2.5 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="font-medium">{regSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  New Admin ID
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    id="input-new-admin-id"
                    value={regAdminId}
                    onChange={(e) => setRegAdminId(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    placeholder="e.g. chandru, admin2"
                    autoFocus
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50/50 hover:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Unique login ID for authentication</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    id="input-new-admin-password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Create a password (min 4 chars)"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50/50 hover:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Confirm Password
                </label>
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  id="input-new-admin-confirm-password"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full px-3.5 py-2.5 bg-slate-50/50 hover:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                />
              </div>

              <button
                type="submit"
                id="btn-submit-new-admin"
                className="w-full py-3 px-4 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create Admin Account</span>
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>{settings.shopName || 'Store'} POS</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            System Ready
          </span>
        </div>
      </div>
    </div>
  );
};
