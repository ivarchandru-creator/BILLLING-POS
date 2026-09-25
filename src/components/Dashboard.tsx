import React, { useMemo } from 'react';
import {
  IndianRupee,
  Package,
  AlertTriangle,
  Receipt,
  Printer,
  ArrowRight,
  Clock,
  Calendar,
  Phone,
  MessageCircle,
  CheckCircle2,
  MapPin,
  Wallet,
  Truck,
} from 'lucide-react';
import { Invoice, Product, ShopSettings, ActiveTab, Supplier } from '../types';
import { formatINR, formatInvoiceDate, formatInvoiceTime } from '../utils/formatters';

interface DashboardProps {
  invoices: Invoice[];
  products: Product[];
  suppliers?: Supplier[];
  settings: ShopSettings;
  setActiveTab: (tab: ActiveTab) => void;
  onPrintInvoice: (invoice: Invoice) => void;
  onOpenStockModal?: () => void;
  onMarkCreditPaid?: (invoiceId: string) => void;
  onNavigateToReports?: () => void;
  onNavigateToInventory?: (filter?: 'all' | 'low') => void;
  onNavigateToCustomers?: (creditPendingOnly?: boolean) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  invoices,
  products,
  suppliers = [],
  settings,
  setActiveTab,
  onPrintInvoice,
  onOpenStockModal,
  onMarkCreditPaid,
  onNavigateToReports,
  onNavigateToInventory,
  onNavigateToCustomers,
}) => {
  // Today's date prefix (YYYY-MM-DD)
  const todayStr = new Date().toISOString().split('T')[0];
  const todayObj = new Date();
  todayObj.setHours(0, 0, 0, 0);

  // Invoices created today (or latest invoices)
  const todayInvoices = invoices.filter((inv) =>
    inv.dateTime?.startsWith(todayStr)
  );
  const todaySalesTotal = todayInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);

  // Low stock products
  const lowStockItems = products.filter((p) => p.stockQty <= p.minimumStock);

  // Recent 6 transactions
  const recentInvoices = invoices.slice(0, 6);

  // All pending (unpaid) credit invoices
  const pendingCreditInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.paymentMethod === 'credit' && !inv.creditPaid);
  }, [invoices]);

  // Credit reminders with calculated overdue status
  const creditReminders = useMemo(() => {
    return pendingCreditInvoices
      .map((inv) => {
        let isOverdue = false;
        let isDueToday = false;
        let daysDiff = 0;

        if (inv.paymentDueDate) {
          const due = new Date(inv.paymentDueDate);
          due.setHours(0, 0, 0, 0);
          const diffMs = todayObj.getTime() - due.getTime();
          daysDiff = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          if (daysDiff > 0) {
            isOverdue = true;
          } else if (daysDiff === 0) {
            isDueToday = true;
          }
        }

        return {
          ...inv,
          isOverdue,
          isDueToday,
          daysDiff,
        };
      })
      .sort((a, b) => {
        // Overdue first (highest days overdue), then due today, then upcoming
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        if (a.isOverdue && b.isOverdue) return b.daysDiff - a.daysDiff;
        if (a.isDueToday && !b.isDueToday) return -1;
        if (!a.isDueToday && b.isDueToday) return 1;
        return (a.paymentDueDate || '').localeCompare(b.paymentDueDate || '');
      });
  }, [pendingCreditInvoices, todayObj]);

  const overdueCount = creditReminders.filter((r) => r.isOverdue).length;
  const dueTodayCount = creditReminders.filter((r) => r.isDueToday).length;
  const totalCreditDueAmount = pendingCreditInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);

  return (
    <div className="w-full h-full p-4 sm:p-6 overflow-y-auto space-y-6 bg-slate-50 font-sans">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Dashboard Overview
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Real-time sales, inventory alerts, and credit ledger summary.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('billing')}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>+ New Invoice</span>
          </button>
        </div>
      </div>

      {/* 4 Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Sales -> Navigates to Reports */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            if (onNavigateToReports) {
              onNavigateToReports();
            } else {
              setActiveTab('reports');
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              if (onNavigateToReports) onNavigateToReports();
              else setActiveTab('reports');
            }
          }}
          className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-emerald-400/80 transition-all cursor-pointer group active:scale-[0.99]"
          title="Click to view Sales Reports"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-emerald-700 transition-colors flex items-center gap-1.5">
              <span>Today's Sales</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-emerald-600" />
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-base shadow-2xs group-hover:scale-105 transition-transform">
              ₹
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {formatINR(todaySalesTotal)}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>{todayInvoices.length} invoices generated today</span>
              <span className="text-[10.5px] font-semibold text-emerald-600 group-hover:underline">Reports &rarr;</span>
            </p>
          </div>
        </div>

        {/* Card 2: Total Inventory -> Navigates to Products Section */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            if (onNavigateToInventory) {
              onNavigateToInventory('all');
            } else {
              setActiveTab('inventory');
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              if (onNavigateToInventory) onNavigateToInventory('all');
              else setActiveTab('inventory');
            }
          }}
          className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-blue-400/80 transition-all cursor-pointer group active:scale-[0.99]"
          title="Click to view Products & Inventory"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-blue-700 transition-colors flex items-center gap-1.5">
              <span>Total Inventory</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-blue-600" />
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {products.length} <span className="text-xs font-sans font-medium text-slate-400">items</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>All catalog products</span>
              <span className="text-[10.5px] font-semibold text-blue-600 group-hover:underline">Products &rarr;</span>
            </p>
          </div>
        </div>

        {/* Card 3: Low Stock Alerts -> Navigates to Products Section & Shows Low Stock */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            if (onNavigateToInventory) {
              onNavigateToInventory('low');
            } else {
              setActiveTab('inventory');
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              if (onNavigateToInventory) onNavigateToInventory('low');
              else setActiveTab('inventory');
            }
          }}
          className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-amber-400/80 transition-all cursor-pointer group active:scale-[0.99]"
          title="Click to view Low Stock Products"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-amber-700 transition-colors flex items-center gap-1.5">
              <span>Low Stock Alerts</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-amber-600" />
            </span>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform ${
              lowStockItems.length > 0
                ? 'bg-amber-50 text-amber-600'
                : 'bg-slate-50 text-slate-400'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className={`text-2xl font-bold font-mono tracking-tight ${
              lowStockItems.length > 0 ? 'text-amber-600' : 'text-slate-900'
            }`}>
              {lowStockItems.length} <span className="text-xs font-sans font-medium text-slate-400">items</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>{lowStockItems.length > 0 ? 'Requires reordering' : 'Stock levels healthy'}</span>
              <span className="text-[10.5px] font-semibold text-amber-600 group-hover:underline">View Low Stock &rarr;</span>
            </p>
          </div>
        </div>

        {/* Card 4: Credit Balance Due -> Navigates to Customers Section & Shows Credit Pending */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            if (onNavigateToCustomers) {
              onNavigateToCustomers(true);
            } else {
              setActiveTab('customers');
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              if (onNavigateToCustomers) onNavigateToCustomers(true);
              else setActiveTab('customers');
            }
          }}
          className={`rounded-2xl border p-5 shadow-xs flex flex-col justify-between transition-all hover:shadow-md cursor-pointer group active:scale-[0.99] ${
            overdueCount > 0
              ? 'bg-rose-50/40 border-rose-200 hover:border-rose-400'
              : pendingCreditInvoices.length > 0
              ? 'bg-amber-50/40 border-amber-200 hover:border-amber-400'
              : 'bg-white border-slate-200/80 hover:border-purple-300'
          }`}
          title="Click to view Customers with Credit Pending"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider group-hover:text-amber-900 transition-colors flex items-center gap-1.5">
              <span>Credit Due</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-amber-700" />
            </span>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform ${
              overdueCount > 0
                ? 'bg-rose-100 text-rose-600'
                : pendingCreditInvoices.length > 0
                ? 'bg-amber-100 text-amber-600'
                : 'bg-purple-50 text-purple-600'
            }`}>
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className={`text-2xl font-bold font-mono tracking-tight ${
              overdueCount > 0 ? 'text-rose-600' : pendingCreditInvoices.length > 0 ? 'text-amber-700' : 'text-slate-900'
            }`}>
              {formatINR(totalCreditDueAmount)}
            </h3>
            <div className="flex items-center justify-between gap-1.5 mt-1">
              <div>
                {overdueCount > 0 ? (
                  <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                    {overdueCount} Overdue
                  </span>
                ) : dueTodayCount > 0 ? (
                  <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                    {dueTodayCount} Due Today
                  </span>
                ) : pendingCreditInvoices.length > 0 ? (
                  <span className="text-[11px] text-slate-500 font-medium">
                    {pendingCreditInvoices.length} pending bills
                  </span>
                ) : (
                  <span className="text-[11px] text-emerald-600 font-medium">All settled</span>
                )}
              </div>
              <span className="text-[10.5px] font-semibold text-amber-800 group-hover:underline">
                Credit Customers &rarr;
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Credit Payment Reminders Section */}
      {creditReminders.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200/80 shadow-xs overflow-hidden">
          {/* Header Bar */}
          <div className="p-4 bg-linear-to-r from-amber-50/80 to-orange-50/40 border-b border-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  Payment Due & Credit Reminders
                </h2>
                {overdueCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                    {overdueCount} Overdue
                  </span>
                )}
                {dueTodayCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                    {dueTodayCount} Due Today
                  </span>
                )}
              </div>
            </div>

            <div className="text-left sm:text-right font-mono">
              <span className="text-xs text-slate-500">Total Pending:</span>{' '}
              <strong className="text-sm font-bold text-amber-700">
                {formatINR(totalCreditDueAmount)}
              </strong>
            </div>
          </div>

          {/* Reminders Items List */}
          <div className="divide-y divide-slate-100">
            {creditReminders.map((reminder) => {
              const whatsappMessage = encodeURIComponent(
                `Hello ${reminder.customerName || 'Sir'},\nThis is a gentle payment reminder from ${
                  settings.shopName || 'our store'
                } regarding invoice #${reminder.invoiceNumber} of amount ${formatINR(
                  reminder.grandTotal
                )}, which was scheduled for payment on ${
                  reminder.paymentDueDate || 'today'
                }.\nKindly settle at your earliest convenience. Thank you!`
              );

              return (
                <div
                  key={reminder.invoiceId}
                  className={`p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 transition-colors ${
                    reminder.isOverdue
                      ? 'bg-rose-50/30 hover:bg-rose-50/50'
                      : reminder.isDueToday
                      ? 'bg-amber-50/30 hover:bg-amber-50/50'
                      : 'hover:bg-slate-50/60'
                  }`}
                >
                  {/* Left info */}
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">
                        {reminder.customerName || 'Walk-in Customer'}
                      </span>

                      {reminder.customerCategory && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">
                          {reminder.customerCategory}
                        </span>
                      )}

                      {/* Status Badges */}
                      {reminder.isOverdue ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-rose-100 text-rose-700">
                          <AlertTriangle className="w-3 h-3 text-rose-500" />
                          <span>Overdue by {reminder.daysDiff} day{reminder.daysDiff > 1 ? 's' : ''}</span>
                        </span>
                      ) : reminder.isDueToday ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-100 text-amber-800">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Due Today</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-medium bg-blue-50 text-blue-700">
                          <Calendar className="w-3 h-3 text-blue-500" />
                          <span>Promised: {reminder.paymentDueDate}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500">
                      <span>
                        Bill: <strong className="font-mono text-slate-700 font-semibold">{reminder.invoiceNumber}</strong> ({reminder.dateTime?.split(' ')[0]})
                      </span>

                      {reminder.customerPhone && (
                        <span className="flex items-center gap-1 font-mono text-slate-700 font-medium">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{reminder.customerPhone}</span>
                        </span>
                      )}

                      {reminder.customerAddress && (
                        <span className="flex items-center gap-1 text-slate-500 truncate max-w-sm">
                          <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
                          <span className="truncate">Site: {reminder.customerAddress}</span>
                        </span>
                      )}

                      {reminder.customerGstin && (
                        <span className="font-mono text-[11px] text-slate-400">
                          GSTIN: {reminder.customerGstin}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex flex-wrap items-center gap-2 self-start lg:self-center shrink-0">
                    <div className="text-left lg:text-right pr-2">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider block">Due Amount</span>
                      <span className="text-base font-bold text-slate-900 font-mono">
                        {formatINR(reminder.grandTotal)}
                      </span>
                    </div>

                    {/* Quick Call Button */}
                    {reminder.customerPhone && (
                      <a
                        href={`tel:${reminder.customerPhone}`}
                        className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors shadow-2xs"
                        title={`Call ${reminder.customerPhone}`}
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    )}

                    {/* Quick WhatsApp Reminder */}
                    {reminder.customerPhone && (
                      <a
                        href={`https://wa.me/91${reminder.customerPhone.replace(/\D/g, '')}?text=${whatsappMessage}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold transition-colors shadow-2xs"
                        title="Send WhatsApp Payment Reminder"
                      >
                        <MessageCircle className="w-4 h-4 text-emerald-600" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </a>
                    )}

                    {/* View / Print Invoice */}
                    <button
                      type="button"
                      onClick={() => onPrintInvoice(reminder)}
                      className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shadow-2xs"
                      title="View / Print Invoice"
                    >
                      <Printer className="w-4 h-4" />
                    </button>

                    {/* MARK AS PAID BUTTON */}
                    {onMarkCreditPaid && (
                      <button
                        type="button"
                        onClick={() => onMarkCreditPaid(reminder.invoiceId)}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-2xs cursor-pointer"
                        title="Click when payment is received to clear from Dashboard"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Mark as Paid</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Recent Transactions Table (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">
              Recent Transactions
            </h2>
            <button
              type="button"
              id="btn-dash-view-all"
              onClick={() => setActiveTab('invoices')}
              className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Payment</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400 text-xs">
                      No transactions recorded yet today. Click "+ New Invoice" to start billing.
                    </td>
                  </tr>
                ) : (
                  recentInvoices.map((inv) => (
                    <tr key={inv.invoiceId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-3 text-slate-600 text-[11px]">
                        <div className="font-medium text-slate-900">{formatInvoiceDate(inv.dateTime)}</div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{formatInvoiceTime(inv.dateTime)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="capitalize px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-slate-100 text-slate-700">
                          {inv.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900 font-mono">
                        {formatINR(inv.grandTotal)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          Completed
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => onPrintInvoice(inv)}
                          className="text-slate-600 hover:text-slate-900 font-medium text-xs inline-flex items-center gap-1 border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1 rounded-lg cursor-pointer transition-colors shadow-2xs"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Print</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Stock Alerts (1 col) */}
        <div className="space-y-6">
          {/* Stock Alerts Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  Stock Alerts
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onNavigateToInventory) onNavigateToInventory('low');
                  else setActiveTab('inventory');
                }}
                className="text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors cursor-pointer"
              >
                Manage
              </button>
            </div>

            {lowStockItems.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">
                All inventory items are above minimum stock levels.
              </p>
            ) : (
              <div className="space-y-2.5">
                {lowStockItems.slice(0, 5).map((item) => {
                  const sup = (suppliers || []).find((s) => s.supplierId === item.supplierId);
                  return (
                    <div
                      key={item.productId}
                      onClick={() => {
                        if (onNavigateToInventory) onNavigateToInventory('low');
                        else setActiveTab('inventory');
                      }}
                      className="p-3 rounded-xl border border-amber-200/80 bg-amber-50/40 hover:bg-amber-50/80 transition-colors flex items-start justify-between text-xs gap-2 cursor-pointer"
                      title="Click to view in Inventory"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 truncate">{item.name}</p>
                        <p className="text-[11px] text-amber-700 font-mono mt-0.5 font-medium">
                          Only {item.stockQty} {item.unit} left (Min: {item.minimumStock})
                        </p>
                        {sup ? (
                          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-600">
                            <Truck className="w-3 h-3 text-orange-500 shrink-0" />
                            <span className="font-semibold text-slate-800 truncate" title={sup.companyName}>
                              {sup.companyName}
                            </span>
                            {sup.phone && (
                              <a
                                href={`tel:${sup.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-0.5 text-orange-600 hover:text-orange-700 font-mono font-semibold ml-auto"
                                title={`Call supplier ${sup.name} (${sup.phone})`}
                              >
                                <Phone className="w-2.5 h-2.5" />
                                <span>{sup.phone}</span>
                              </a>
                            )}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 mt-1 italic">
                            Supplier: Open Market / Unassigned
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-amber-800 bg-white px-2 py-0.5 rounded-full border border-amber-200/60 shadow-2xs shrink-0">
                        Low
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
