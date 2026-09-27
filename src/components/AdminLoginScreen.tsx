import React, { useState } from 'react';
import {
  ShieldCheck,
  User,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react';
import { ShopSettings, AuthSession } from '../types';
import { getShopLogoUrl } from '../utils/formatters';
import {
  verifyAdminCredentials,
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
  // Single login form state: Admin ID & Password only
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Handle Login Submit
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const trimmedId = loginId.trim();
    if (!trimmedId) {
      setLoginError('Please enter Admin ID');
      return;
    }
    if (!loginPassword) {
      setLoginError('Please enter password');
      return;
    }

    const verified = verifyAdminCredentials(trimmedId, loginPassword);
    if (!verified) {
      setLoginError('Invalid Admin ID or Password. Please try again.');
      return;
    }

    const session: AuthSession = {
      adminId: verified.adminId,
      name: verified.name || verified.adminId,
      loginTime: new Date().toISOString(),
    };

    setActiveAuthSession(session);
    onLoginSuccess(session);
  };

  return (
    <div className="min-h-screen w-full bg-linear-to-br from-slate-100 via-orange-50/20 to-slate-200 flex flex-col justify-center items-center p-4 sm:p-6 select-none font-sans">
      {/* Modern Card */}
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Card Header */}
        <div className="px-6 pt-7 pb-6 text-center border-b border-slate-100 bg-linear-to-b from-white to-slate-50/50">
          <div className="w-16 h-16 mx-auto mb-3 bg-white border border-slate-200/90 rounded-2xl shadow-xs flex items-center justify-center p-1.5">
            <img
              src={getShopLogoUrl(settings)}
              alt="Store Logo"
              className="max-w-full max-h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">
            {settings.shopName || 'Sri Senthur Velan Electricals and Pipes'}
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Admin Authentication • POS & Inventory System
          </p>
        </div>

        {/* Single Login Option */}
        <div className="p-6">
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
                  placeholder="Enter Admin ID (e.g. admin)"
                  autoFocus
                  autoCapitalize="none"
                  autoComplete="username"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50/60 hover:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all font-mono"
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
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50/60 hover:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
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
              <span>Login as Admin</span>
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>{settings.shopName || 'Sri Senthur Velan'}</span>
          <span className="flex items-center gap-1.5 font-medium text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Admin Secured
          </span>
        </div>
      </div>
    </div>
  );
};
