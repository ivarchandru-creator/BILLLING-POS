import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Printer,
  FileText,
  Receipt,
  Store,
  CheckCircle2,
  RotateCcw,
  Save,
  Upload,
  Image as ImageIcon,
  AlertCircle,
  ShieldCheck,
  Lock,
  User,
  KeyRound,
  Eye,
  EyeOff,
  UserPlus,
} from 'lucide-react';
import { ShopSettings, ThermalWidth, AdminUser } from '../types';
import { getShopLogoUrl } from '../utils/formatters';
import { loadAdminUsers, saveAdminUser, getActiveAuthSession } from '../utils/auth';

interface SettingsViewProps {
  settings: ShopSettings;
  onSaveSettings: (newSettings: ShopSettings) => void;
  onResetData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onResetData,
}) => {
  const [formData, setFormData] = useState<ShopSettings>({ ...settings });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Admin credentials state
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>(() => loadAdminUsers());
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdminId, setNewAdminId] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminError, setNewAdminError] = useState('');
  const [newAdminSuccess, setNewAdminSuccess] = useState('');

  // Change password state
  const [changingPasswordUser, setChangingPasswordUser] = useState<string | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [showPasswordVal, setShowPasswordVal] = useState(false);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState('');

  const refreshAdmins = () => {
    setAdminUsers(loadAdminUsers());
  };

  const handleCreateAdminInSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setNewAdminError('');
    setNewAdminSuccess('');

    const cleanId = newAdminId.trim().toLowerCase();

    if (!cleanId || cleanId.length < 3) {
      setNewAdminError('Admin ID must be at least 3 characters');
      return;
    }
    if (!newAdminPassword || newAdminPassword.length < 4) {
      setNewAdminError('Password must be at least 4 characters');
      return;
    }

    if (adminUsers.some((u) => u.adminId.toLowerCase() === cleanId)) {
      setNewAdminError(`Admin ID "${cleanId}" already exists`);
      return;
    }

    const newUser: AdminUser = {
      adminId: cleanId,
      name: cleanId,
      password: newAdminPassword,
      role: 'admin',
      createdAt: new Date().toISOString(),
    };

    saveAdminUser(newUser);
    refreshAdmins();
    setNewAdminId('');
    setNewAdminPassword('');
    setNewAdminSuccess(`Admin "${cleanId}" created successfully!`);
    setTimeout(() => {
      setShowAddAdmin(false);
      setNewAdminSuccess('');
    }, 1500);
  };

  const handleSaveNewPassword = (adminId: string) => {
    if (!newPasswordVal || newPasswordVal.length < 4) {
      alert('Password must be at least 4 characters');
      return;
    }
    const user = adminUsers.find((u) => u.adminId.toLowerCase() === adminId.toLowerCase());
    if (user) {
      const updated: AdminUser = {
        ...user,
        password: newPasswordVal,
      };
      saveAdminUser(updated);
      refreshAdmins();
      setPasswordChangeSuccess(`Password updated for ${user.adminId}!`);
      setNewPasswordVal('');
      setTimeout(() => {
        setChangingPasswordUser(null);
        setPasswordChangeSuccess('');
      }, 1500);
    }
  };

  useEffect(() => {
    setFormData({ ...settings });
  }, [settings]);

  const processLogoFile = (file: File) => {
    setLogoError(null);
    if (!file.type.startsWith('image/')) {
      setLogoError('Please upload an image file (PNG, JPG, WEBP, or SVG).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setLogoError('Image size exceeds 10MB. Please choose a smaller file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return;

      const img = new Image();
      img.onload = () => {
        const naturalWidth = img.naturalWidth || img.width;
        const naturalHeight = img.naturalHeight || img.height;
        const aspectRatio = naturalHeight > 0 ? Number((naturalWidth / naturalHeight).toFixed(4)) : 1;

        // Resize down if too large to conserve storage and render crisp
        const maxDimension = 600;
        let targetWidth = naturalWidth;
        let targetHeight = naturalHeight;

        if (targetWidth > maxDimension || targetHeight > maxDimension) {
          if (targetWidth > targetHeight) {
            targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
            targetWidth = maxDimension;
          } else {
            targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
            targetHeight = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          const isJpeg = file.type === 'image/jpeg' || file.type === 'image/jpg';
          const optimizedDataUrl = isJpeg
            ? canvas.toDataURL('image/jpeg', 0.92)
            : canvas.toDataURL('image/png');

          setFormData((prev) => ({
            ...prev,
            logoUrl: optimizedDataUrl,
            logoAspectRatio: aspectRatio,
          }));
        } else {
          setFormData((prev) => ({
            ...prev,
            logoUrl: dataUrl,
            logoAspectRatio: aspectRatio,
          }));
        }
      };
      img.onerror = () => {
        setLogoError('Could not process image file. Please try another image.');
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      setLogoError('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processLogoFile(file);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleResetLogo = () => {
    setLogoError(null);
    setFormData((prev) => {
      const updated = { ...prev };
      delete updated.logoUrl;
      delete updated.logoAspectRatio;
      return updated;
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processLogoFile(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="w-full h-full p-6 sm:p-8 overflow-y-auto space-y-6 bg-slate-50/50">
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        {/* Top Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Settings
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Configure store profile, thermal / ink printer formats, and GST registration.
            </p>
          </div>

          {savedSuccess && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Saved Successfully
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* PRINTER SETTINGS */}
          <div className="bg-white rounded-xl p-5 shadow-xs border border-slate-200/80 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-100">
            <Printer className="w-4 h-4 text-orange-500" />
            <div>
              <h2 className="text-sm font-bold text-zinc-950">
                Default Printer Type
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Ink / A4 Printer - Default */}
            <div
              id="setting-printer-ink"
              onClick={() => setFormData({ ...formData, defaultPrinterType: 'ink' })}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                formData.defaultPrinterType === 'ink'
                  ? 'border-orange-500 bg-orange-50/20 ring-1 ring-orange-500'
                  : 'border-zinc-200 hover:border-zinc-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-orange-500" />
                  <span className="font-bold text-xs text-zinc-950">
                    Ink Printer (A4)
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-orange-100 text-orange-800 rounded">
                    Default
                  </span>
                </div>
                {formData.defaultPrinterType === 'ink' && (
                  <CheckCircle2 className="w-4 h-4 text-orange-500" />
                )}
              </div>
            </div>

            {/* Thermal Printer */}
            <div
              id="setting-printer-thermal"
              onClick={() => setFormData({ ...formData, defaultPrinterType: 'thermal' })}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                formData.defaultPrinterType === 'thermal'
                  ? 'border-orange-500 bg-orange-50/20 ring-1 ring-orange-500'
                  : 'border-zinc-200 hover:border-zinc-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-orange-500" />
                  <span className="font-bold text-xs text-zinc-950">
                    Thermal Printer
                  </span>
                </div>
                {formData.defaultPrinterType === 'thermal' && (
                  <CheckCircle2 className="w-4 h-4 text-orange-500" />
                )}
              </div>

              {formData.defaultPrinterType === 'thermal' && (
                <div className="mt-3 pt-3 border-t border-zinc-200/60 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-700">Roll Width:</span>
                  <div className="flex gap-1.5">
                    {(['80mm', '58mm'] as ThermalWidth[]).map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormData({ ...formData, thermalPaperWidth: w });
                        }}
                        className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-colors ${
                          formData.thermalPaperWidth === w
                            ? 'bg-black text-white'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SHOP LOGO SETTINGS */}
        <div className="bg-white rounded-xl p-5 shadow-xs border border-zinc-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-orange-500" />
              <h2 className="text-sm font-bold text-zinc-950">
                Shop Logo & Branding
              </h2>
            </div>
            {formData.logoUrl ? (
              <span className="text-xs text-slate-500 font-medium">
                Custom Logo Uploaded
              </span>
            ) : (
              <span className="text-xs text-slate-400 font-medium">
                Default Store Logo
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Logo Preview Container with Drag and Drop */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative group cursor-pointer w-32 h-32 sm:w-36 sm:h-36 rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-3 transition-all shrink-0 bg-white ${
                isDragging
                  ? 'border-orange-500 bg-orange-50/60 ring-4 ring-orange-100'
                  : 'border-zinc-200 hover:border-orange-400 hover:bg-orange-50/20'
              }`}
              title="Click or drag an image here to change logo"
            >
              <img
                id="settings-active-logo-preview"
                src={getShopLogoUrl(formData)}
                alt="Shop Logo Preview"
                className="max-w-full max-h-full object-contain filter drop-shadow-xs"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-semibold gap-1 backdrop-blur-xs">
                <Upload className="w-5 h-5" />
                <span>Upload New</span>
              </div>
            </div>

            {/* Logo Controls & Description */}
            <div className="flex-1 space-y-3 text-center sm:text-left">
              <div>
                <h3 className="font-semibold text-zinc-900 text-sm">Official Shop Logo</h3>
                <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                  Upload your own shop logo. It will be printed on all invoices (A4 laser & ink), thermal receipts (58mm & 80mm), customer/supplier ledgers, stock reports, and displayed in the sidebar.
                </p>
              </div>

              {logoError && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{logoError}</span>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleLogoUpload}
                className="hidden"
                id="shop-logo-file-input"
              />

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1">
                <button
                  type="button"
                  id="btn-upload-logo"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Change Logo
                </button>

                {formData.logoUrl && (
                  <button
                    type="button"
                    id="btn-reset-logo"
                    onClick={handleResetLogo}
                    className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Revert back to the default store logo"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
                    Reset to Default Logo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* SHOP IDENTITY */}
        <div className="bg-white rounded-xl p-5 shadow-xs border border-zinc-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-orange-500" />
              <h2 className="text-sm font-bold text-zinc-950">
                Shop Header & Contact
              </h2>
            </div>
            {/* Active Store Logo Preview */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-400 font-medium">Active Logo:</span>
              <img
                src={getShopLogoUrl(formData)}
                alt="Store Logo"
                className="w-7 h-10 object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div>
              <label className="font-semibold text-zinc-700 block mb-1">Business Name *</label>
              <input
                type="text"
                required
                value={formData.shopName}
                onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-bold text-zinc-950 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="font-semibold text-zinc-700 block mb-1">Tagline</label>
              <input
                type="text"
                value={formData.tagline}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-medium focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="font-semibold text-zinc-700 block mb-1">Contact Name</label>
              <input
                type="text"
                value={formData.ownerName}
                onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-medium focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="font-semibold text-zinc-700 block mb-1">Phone / WhatsApp *</label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-medium focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="setting-shop-address" className="font-semibold text-zinc-700 block mb-1">
                Shop Address (Street, Area, Landmark)
              </label>
              <textarea
                id="setting-shop-address"
                rows={2}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="e.g. 142/B, Crosscut Road, Gandhipuram"
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-medium text-zinc-900 focus:outline-none focus:border-orange-500"
              />
              <span className="text-[11px] text-zinc-400 mt-0.5 block">
                This address will be printed at the top of your invoices, bills, thermal receipts, and reports.
              </span>
            </div>

            <div>
              <label htmlFor="setting-shop-city" className="font-semibold text-zinc-700 block mb-1">City / Town</label>
              <input
                id="setting-shop-city"
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="e.g. Coimbatore"
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-medium focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label htmlFor="setting-shop-state" className="font-semibold text-zinc-700 block mb-1">State</label>
              <input
                id="setting-shop-state"
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                placeholder="e.g. Tamil Nadu"
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-medium focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label htmlFor="setting-shop-pincode" className="font-semibold text-zinc-700 block mb-1">PIN Code</label>
              <input
                id="setting-shop-pincode"
                type="text"
                value={formData.pincode}
                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                placeholder="e.g. 641012"
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-mono font-medium focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label htmlFor="setting-shop-gstin" className="font-semibold text-zinc-700 block mb-1">GSTIN</label>
              <input
                id="setting-shop-gstin"
                type="text"
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                placeholder="e.g. 33ABCDE1234F1Z5"
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-mono font-medium focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
        </div>

        {/* GST DEFAULTS */}
        <div className="bg-white rounded-xl p-5 shadow-xs border border-zinc-200 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-100">
            <Receipt className="w-4 h-4 text-orange-500" />
            <h2 className="text-sm font-bold text-zinc-950">
              GST Defaults & Bill Footer
            </h2>
          </div>

          <div className="space-y-3.5 text-xs">
            <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <div>
                <span className="font-semibold text-zinc-800 block">Default Bill Mode</span>
                <span className="text-zinc-500 text-[11px]">
                  {formData.defaultGstOn ? 'New bills will start as GST Tax Invoice' : 'New bills will start as Cash Memo (Default)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, defaultGstOn: !formData.defaultGstOn })}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  formData.defaultGstOn
                    ? 'bg-orange-600 text-white'
                    : 'bg-zinc-900 text-white'
                }`}
              >
                {formData.defaultGstOn ? 'Default: GST Bill' : 'Default: Cash Memo'}
              </button>
            </div>

            <div>
              <label className="font-semibold text-zinc-700 block mb-1">Default GST Rate (%)</label>
              <select
                value={formData.defaultGstRate}
                onChange={(e) =>
                  setFormData({ ...formData, defaultGstRate: parseInt(e.target.value, 10) || 18 })
                }
                className="w-full sm:w-60 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-medium focus:outline-none focus:border-orange-500"
              >
                <option value={18}>18% (Standard Electrical Goods)</option>
                <option value={12}>12% (Lighting & LED items)</option>
                <option value={28}>28% (Heavy Appliances)</option>
                <option value={5}>5%</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-zinc-700 block mb-1">Footer Message</label>
              <input
                type="text"
                value={formData.footerMessage}
                onChange={(e) => setFormData({ ...formData, footerMessage: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-medium focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="font-semibold text-zinc-700 block mb-1">Terms & Conditions (Ink Invoice)</label>
              <textarea
                rows={2}
                value={formData.termsAndConditions}
                onChange={(e) => setFormData({ ...formData, termsAndConditions: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-medium text-zinc-700 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
        </div>

        {/* ADMIN ACCOUNTS & AUTHENTICATION */}
        <div className="bg-white rounded-xl p-5 shadow-xs border border-zinc-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-orange-500" />
              <h2 className="text-sm font-bold text-zinc-950">
                Admin ID & Password Authentication
              </h2>
            </div>
            <button
              type="button"
              id="btn-open-add-admin"
              onClick={() => setShowAddAdmin(!showAddAdmin)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-semibold border border-orange-200 cursor-pointer transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{showAddAdmin ? 'Cancel' : 'Create New Admin ID'}</span>
            </button>
          </div>

          {/* Form to create new admin ID right in settings */}
          {showAddAdmin && (
            <div className="p-4 bg-orange-50/50 border border-orange-200 rounded-xl space-y-3">
              <h3 className="text-xs font-bold text-orange-950 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-orange-600" />
                <span>Create New Admin Account</span>
              </h3>

              {newAdminError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span>{newAdminError}</span>
                </div>
              )}
              {newAdminSuccess && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>{newAdminSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">New Admin ID</label>
                  <input
                    type="text"
                    value={newAdminId}
                    onChange={(e) => setNewAdminId(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    placeholder="e.g. admin2, chandru"
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg font-mono focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">Password</label>
                  <input
                    type="password"
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder="Create a password"
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddAdmin(false)}
                  className="px-3 py-1.5 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateAdminInSettings}
                  className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Save New Admin
                </button>
              </div>
            </div>
          )}

          {passwordChangeSuccess && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>{passwordChangeSuccess}</span>
            </div>
          )}

          {/* List of registered Admin users */}
          <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl overflow-hidden text-xs">
            {adminUsers.map((admin) => {
              const isEditingThis = changingPasswordUser === admin.adminId;
              return (
                <div key={admin.adminId} className="p-3 bg-zinc-50/60 hover:bg-zinc-50 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-orange-100 border border-orange-200 text-orange-700 flex items-center justify-center font-bold text-xs font-mono">
                        {admin.adminId.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-900 font-mono text-xs">
                            {admin.adminId}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 text-[10.5px] font-semibold">
                            Admin
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-400">
                          Role: Administrator • Created: {new Date(admin.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (isEditingThis) {
                          setChangingPasswordUser(null);
                        } else {
                          setChangingPasswordUser(admin.adminId);
                          setNewPasswordVal('');
                        }
                      }}
                      className="px-3 py-1 bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-orange-500" />
                      <span>{isEditingThis ? 'Close' : 'Change Password'}</span>
                    </button>
                  </div>

                  {/* Inline Change Password Box */}
                  {isEditingThis && (
                    <div className="mt-3 pt-3 border-t border-zinc-200 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-700 shrink-0">
                        New Password for {admin.adminId}:
                      </span>
                      <div className="relative">
                        <input
                          type={showPasswordVal ? 'text' : 'password'}
                          value={newPasswordVal}
                          onChange={(e) => setNewPasswordVal(e.target.value)}
                          placeholder="Enter new password"
                          className="px-3 py-1.5 pr-8 bg-white border border-zinc-300 rounded-lg text-xs font-medium focus:outline-none focus:border-orange-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswordVal(!showPasswordVal)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                        >
                          {showPasswordVal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSaveNewPassword(admin.adminId)}
                        className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Update Password
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* SAVE & RESET ACTIONS */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <button
            type="button"
            id="btn-reset-demo-data"
            onClick={() => {
              if (window.confirm('Reset all products, sample bills, and settings to original state?')) {
                onResetData();
              }
            }}
            className="text-xs text-zinc-500 hover:text-black font-medium flex items-center gap-1.5 p-2 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset To Demo Samples
          </button>

          <button
            type="submit"
            id="btn-save-settings"
            className="flex items-center gap-2 px-6 py-2.5 bg-black hover:bg-zinc-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <Save className="w-3.5 h-3.5 text-orange-500" />
            Save Settings
          </button>
        </div>
      </form>
      </div>
    </div>
  );
};
