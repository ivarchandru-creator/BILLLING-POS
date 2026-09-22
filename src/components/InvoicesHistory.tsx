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
} from 'lucide-react';
import { Invoice, ShopSettings } from '../types';
import { formatINR, formatShopAddress, getShopLogoUrl, formatInvoiceDate, formatInvoiceTime } from '../utils/formatters';
import { downloadSalesHistoryPdf, downloadInvoicePdf } from '../utils/pdfGenerator';

interface InvoicesHistoryProps {
  invoices: Invoice[];
  settings: ShopSettings;
  onPrintInvoice: (invoice: Invoice) => void;
  onMarkCreditPaid?: (invoiceId: string) => void;
}

export const InvoicesHistory: React.FC<InvoicesHistoryProps> = ({
  invoices,
  settings,
  onPrintInvoice,
  onMarkCreditPaid,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [showPrintReportModal, setShowPrintReportModal] = useState(false);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        (inv.customerName && inv.customerName.toLowerCase().includes(q)) ||
        (inv.customerPhone && inv.customerPhone.includes(q)) ||
        (inv.customerAddress && inv.customerAddress.toLowerCase().includes(q));

      if (!matchesSearch) return false;

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
  }, [invoices, searchQuery, paymentFilter]);

  // Quick export CSV
  const handleExportCSV = () => {
    const headers = 'Invoice Number,Date Time,Customer,Payment Method,Subtotal,GST Amount,Grand Total\n';
    const rows = filteredInvoices
      .map(
        (i) =>
          `"${i.invoiceNumber}","${i.dateTime}","${i.customerName || 'Walk-in'}","${i.paymentMethod}",${i.subtotal},${i.gstAmount},${i.grandTotal}`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Sales_Invoices_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full h-full p-6 sm:p-8 overflow-y-auto space-y-6 bg-slate-50/50">
      <div className={`space-y-6 ${showPrintReportModal ? 'no-print' : ''}`}>
        {/* Header - Exact match with Image 1 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Sales & Invoices
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete history of all billed customer sales and transactions.
          </p>
        </div>

        {invoices.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              id="btn-download-sales-history-pdf"
              onClick={() => {
                const filterDesc =
                  paymentFilter !== 'all'
                    ? `Filtered by: ${paymentFilter.toUpperCase()} (${filteredInvoices.length} invoices)`
                    : `All Transactions (${filteredInvoices.length} invoices)`;
                downloadSalesHistoryPdf(filteredInvoices, settings, filterDesc);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors"
              title="Download filtered sales ledger as standard A4 PDF document"
            >
              <Download className="w-4 h-4 text-orange-500" />
              <span>Download A4 PDF</span>
            </button>

            <button
              type="button"
              id="btn-print-sales-history-report"
              onClick={() => setShowPrintReportModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors"
              title="Print Sales Report Ledger"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Print Report</span>
            </button>

            <button
              type="button"
              id="btn-export-sales-csv"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors"
              title="Export as CSV spreadsheet"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export CSV</span>
            </button>
          </div>
        )}
      </div>

      {/* Search and Payment Filter Row - Exact match with Image 1 */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by invoice number (e.g. INV-)..."
            className="w-full pl-11 pr-4 py-2.5 bg-white rounded-xl border border-slate-200/90 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Payment Filter Dropdown */}
        <div className="w-full sm:w-48">
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200/90 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-orange-500 font-medium shadow-2xs"
          >
            <option value="all">All Payments</option>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="credit">Credit (All)</option>
            <option value="credit_due">Credit (Pending Due)</option>
            <option value="credit_paid">Credit (Settled / Paid)</option>
          </select>
        </div>
      </div>

      {/* Invoices Table Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-[10.5px] uppercase font-bold text-slate-400 border-b border-slate-100 tracking-wider">
              <tr>
                <th className="py-3 px-5">Invoice #</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4 text-right">Taxable</th>
                <th className="py-3 px-4 text-right">GST Total</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                /* Empty state */
                <tr>
                  <td colSpan={8} className="py-14 text-center">
                    <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mx-auto mb-3">
                      <Receipt className="w-6 h-6 stroke-[1.5]" />
                    </div>
                    <h3 className="text-xs font-semibold text-slate-700">
                      No sales invoices match your search.
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Generated customer bills will appear here.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const taxable = Math.max(0, inv.grandTotal - (inv.gstAmount || 0));
                  const isCredit = inv.paymentMethod === 'credit';
                  const isOverdue =
                    isCredit &&
                    !inv.creditPaid &&
                    inv.paymentDueDate &&
                    new Date(inv.paymentDueDate).getTime() < new Date().setHours(0, 0, 0, 0);

                  return (
                    <tr key={inv.invoiceId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-5">
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
                      <td className="py-3.5 px-4 text-[11.5px]">
                        <div className="font-mono font-medium text-slate-800">{formatInvoiceDate(inv.dateTime)}</div>
                        <div className="text-[10.5px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-orange-500 shrink-0" />
                          <span>{formatInvoiceTime(inv.dateTime)}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
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
                      <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                        {formatINR(taxable)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                        {formatINR(inv.gstAmount || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {formatINR(inv.grandTotal)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
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
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                          {isCredit && !inv.creditPaid && onMarkCreditPaid && (
                            <button
                              type="button"
                              onClick={() => onMarkCreditPaid(inv.invoiceId)}
                              className="text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 font-semibold text-[11px] flex items-center gap-1 px-2 py-1 rounded transition-colors"
                              title="Mark this credit invoice as paid"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Mark Paid</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => downloadInvoicePdf(inv, settings)}
                            className="text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200/90 px-2 py-1 rounded font-semibold text-xs flex items-center gap-1 transition-colors"
                            title="Download invoice as standard A4 PDF (210 x 297 mm)"
                          >
                            <Download className="w-3.5 h-3.5 text-orange-500" />
                            <span className="hidden sm:inline">A4 PDF</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onPrintInvoice(inv)}
                            className="text-orange-500 hover:text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-2.5 py-1 rounded font-semibold text-xs flex items-center gap-1 transition-colors"
                            title="Print invoice"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Print</span>
                          </button>
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
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const filterDesc =
                      paymentFilter !== 'all'
                        ? `Filtered: ${paymentFilter.toUpperCase()}`
                        : 'All Transactions';
                    downloadSalesHistoryPdf(filteredInvoices, settings, filterDesc);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
                  title="Download A4 Landscape PDF"
                >
                  <Download className="w-3.5 h-3.5 text-orange-400" />
                  <span>Download A4 PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-black rounded-lg text-xs font-bold transition-colors shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Now</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPrintReportModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors ml-1"
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
                        {settings.shopName && !settings.shopName.toLowerCase().includes('electroflow')
                          ? settings.shopName
                          : 'Sri Senthur Velan Electricals and Pipes'}
                      </h1>
                      <p className="text-xs text-slate-500">{settings.tagline}</p>
                      <p className="text-xs text-slate-600 mt-1">
                        {formatShopAddress(settings) || 'Store Address'}
                      </p>
                      <p className="text-xs text-slate-600">
                        Phone: {settings.phone} {settings.gstin && `| GSTIN: ${settings.gstin}`}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="inline-block px-3 py-1 bg-slate-100 text-slate-800 font-bold text-xs rounded uppercase tracking-wider mb-1">
                      Sales Ledger Report
                    </span>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Date: {new Date().toLocaleDateString('en-IN')}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Filter: <span className="font-semibold text-slate-800 capitalize">{paymentFilter}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Summary Stats Row */}
              <div className="grid grid-cols-4 gap-3 mb-6 print-summary-grid print-avoid-break">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Bills</span>
                  <span className="text-base font-bold text-slate-900 font-mono mt-0.5 block">
                    {filteredInvoices.length}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Taxable Sales</span>
                  <span className="text-base font-bold text-slate-900 font-mono mt-0.5 block">
                    {formatINR(
                      filteredInvoices.reduce((sum, inv) => sum + Math.max(0, inv.grandTotal - (inv.gstAmount || 0)), 0)
                    )}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total GST</span>
                  <span className="text-base font-bold text-slate-900 font-mono mt-0.5 block">
                    {formatINR(filteredInvoices.reduce((sum, inv) => sum + (inv.gstAmount || 0), 0))}
                  </span>
                </div>
                <div className="p-3 bg-amber-50/70 rounded-lg border border-amber-200">
                  <span className="text-[10px] uppercase font-bold text-amber-800 block">Grand Total</span>
                  <span className="text-base font-bold text-amber-900 font-mono mt-0.5 block">
                    {formatINR(filteredInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0))}
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
                    <th className="py-2.5 px-3 border-r border-slate-200 text-center w-28">Payment</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-right w-24">Taxable</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-right w-20">GST</th>
                    <th className="py-2.5 px-3 text-right w-28">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                  {filteredInvoices.map((inv, i) => (
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
                        {formatINR(Math.max(0, inv.grandTotal - (inv.gstAmount || 0)))}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-right text-slate-700 font-mono">
                        {formatINR(inv.gstAmount || 0)}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono">
                        {formatINR(inv.grandTotal)}
                      </td>
                    </tr>
                  ))}
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
