import React from 'react';
import { ActiveTab, ShopSettings } from '../types';

interface HeaderProps {
  activeTab: ActiveTab;
  settings?: ShopSettings;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  settings,
}) => {
  // Title mapping matching the screenshot tabs
  const getTabTitle = (tab: ActiveTab): string => {
    switch (tab) {
      case 'dashboard':
        return 'Dashboard';
      case 'billing':
        return 'New Invoice';
      case 'inventory':
        return 'Products';
      case 'customers':
        return 'Customers';
      case 'suppliers':
        return 'Suppliers';
      case 'invoices':
        return 'Sales History';
      case 'reports':
        return 'Reports';
      case 'settings':
        return 'Settings';
      default:
        return 'Dashboard';
    }
  };

  return (
    <header className="no-print h-14 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between shrink-0 z-10 select-none">
      {/* Left: View Title Breadcrumb */}
      <div className="flex items-center gap-2.5">
        <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"></span>
        <h2 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight">
          {getTabTitle(activeTab)}
        </h2>
      </div>

      {/* Right: Shop / Context info */}
      <div className="flex items-center gap-3">
        {settings?.shopName && (
          <span className="text-xs text-slate-500 font-medium hidden sm:inline">
            {settings.shopName}
          </span>
        )}
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200/60">
          POS Active
        </span>
      </div>
    </header>
  );
};

