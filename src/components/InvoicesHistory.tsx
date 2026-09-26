import React, { useState, useMemo } from 'react';
import {
  Search,
  Printer,
  Receipt,
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Download,
  FileText,
  Calendar,
  RotateCcw,
  TrendingUp,
  Trash2,
} from 'lucide-react';
import { Invoice, ShopSettings, Product, InvoiceItem } from '../types';
import {
  formatINR,
  formatShopAddress,
  formatShopContactLine,
  getShopLogoUrl,
  formatInvoiceDate,
  formatInvoiceTime,
  getInvoiceDiscount,
} from '../utils/formatters';
import { downloadSalesHistoryPdf, downloadInvoicePdf } from '../utils/pdfGenerator';

interface InvoicesHistoryProps {
  invoices: Invoice[];
  settings: ShopSettings;
  products?: Product[];
  onPrintInvoice: (invoice: Invoice) => void;
  onMarkCreditPaid?: (invoiceId: string) => void;
  onDeleteInvoice?: (invoiceId: string) => void;
}

type DatePreset = 'all' | 'today' | 'yesterday' | '7days' | 'this_month' | 'last_month' | 'custom';

const toLocalDateStr = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const InvoicesHistory: React.FC<InvoicesHistoryProps> = ({
  invoices,
  settings,
  products = [],
  onPrintInvoice,
  onMarkCreditPaid,
  onDeleteInvoice,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [showPrintReportModal, setShowPrintReportModal] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);

  // Map of productId / name to purchasePrice / costPrice
  const productCostMap = useMemo(() => {
    const map = new Map<string, number>();
    products?.forEach((p) => {
      const cost = p.purchasePrice ?? (p as any).costPrice ?? 0;
      map.set(p.productId, cost);
      if (p.name) {
        map.set(p.name.toLowerCase().trim(), cost);
      }
    });
    return map;
  }, [products]);

  // Helper to determine cost/purchase price per unit for an item
  const getItemCostPrice = (item: InvoiceItem): number => {
    if (typeof item.purchasePrice === 'number' && item.purchasePrice >= 0) {
      return item.purchasePrice;
    }
    if (typeof item.costPrice === 'number' && item.costPrice >= 0) {
      return item.costPrice;
    }
    if (item.productId && productCostMap.has(item.productId)) {
      return productCostMap.get(item.productId) || 0;
    }
    if (item.productNameSnapshot) {
      const key = item.productNameSnapshot.toLowerCase().trim();
      if (productCostMap.has(key)) {
        return productCostMap.get(key) || 0;
      }
    }
    return 0;
  };

  // Helper to compute profit and COGS for an individual invoice
  const getInvoiceProfitData = (inv: Invoice) => {
    const gross = inv.subtotal || (inv.grandTotal - (inv.gstAmount || 0));
    const discount = getInvoiceDiscount(inv);
    const taxable = Math.max(0, gross - discount);
    const cogs = inv.items.reduce(
      (sum, it) => sum + getItemCostPrice(it) * it.quantity,
      0
    );
    const profit = taxable - cogs;
    const margin = taxable > 0 ? Number(((profit / taxable) * 100).toFixed(1)) : 0;
    return { gross, discount, taxable, cogs, profit, margin };
  };

  // Date filtering state
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Handle Preset selection
  const handleSelectPreset = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    const todayStr = toLocalDateStr(now);

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yesterdayStr = toLocalDateStr(y);
      setStartDate(yesterdayStr);
      setEndDate(yesterdayStr);
    } else if (preset === '7days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      setStartDate(toLocalDateStr(d));
      setEndDate(todayStr);
    } else if (preset === 'this_month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toLocalDateStr(startOfMonth));
      setEndDate(todayStr);
    } else if (preset === 'last_month') {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(toLocalDateStr(startOfLastMonth));
      setEndDate(toLocalDateStr(endOfLastMonth));
    }
  };

  const handleClearDateFilter = () => {
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
  };

  const dateFilterLabel = useMemo(() => {
    if (!startDate && !endDate) return '';
    if (startDate && endDate) {
      if (startDate === endDate) return formatInvoiceDate(startDate);
      return `${formatInvoiceDate(startDate)} to ${formatInvoiceDate(endDate)}`;
    }
    if (startDate) return `From ${formatInvoiceDate(startDate)}`;
    return `Up to ${formatInvoiceDate(endDate)}`;
  }, [startDate, endDate]);

  const filteredInvoices = useMemo(() => {
    // Determine min and max date bounds
    const minD = startDate && endDate && startDate > endDate ? endDate : startDate;
    const maxD = startDate && endDate && startDate > endDate ? startDate : endDate;

    return invoices.filter((inv) => {
      // 1. Date Filter
      const invDate = inv.dateTime ? inv.dateTime.split(' ')[0].split('T')[0] : '';
      if (minD && invDate && invDate < minD) return false;
      if (maxD && invDate && invDate > maxD) return false;

      // 2. Search Query
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        (inv.customerName && inv.customerName.toLowerCase().includes(q)) ||
        (inv.customerPhone && inv.customerPhone.includes(q)) ||
        (inv.customerAddress && inv.customerAddress.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // 3. Payment Filter
      if (paymentFilter === 'credit_due') {
        return inv.paymentMethod === 'credit' && !inv.creditPaid;
      }
      if (paymentFilter === 'credit_paid') {
        return inv.paymentMethod === 'credit' && inv.creditPaid;
      }
      if (paymentFilter !== 'all') {
        if (inv.paymentMethod !== paymentFilter) return false;
      }
      return true;
    });
  }, [invoices, searchQuery, paymentFilter, startDate, endDate]);

  // Aggregate stats for filtered invoices including Profit & COGS
  const filteredTotals = useMemo(() => {
    return filteredInvoices.reduce(
      (acc, inv) => {
        const pData = getInvoiceProfitData(inv);
        acc.count += 1;
        acc.taxable += pData.taxable;
        acc.gst += inv.gstAmount || 0;
        acc.grandTotal += inv.grandTotal;
        acc.cogs += pData.cogs;
        acc.profit += pData.profit;
        return acc;
      },
      { count: 0, taxable: 0, gst: 0, grandTotal: 0, cogs: 0, profit: 0 }
    );
  }, [filteredInvoices, productCostMap]);

  const filteredProfitMargin = useMemo(() => {
    if (filteredTotals.taxable <= 0) return 0;
    return Number(((filteredTotals.profit / filteredTotals.taxable) * 100).toFixed(1));
  }, [filteredTotals]);

  const getPdfFilterDesc = () => {
    const parts: string[] = [];
    if (dateFilterLabel) parts.push(`Dates: ${dateFilterLabel}`);
    else parts.push('All Dates');
    if (paymentFilter !== 'all') parts.push(`Payment: ${paymentFilter.toUpperCase()}`);
    if (searchQuery) parts.push(`Search: "${searchQuery}"`);
    parts.push(`Total: ${filteredInvoices.length} invoices`);
    return parts.join(' | ');
  };

  // Quick export CSV with Profit breakdown
  const handleExportCSV = () => {
    const headers =
      'Invoice Number,Date Time,Customer,Payment Method,Gross Subtotal,Discount,Taxable,GST Amount,Grand Total,COGS (Cost),Profit,Profit Margin %\n';
    const rows = filteredInvoices
      .map((i) => {
        const pData = getInvoiceProfitData(i);
        return `"${i.invoiceNumber}","${i.dateTime}","${i.customerName || 'Walk-in'}","${i.paymentMethod}",${pData.gross},${pData.discount},${pData.taxable},${i.gstAmount || 0},${i.grandTotal},${pData.cogs},${pData.profit},${pData.margin}%`;
      })
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const datePart =
      startDate && endDate
        ? `${startDate}_to_${endDate}`
        : startDate
        ? `from_${startDate}`
        : endDate
        ? `upto_${endDate}`
        : new Date().toISOString().slice(0, 10);
    a.download = `Sales_Invoices_${datePart}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full h-full p-6 sm:p-8 overflow-y-auto space-y-6 bg-slate-50/50">
      <div className={`space-y-6 ${showPrintReportModal ? 'no-print' : ''}`}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Sales & Invoices
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Complete history of all billed customer sales and transactions. Filter by date or payment method.
            </p>
          </div>

          {invoices.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                id="btn-download-sales-history-pdf"
                onClick={() => downloadSalesHistoryPdf(filteredInvoices, settings, getPdfFilterDesc(), products)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                title="Download filtered sales ledger as standard A4 PDF document"
              >
                <Download className="w-4 h-4 text-orange-500" />
                <span>Download A4 PDF</span>
              </button>

              <button
                type="button"
                id="btn-print-sales-history-report"
                onClick={() => setShowPrintReportModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                title="Print Sales Report Ledger"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>Print Report</span>
              </button>

              <button
                type="button"
                id="btn-export-sales-csv"
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                title="Export filtered sales as CSV spreadsheet"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Export CSV</span>
              </button>
            </div>
          )}
        </div>

        {/* Filter Card with Date Controls, Search & Payment Method */}
        <div className="space-y-3">
          {/* Top Row: Search & Payment Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by invoice number, customer name, phone, or site..."
                className="w-full pl-11 pr-4 py-2.5 bg-white rounded-xl border border-slate-200/90 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Payment Filter Dropdown */}
            <div className="w-full sm:w-52">
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200/90 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-orange-500 font-medium shadow-2xs cursor-pointer"
              >
                <option value="all">All Payments</option>
                <option value="cash">Cash Only</option>
                <option value="upi">UPI Only</option>
                <option value="card">Card Only</option>
                <option value="credit">Credit (All)</option>
                <option value="credit_due">Credit (Pending Due)</option>
                <option value="credit_paid">Credit (Settled / Paid)</option>
              </select>
            </div>
          </div>

          {/* Date Range Filter Box */}
          <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Calendar className="w-4 h-4 text-orange-500 shrink-0" />
                <span>Filter by Date:</span>
                {(startDate || endDate) && (
                  <span className="text-[10px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: 'All Time' },
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: '7days', label: 'Last 7 Days' },
                  { id: 'this_month', label: 'This Month' },
                  { id: 'last_month', label: 'Last Month' },
                  { id: 'custom', label: 'Custom' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    id={`btn-date-preset-${p.id}`}
                    onClick={() => handleSelectPreset(p.id as DatePreset)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                      datePreset === p.id
                        ? 'bg-orange-500 text-black font-bold shadow-2xs ring-1 ring-orange-400'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Pickers Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <label htmlFor="filter-start-date" className="text-slate-500 font-semibold text-xs">
                    From:
                  </label>
                  <input
                    id="filter-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setDatePreset('custom');
                    }}
                    className="px-2.5 py-1.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <label htmlFor="filter-end-date" className="text-slate-500 font-semibold text-xs">
                    To:
                  </label>
                  <input
                    id="filter-end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setDatePreset('custom');
                    }}
                    className="px-2.5 py-1.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors cursor-pointer"
                  />
                </div>

                {(startDate || endDate) && (
                  <button
                    type="button"
                    id="btn-clear-date-filter"
                    onClick={handleClearDateFilter}
                    className="flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    title="Clear date range filter"
                  >
                    <X className="w-3.5 h-3.5 text-slate-500" />
                    <span>Clear Dates</span>
                  </button>
                )}
              </div>

              {/* Quick totals preview for the filtered range */}
              <div className="text-[11.5px] text-slate-600 font-medium flex flex-wrap items-center gap-2 sm:gap-3">
                <span>
                  Bills: <strong className="text-slate-900 font-bold font-mono">{filteredTotals.count}</strong>
                </span>
                <span className="text-slate-300">•</span>
                <span>
                  Sales: <strong className="text-slate-900 font-bold font-mono">{formatINR(filteredTotals.grandTotal)}</strong>
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1">
                  <span>Profit:</span>
                  <strong className={`font-bold font-mono ${filteredTotals.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {filteredTotals.profit >= 0 ? `+${formatINR(filteredTotals.profit)}` : `-${formatINR(Math.abs(filteredTotals.profit))}`}
                  </strong>
                  <span className={`text-[10px] font-mono font-semibold ${filteredProfitMargin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    ({filteredProfitMargin >= 0 ? `+${filteredProfitMargin}%` : `${filteredProfitMargin}%`})
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Active Filter Strip (when any filter is active) */}
          {(startDate || endDate || searchQuery || paymentFilter !== 'all') && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-orange-50/80 border border-orange-200/80 rounded-xl text-xs text-slate-700">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-orange-950">Active Filters:</span>
                {dateFilterLabel && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white text-orange-900 border border-orange-200 rounded font-medium text-[11px]">
                    <Calendar className="w-3 h-3 text-orange-500" />
                    {dateFilterLabel}
                  </span>
                )}
                {paymentFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white text-slate-800 border border-slate-200 rounded font-medium text-[11px] capitalize">
                    Payment: {paymentFilter.replace('_', ' ')}
                  </span>
                )}
                {searchQuery && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white text-slate-800 border border-slate-200 rounded font-medium text-[11px]">
                    Search: "{searchQuery}"
                  </span>
                )}
                <span className="text-slate-500 font-medium">
                  ({filteredInvoices.length} of {invoices.length} total)
                </span>
              </div>

              <button
                type="button"
                id="btn-reset-all-filters"
                onClick={() => {
                  handleClearDateFilter();
                  setPaymentFilter('all');
                  setSearchQuery('');
                }}
                className="text-xs font-semibold text-orange-700 hover:text-orange-900 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset All Filters</span>
              </button>
            </div>
          )}
        </div>

        {/* Invoices Table Card */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-[10.5px] uppercase font-bold text-slate-400 border-b border-slate-100 tracking-wider">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-3">Date & Time</th>
                  <th className="py-3 px-3">Payment</th>
                  <th className="py-3 px-3 text-right">Taxable</th>
                  <th className="py-3 px-3 text-right">GST</th>
                  <th className="py-3 px-3 text-right">Grand Total</th>
                  <th className="py-3 px-4 text-right">Profit</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.length === 0 ? (
                  /* Empty state */
                  <tr>
                    <td colSpan={9} className="py-14 text-center">
                      <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mx-auto mb-3">
                        <Receipt className="w-6 h-6 stroke-[1.5]" />
                      </div>
                      <h3 className="text-xs font-semibold text-slate-700">
                        No sales invoices match your search or date filter.
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Try clearing or widening your date filter range.
                      </p>
                      {(startDate || endDate || paymentFilter !== 'all' || searchQuery) && (
                        <button
                          type="button"
                          onClick={() => {
                            handleClearDateFilter();
                            setPaymentFilter('all');
                            setSearchQuery('');
                          }}
                          className="mt-3 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                          Clear Filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => {
                    const pData = getInvoiceProfitData(inv);
                    const isCredit = inv.paymentMethod === 'credit';
                    const isOverdue =
                      isCredit &&
                      !inv.creditPaid &&
                      inv.paymentDueDate &&
                      new Date(inv.paymentDueDate).getTime() < new Date().setHours(0, 0, 0, 0);

                    return (
                      <tr key={inv.invoiceId} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-slate-900">
                            {inv.invoiceNumber}
                          </span>
                          {inv.customerName && (
                            <p className="text-[11px] text-slate-500 truncate max-w-[150px] font-medium">
                              {inv.customerName}
                            </p>
                          )}
                          {inv.customerAddress && (
                            <p className="text-[10px] text-slate-400 truncate max-w-[150px]">
                              Site: {inv.customerAddress}
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-[11.5px]">
                          <div className="font-mono font-medium text-slate-800">{formatInvoiceDate(inv.dateTime)}</div>
                          <div className="text-[10.5px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-orange-500 shrink-0" />
                            <span>{formatInvoiceTime(inv.dateTime)}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <div>
                            <span className={`capitalize px-2 py-0.5 rounded text-[10.5px] font-semibold ${
                              isCredit
                                ? inv.creditPaid
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : isOverdue
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {isCredit ? (inv.creditPaid ? 'Credit (Paid)' : 'Credit (Due)') : inv.paymentMethod}
                            </span>
                            {isCredit && inv.paymentDueDate && (
                              <p className="text-[10px] text-slate-400 mt-1 font-mono">
                                Due: {inv.paymentDueDate}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-slate-700">
                          {formatINR(pData.taxable)}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-slate-700">
                          {formatINR(inv.gstAmount || 0)}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">
                          {formatINR(inv.grandTotal)}
                        </td>
                        {/* Profit from that specific sale */}
                        <td className="py-3.5 px-4 text-right">
                          <div className={`font-mono font-bold text-xs flex items-center justify-end gap-0.5 ${
                            pData.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}>
                            <span>{pData.profit >= 0 ? `+${formatINR(pData.profit)}` : `-${formatINR(Math.abs(pData.profit))}`}</span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5 flex items-center justify-end gap-1">
                            <span className={`font-semibold ${pData.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {pData.margin >= 0 ? `+${pData.margin}%` : `${pData.margin}%`}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span title={`Cost of Goods Sold (COGS): ${formatINR(pData.cogs)}`}>Cost: {formatINR(pData.cogs)}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          {isCredit && !inv.creditPaid ? (
                            isOverdue ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                <span>Overdue</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Payment Due</span>
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                              {isCredit && inv.creditPaid ? 'Settled' : 'Completed'}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 sm:gap-2 flex-wrap">
                            {/* Option 1: Download Bill for Customer with instant A4/A5 */}
                            <div className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50/70 p-0.5 shadow-2xs">
                              <button
                                type="button"
                                id={`btn-download-bill-${inv.invoiceNumber}`}
                                onClick={() => downloadInvoicePdf(inv, settings, inv.templateType === 'a5' ? 'a5' : 'a4')}
                                className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-blue-700 hover:text-blue-900 hover:bg-blue-100/80 rounded transition-colors cursor-pointer"
                                title={`Download customer bill PDF (${inv.templateType === 'a5' ? 'A5' : 'A4'})`}
                              >
                                <Download className="w-3.5 h-3.5 text-blue-600" />
                                <span>Download Bill</span>
                              </button>

                              <span className="h-3.5 w-px bg-blue-200 mx-0.5" />

                              <button
                                type="button"
                                id={`btn-download-a4-${inv.invoiceNumber}`}
                                onClick={() => downloadInvoicePdf(inv, settings, 'a4')}
                                className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors cursor-pointer ${
                                  inv.templateType !== 'a5'
                                    ? 'bg-blue-600 text-white shadow-2xs'
                                    : 'text-blue-700 hover:bg-blue-100'
                                }`}
                                title="Download standard A4 Bill PDF"
                              >
                                A4
                              </button>
                              <button
                                type="button"
                                id={`btn-download-a5-${inv.invoiceNumber}`}
                                onClick={() => downloadInvoicePdf(inv, settings, 'a5')}
                                className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors cursor-pointer ${
                                  inv.templateType === 'a5'
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : 'text-emerald-700 hover:bg-emerald-100'
                                }`}
                                title="Download compact A5 Half Sheet Bill PDF"
                              >
                                A5
                              </button>
                            </div>

                            {/* Print Bill Button */}
                            <button
                              type="button"
                              id={`btn-print-bill-${inv.invoiceNumber}`}
                              onClick={() => onPrintInvoice(inv)}
                              className="p-1.5 text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors cursor-pointer"
                              title="Print bill / open print dialog"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            {/* Mark Paid Button (for credit) */}
                            {isCredit && !inv.creditPaid && onMarkCreditPaid && (
                              <button
                                type="button"
                                onClick={() => onMarkCreditPaid(inv.invoiceId)}
                                className="text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 font-semibold text-[11px] flex items-center gap-1 px-2 py-1 rounded transition-colors cursor-pointer"
                                title="Mark this credit invoice as paid"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span className="hidden sm:inline">Paid</span>
                              </button>
                            )}

                            {/* Delete Invoice Button */}
                            {onDeleteInvoice && (
                              <button
                                type="button"
                                id={`btn-delete-invoice-${inv.invoiceId}`}
                                onClick={() => setInvoiceToDelete(inv)}
                                className="p-1.5 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                                title="Delete invoice, restore stock & reverse revenue"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 text-center">
                Delete Bill #{invoiceToDelete.invoiceNumber}?
              </h3>
              <p className="text-xs text-slate-500 text-center mt-1">
                This action cannot be undone. Reversing this sale will perform the following updates:
              </p>

              <div className="bg-slate-50 rounded-xl p-3.5 mt-4 space-y-2 text-xs text-slate-700 border border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-semibold text-slate-900">{invoiceToDelete.customerName || 'Walk-in Customer'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Grand Total:</span>
                  <span className="font-mono font-bold text-slate-900">{formatINR(invoiceToDelete.grandTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Type:</span>
                  <span className="font-semibold capitalize text-slate-900">{invoiceToDelete.paymentMethod}</span>
                </div>

                <div className="border-t border-slate-200 pt-2 mt-2">
                  <span className="font-semibold text-slate-800 block mb-1">Items to restore to inventory:</span>
                  <ul className="space-y-1 max-h-32 overflow-y-auto">
                    {invoiceToDelete.items.map((item, idx) => (
                      <li key={idx} className="flex justify-between text-[11px] text-slate-600">
                        <span>• {item.productNameSnapshot || (item as any).name || 'Product'}</span>
                        <span className="font-mono font-semibold text-emerald-700">+{item.quantity} {item.unit || 'pcs'}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {invoiceToDelete.paymentMethod === 'credit' && !invoiceToDelete.creditPaid && (
                  <div className="border-t border-slate-200 pt-2 mt-2 text-[11px] text-amber-800 font-medium bg-amber-50 p-2 rounded">
                    ⚠️ Pending credit balance of {formatINR(invoiceToDelete.grandTotal)} will be deducted from customer account.
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setInvoiceToDelete(null)}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onDeleteInvoice) {
                      onDeleteInvoice(invoiceToDelete.invoiceId);
                    }
                    setInvoiceToDelete(null);
                  }}
                  className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Confirm Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Sales Report Modal */}
      {showPrintReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 overflow-y-auto print-modal-backdrop">
          <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-300 print-modal-sheet">
            {/* Modal Actions Bar (Hidden in Print) */}
            <div className="no-print flex items-center justify-between px-5 py-3 bg-slate-900 text-white border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-500 text-white rounded">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Sales Ledger & Invoices Print Preview</h2>
                  <p className="text-[11px] text-slate-400">
                    {filteredInvoices.length} invoices ready for printing / export
                    {dateFilterLabel && ` • ${dateFilterLabel}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadSalesHistoryPdf(filteredInvoices, settings, getPdfFilterDesc(), products)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                  title="Download A4 Landscape PDF"
                >
                  <Download className="w-3.5 h-3.5 text-orange-400" />
                  <span>Download A4 PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-black rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Now</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPrintReportModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Report Body */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-white print-container print-document print-a4-sheet">
              {/* Header */}
              <div className="border-b border-slate-300 pb-4 mb-5">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-start gap-3.5">
                    <img
                      id="img-history-print-logo"
                      src={getShopLogoUrl(settings)}
                      alt="Store Logo"
                      className="w-12 h-18 shrink-0 object-contain"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h1 className="text-xl font-bold text-slate-900 uppercase tracking-tight">
                        {settings.shopName || 'Store'}
                      </h1>
                      {settings.tagline && <p className="text-xs text-slate-500">{settings.tagline}</p>}
                      {formatShopAddress(settings) && (
                        <p className="text-xs text-slate-600 mt-1">
                          {formatShopAddress(settings)}
                        </p>
                      )}
                      {formatShopContactLine(settings) && (
                        <p className="text-xs text-slate-600">
                          {formatShopContactLine(settings)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="inline-block px-3 py-1 bg-slate-100 text-slate-800 font-bold text-xs rounded uppercase tracking-wider mb-1">
                      Sales Ledger Report
                    </span>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Generated: {new Date().toLocaleDateString('en-IN')}
                    </p>
                    <p className="text-[11px] text-slate-700">
                      Date Range: <span className="font-semibold text-slate-900">{dateFilterLabel || 'All Time'}</span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Payment: <span className="font-semibold text-slate-800 capitalize">{paymentFilter.replace('_', ' ')}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Summary Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6 print-summary-grid print-avoid-break">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Bills</span>
                  <span className="text-base font-bold text-slate-900 font-mono mt-0.5 block">
                    {filteredTotals.count}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Taxable Sales</span>
                  <span className="text-base font-bold text-slate-900 font-mono mt-0.5 block">
                    {formatINR(filteredTotals.taxable)}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total GST</span>
                  <span className="text-base font-bold text-slate-900 font-mono mt-0.5 block">
                    {formatINR(filteredTotals.gst)}
                  </span>
                </div>
                <div className="p-3 bg-amber-50/70 rounded-lg border border-amber-200">
                  <span className="text-[10px] uppercase font-bold text-amber-800 block">Grand Total</span>
                  <span className="text-base font-bold text-amber-900 font-mono mt-0.5 block">
                    {formatINR(filteredTotals.grandTotal)}
                  </span>
                </div>
                <div className="p-3 bg-emerald-50/80 rounded-lg border border-emerald-200">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">Total Profit</span>
                  <span className="text-base font-bold text-emerald-900 font-mono mt-0.5 block">
                    {filteredTotals.profit >= 0 ? `+${formatINR(filteredTotals.profit)}` : `-${formatINR(Math.abs(filteredTotals.profit))}`}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-mono block mt-0.5">
                    Margin: {filteredProfitMargin}%
                  </span>
                </div>
              </div>

              {/* Invoices Table */}
              <table className="w-full text-left text-xs border border-slate-300 print-table">
                <thead className="bg-slate-100 text-slate-700 text-[10.5px] uppercase font-bold border-b border-slate-300">
                  <tr>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-center w-10">#</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-left w-24">Invoice No</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-center w-24">Date</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-left">Customer</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-center w-24">Payment</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-right w-22">Taxable</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-right w-18">GST</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-right w-24">Total</th>
                    <th className="py-2.5 px-3 text-right w-24">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                  {filteredInvoices.map((inv, i) => {
                    const pData = getInvoiceProfitData(inv);
                    return (
                      <tr key={inv.invoiceId} className="hover:bg-slate-50">
                        <td className="py-2 px-3 border-r border-slate-200 text-center text-slate-500 font-mono">{i + 1}</td>
                        <td className="py-2 px-3 border-r border-slate-200 font-bold text-slate-900 text-left">{inv.invoiceNumber}</td>
                        <td className="py-2 px-3 border-r border-slate-200 text-slate-700 text-center">
                          <div className="font-medium text-slate-800">{formatInvoiceDate(inv.dateTime)}</div>
                          <div className="text-[10px] text-slate-500">{formatInvoiceTime(inv.dateTime)}</div>
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 font-sans text-slate-800 text-left">
                          <div className="font-semibold">{inv.customerName || 'Walk-in'}</div>
                          {inv.customerPhone && <div className="text-[10px] text-slate-500 font-mono">{inv.customerPhone}</div>}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 uppercase text-[10.5px] text-center">
                          {inv.paymentMethod === 'credit'
                            ? inv.creditPaid ? 'Credit (Paid)' : `Credit (Due: ${inv.paymentDueDate || '-'})`
                            : inv.paymentMethod}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-right text-slate-700 font-mono">
                          {formatINR(pData.taxable)}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-right text-slate-700 font-mono">
                          {formatINR(inv.gstAmount || 0)}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-right font-bold text-slate-900 font-mono">
                          {formatINR(inv.grandTotal)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-700 font-mono">
                          {pData.profit >= 0 ? `+${formatINR(pData.profit)}` : `-${formatINR(Math.abs(pData.profit))}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Report Footer */}
              <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400 print-signatory-footer">
                <span>Official Sales Ledger & Billing Management Audit</span>
                <span>Authorized Signatory ___________________</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

