import React, { useState } from 'react';
import {
  LayoutDashboard,
  Receipt,
  Package,
  Users,
  Truck,
  RotateCcw,
  BarChart2,
  Settings as SettingsIcon,
  ChevronRight,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { ActiveTab, ShopSettings, AuthSession } from '../types';
import { getShopLogoUrl } from '../utils/formatters';
import { RunningLiveClock } from './RunningLiveClock';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  settings: ShopSettings;
  lowStockCount?: number;
  draftCartCount?: number;
  currentUser?: AuthSession | null;
  onLogout?: () => void;
}

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: React.ElementType;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  settings,
  lowStockCount,
  draftCartCount,
  currentUser,
  onLogout,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Exact items matching the reference screenshot in exact order
  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'billing', label: 'New Invoice', icon: Receipt },
    { id: 'inventory', label: 'Products', icon: Package },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'suppliers', label: 'Suppliers', icon: Truck },
    { id: 'invoices', label: 'Sales History', icon: RotateCcw },
    { id: 'reports', label: 'Reports', icon: BarChart2 },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const navContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 text-slate-700 select-none">
      {/* Brand Header with Uploaded Store Logo & Name */}
      <div
        className="p-3.5 border-b border-slate-100 bg-linear-to-b from-white to-slate-50/50 flex items-center gap-3 w-full h-[90px]"
        style={{ height: "90px" }}
      >
        <div className="w-[54px] h-[72px] bg-white border border-slate-200/80 rounded-xl shadow-xs flex items-center justify-center p-1 shrink-0">
          <img
            id="sidebar-brand-logo"
            src={getShopLogoUrl(settings)}
            alt={`${settings.shopName || 'Store'} Logo`}
            className="max-w-[48px] max-h-[64px] object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h1
            className="font-bold text-xs sm:text-sm text-slate-900 tracking-tight leading-snug truncate"
            title={settings.shopName}
          >
            {settings.shopName || 'Store'}
          </h1>
          <p
            className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5 truncate"
            title={settings.tagline}
          >
            {settings.tagline || 'Retail & Wholesale'}
          </p>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              id={`sidebar-nav-${item.id}`}
              onClick={() => handleSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-[13px] transition-all cursor-pointer ${
                isActive
                  ? 'bg-orange-500 text-white font-semibold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-white' : 'text-slate-500'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>

              <div className="flex items-center gap-1.5 ml-2">
                {item.id === 'billing' && draftCartCount && draftCartCount > 0 ? (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono leading-none ${
                      isActive ? 'bg-white text-orange-600' : 'bg-orange-100 text-orange-700'
                    }`}
                    title={`${draftCartCount} items in active invoice draft`}
                  >
                    {draftCartCount}
                  </span>
                ) : null}

                {item.id === 'inventory' && lowStockCount && lowStockCount > 0 ? (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono leading-none ${
                      isActive ? 'bg-white text-rose-600' : 'bg-rose-100 text-rose-700'
                    }`}
                    title={`${lowStockCount} items low on stock`}
                  >
                    {lowStockCount}
                  </span>
                ) : null}

                {isActive && (
                  <ChevronRight className="w-3.5 h-3.5 text-white/80 shrink-0" />
                )}
              </div>
            </button>
          );
        })}
      </nav>

      {/* Running Live Clock above User Login Details */}
      <RunningLiveClock />

      {/* Bottom User Info matching screenshot */}
      <div className="p-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-linear-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
            {(currentUser?.adminId || 'A').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate">
              {currentUser?.adminId || 'admin'}
            </p>
            <p className="text-[10px] font-medium text-emerald-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
              Admin Active
            </p>
          </div>
        </div>
        <button
          type="button"
          id="btn-sidebar-logout"
          onClick={() => {
            if (onLogout) {
              onLogout();
            } else {
              setActiveTab('settings');
            }
          }}
          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0 cursor-pointer"
          title="Sign Out / Lock Admin"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="no-print lg:hidden sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
          aria-label="Open Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={getShopLogoUrl(settings)}
            alt={`${settings.shopName || 'Store'} Logo`}
            className="w-7 h-9 object-contain shrink-0"
            referrerPolicy="no-referrer"
          />
          <span className="font-bold text-sm text-slate-900 tracking-tight truncate max-w-[160px]">
            {settings.shopName || 'Store'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => handleSelectTab('billing')}
          className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold shadow-xs"
        >
          + Quick Bill
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="no-print lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col z-10">
            <div className="absolute top-3 right-3 z-20">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {navContent}
          </div>
        </div>
      )}

      {/* Desktop Fixed Sidebar */}
      <aside className="no-print hidden lg:flex flex-col w-64 h-full shrink-0 z-20">
        {navContent}
      </aside>
    </>
  );
};
