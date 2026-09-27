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
  Keyboard,
  Search,
  Banknote,
  Smartphone,
  CreditCard,
  ShoppingCart,
  Pause,
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

  // Admin credentials state (Single Admin)
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>(() => loadAdminUsers());

  // Change password state
  const [changingPasswordUser, setChangingPasswordUser] = useState<string | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [showPasswordVal, setShowPasswordVal] = useState(false);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState('');

  const refreshAdmins = () => {
    setAdminUsers(loadAdminUsers());
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
              <label className="font-semibold text-zinc-700 block mb-1">Contact / Owner Name</label>
              <input
                type="text"
                value={formData.ownerName}
                onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-medium focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="font-semibold text-zinc-700 block mb-1">
                Primary Phone / Mobile * <span className="text-[11px] text-orange-600 font-semibold">(Printed on Bill)</span>
              </label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="e.g. 98450 12345"
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-medium focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="font-semibold text-zinc-700 block mb-1">
                Alternate / Secondary Phone <span className="text-[11px] text-orange-600 font-semibold">(Printed on Bill)</span>
              </label>
              <input
                type="text"
                value={formData.alternatePhone || ''}
                onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value })}
                placeholder="e.g. 94430 67890"
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-medium focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="font-semibold text-zinc-700 block mb-1">
                Store Email Address <span className="text-[11px] text-orange-600 font-semibold">(Printed on Bill)</span>
              </label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="e.g. shop@example.com"
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-medium focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="setting-shop-address" className="font-semibold text-zinc-700 block mb-1">
                Shop Address (Street, Area, Landmark) <span className="text-[11px] text-orange-600 font-semibold">(Printed on Bill)</span>
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
                This exact address, city, state, and pincode will be printed at the top of your bills and invoices.
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
              <label htmlFor="setting-shop-gstin" className="font-semibold text-zinc-700 block mb-1">
                GSTIN Registration <span className="text-[11px] text-orange-600 font-semibold">(Printed on Bill)</span>
              </label>
              <input
                id="setting-shop-gstin"
                type="text"
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                placeholder="e.g. 33ABCDE1234F1Z5"
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-mono font-medium focus:outline-none focus:border-orange-500 uppercase"
              />
            </div>
          </div>
        </div>

        {/* BILL MODE & FOOTER NOTES */}
        <div className="bg-white rounded-xl p-5 shadow-xs border border-zinc-200 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-100">
            <Receipt className="w-4 h-4 text-orange-500" />
            <h2 className="text-sm font-bold text-zinc-950">
              Bill Mode & Footer Notes
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

        {/* ADMIN ACCOUNT & PASSWORD AUTHENTICATION */}
        <div className="bg-white rounded-xl p-5 shadow-xs border border-zinc-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-orange-500" />
              <h2 className="text-sm font-bold text-zinc-950">
                Admin Authentication Credentials
              </h2>
            </div>
            <span className="text-[11px] text-zinc-500 font-mono bg-zinc-100 px-2.5 py-0.5 rounded-md">
              Primary Admin Account
            </span>
          </div>

          {passwordChangeSuccess && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>{passwordChangeSuccess}</span>
            </div>
          )}

          {/* Admin User Card & Password Management */}
          <div className="border border-zinc-200 rounded-xl overflow-hidden text-xs">
            {adminUsers.slice(0, 1).map((admin) => {
              const isEditingThis = changingPasswordUser === admin.adminId;
              return (
                <div key={admin.adminId} className="p-4 bg-zinc-50/60 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-orange-100 border border-orange-200 text-orange-700 flex items-center justify-center font-bold text-sm font-mono shadow-2xs">
                        {admin.adminId.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-900 font-mono text-sm">
                            {admin.adminId}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 text-[10.5px] font-semibold">
                            Admin
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-400">
                          Role: Administrator • Single Login ID & Password
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
                      className="px-3 py-1.5 bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-orange-500" />
                      <span>{isEditingThis ? 'Cancel' : 'Change Password'}</span>
                    </button>
                  </div>

                  {/* Inline Change Password Box */}
                  {isEditingThis && (
                    <div className="mt-4 pt-3.5 border-t border-zinc-200 flex flex-wrap items-center gap-2.5">
                      <span className="text-xs font-semibold text-zinc-700 shrink-0">
                        New Password:
                      </span>
                      <div className="relative">
                        <input
                          type={showPasswordVal ? 'text' : 'password'}
                          value={newPasswordVal}
                          onChange={(e) => setNewPasswordVal(e.target.value)}
                          placeholder="Enter new password"
                          className="px-3 py-1.5 pr-8 bg-white border border-zinc-300 rounded-lg text-xs font-medium focus:outline-none focus:border-orange-500 min-w-[200px]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswordVal(!showPasswordVal)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                        >
                          {showPasswordVal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSaveNewPassword(admin.adminId)}
                        className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 active:scale-[0.99] text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow-2xs"
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

        {/* POS KEYBOARD SHORTCUTS & HOTKEYS GUIDE */}
        <div className="bg-white rounded-xl p-5 shadow-xs border border-zinc-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-100 gap-2">
            <div className="flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-orange-500" />
              <h2 className="text-sm font-bold text-zinc-950">
                POS Keyboard Shortcuts & Hotkeys Guide
              </h2>
            </div>
            <span className="text-[11px] font-medium text-zinc-400 bg-zinc-50 border border-zinc-200/80 px-2 py-0.5 rounded-lg w-fit">
              Shortcuts are also labeled directly on each POS button
            </span>
          </div>

          <p className="text-xs text-zinc-500 leading-relaxed">
            Speed-billing operations can be completed entirely from your keyboard without using a mouse. 
            All shortcut keys are also visually printed directly on their respective buttons in the POS billing screen for rapid daily reference.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Group 1: Product Search & Cart */}
            <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800 border-b border-zinc-200/60 pb-2">
                <Search className="w-3.5 h-3.5 text-orange-500" />
                <span>Search Catalog & Cart Line Items</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">Focus Product Search</span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white text-zinc-800 font-mono font-bold text-[11px] border border-zinc-300 shadow-2xs">F2</kbd>
                    <span className="text-zinc-400 text-[10px]">or</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-white text-zinc-800 font-mono font-bold text-[11px] border border-zinc-300 shadow-2xs">Ctrl+F</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">Navigate Search Results</span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white text-zinc-800 font-mono font-bold text-[11px] border border-zinc-300 shadow-2xs">↑</kbd>
                    <kbd className="px-1.5 py-0.5 rounded bg-white text-zinc-800 font-mono font-bold text-[11px] border border-zinc-300 shadow-2xs">↓</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">Add to Bill & Set Quantity</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white text-zinc-800 font-mono font-bold text-[11px] border border-zinc-300 shadow-2xs">↵ Enter</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">Jump to Cart Line Items (Qty)</span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white text-zinc-800 font-mono font-bold text-[11px] border border-zinc-300 shadow-2xs">F3</kbd>
                    <span className="text-zinc-400 text-[10px]">or</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-white text-zinc-800 font-mono font-bold text-[11px] border border-zinc-300 shadow-2xs">Alt+C</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">Remove Line Item from Cart</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white text-rose-700 font-mono font-bold text-[11px] border border-zinc-300 shadow-2xs">Alt+Del</kbd>
                </div>
              </div>
            </div>

            {/* Group 2: Customer & Payment Methods */}
            <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800 border-b border-zinc-200/60 pb-2">
                <User className="w-3.5 h-3.5 text-orange-500" />
                <span>Customer & Payment Methods</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">Focus Customer Mobile / Details</span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white text-zinc-800 font-mono font-bold text-[11px] border border-zinc-300 shadow-2xs">F4</kbd>
                    <span className="text-zinc-400 text-[10px]">or</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-white text-zinc-800 font-mono font-bold text-[11px] border border-zinc-300 shadow-2xs">Alt+K</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">Cash Payment Mode</span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white text-emerald-800 font-mono font-bold text-[11px] border border-zinc-300 shadow-2xs">F7</kbd>
                    <span className="text-zinc-400 text-[10px]">or</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-white text-zinc-800 font-mono font-bold text-[11px] border border-zinc-300 shadow-2xs">Alt+1</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">UPI / QR Payment Mode</span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white text-sky-800 font-mono font-bold text-[11px] border border-zinc-300 shadow-2xs">F8</kbd>
                    <span className="text-zinc-400 text-[10px]">or</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-white text-zinc-800 font-mono font-bold text-[11px] border border-zinc-300 shadow-2xs">Alt+2</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">Card / POS Swipe Mode</span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white text-indigo-800 font-mono font-bold text-[11px] border border-zinc-300 shadow-2xs">F9</kbd>
                    <span className="text-zinc-400 text-[10px]">or</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-white text-zinc-800 font-mono font-bold text-[11px] border border-zinc-300 shadow-2xs">Alt+3</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">Credit / Udhaar Ledger</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white text-amber-800 font-mono font-bold text-[11px] border border-zinc-300 shadow-2xs">F10</kbd>
                </div>
              </div>
            </div>

            {/* Group 3: Cash Tendered & Discount Flow */}
            <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800 border-b border-zinc-200/60 pb-2">
                <Banknote className="w-3.5 h-3.5 text-orange-500" />
                <span>Cash Tendered & Discount Fast Flow</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">Cash Tendered ➔ Discount</span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white text-zinc-800 font-mono font-bold text-[11px] border border-zinc-300 shadow-2xs">↵ Enter</kbd>
                    <span className="text-[10px] text-zinc-400">(auto selects discount)</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">Jump Directly to Discount</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white text-zinc-800 font-mono font-bold text-[11px] border border-zinc-300 shadow-2xs">Alt+D</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">Confirm Discount & Return to Search</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white text-zinc-800 font-mono font-bold text-[11px] border border-zinc-300 shadow-2xs">↵ Enter</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">A4 (max 25) / A5 (max 15) Paper Toggle</span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white text-zinc-800 font-mono font-bold text-[11px] border border-zinc-300 shadow-2xs">Alt+4</kbd>
                    <kbd className="px-1.5 py-0.5 rounded bg-white text-zinc-800 font-mono font-bold text-[11px] border border-zinc-300 shadow-2xs">Alt+5</kbd>
                  </div>
                </div>
              </div>
            </div>

            {/* Group 4: Bill Finalization & Speed Actions */}
            <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800 border-b border-zinc-200/60 pb-2">
                <Printer className="w-3.5 h-3.5 text-orange-500" />
                <span>Bill Finalization & Speed Actions</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600 font-semibold">Print Bill & Record Sale</span>
                  <kbd className="px-2 py-0.5 rounded bg-emerald-600 text-white font-mono font-bold text-[11px] shadow-2xs">Ctrl+Enter</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">Hold Bill & Open Blank (Next Cust.)</span>
                  <kbd className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-mono font-bold text-[11px] shadow-2xs">F6</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">Open Quick Cheat Sheet Guide</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white text-zinc-800 font-mono font-bold text-[11px] border border-zinc-300 shadow-2xs">F1</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">Dismiss Overlays / Clear Search</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white text-zinc-800 font-mono font-bold text-[11px] border border-zinc-300 shadow-2xs">Esc</kbd>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <button
            type="button"
            id="btn-reset-demo-data"
            onClick={() => {
              if (window.confirm('Are you sure you want to clear all products, invoices, customers, and suppliers to start with a fresh clean store?')) {
                onResetData();
              }
            }}
            className="text-xs text-rose-600 hover:text-rose-800 font-medium flex items-center gap-1.5 p-2 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear All Store Data (Factory Reset)
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
