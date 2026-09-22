import React, { useState, useEffect, useMemo } from 'react';
import { Printer, X, FileText, Receipt, MapPin, Phone, Download, Layers } from 'lucide-react';
import { Invoice, ShopSettings, PrinterType, ThermalWidth } from '../types';
import { formatINR, getInvoiceDiscount, formatShopAddress, getShopLogoUrl, formatInvoiceDate, formatInvoiceTime, formatInvoiceDateTime } from '../utils/formatters';
import { downloadInvoicePdf } from '../utils/pdfGenerator';
import { paginateInvoiceItems } from '../utils/invoicePagination';

interface BillPrintModalProps {
  invoice: Invoice;
  settings: ShopSettings;
  isOpen: boolean;
  onClose: () => void;
}

export const BillPrintModal: React.FC<BillPrintModalProps> = ({
  invoice,
  settings,
  isOpen,
  onClose,
}) => {
  // Determine printer type based on store default configured in Settings:
  // "in settings if they are setting default as ink it should be selected while printing invoice,
  // if they are setting thermal as a default printer, like this printer selecting should work"
  const getInitialPrinterType = (): PrinterType => {
    if (settings.defaultPrinterType === 'thermal') return 'thermal';
    return 'ink'; // Default is always ink printer unless thermal is explicitly set in settings
  };

  const [selectedPrinterType, setSelectedPrinterType] = useState<PrinterType>(getInitialPrinterType());
  const [selectedThermalWidth, setSelectedThermalWidth] = useState<ThermalWidth>(
    settings.thermalPaperWidth || '80mm'
  );

  // Whenever the modal opens or settings default changes, sync with settings default printer
  useEffect(() => {
    if (isOpen) {
      setSelectedPrinterType(getInitialPrinterType());
      setSelectedThermalWidth(settings.thermalPaperWidth || '80mm');
    }
  }, [isOpen, invoice.invoiceId, settings.defaultPrinterType, settings.thermalPaperWidth]);

  // Paginate items for A4 Ink printing:
  // If invoice list exceeds single A4 sheet capacity, split into multiple pages
  // with totals and footer added on the last page only.
  const invoicePages = useMemo(() => {
    return paginateInvoiceItems(invoice.items);
  }, [invoice.items]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const totalDiscount = getInvoiceDiscount(invoice);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 overflow-y-auto print-modal-backdrop">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-lg shadow-xl overflow-hidden border border-slate-300 print-modal-sheet">
        {/* Modal Top Bar - Hidden when printing */}
        <div className="no-print flex items-center justify-between px-4 py-2.5 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600 text-white rounded">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  Print Bill: {invoice.invoiceNumber}
                </h2>
                {selectedPrinterType === 'ink' && invoicePages.length > 1 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-black">
                    <Layers className="w-3 h-3" />
                    {invoicePages.length} Pages
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                {formatInvoiceDateTime(invoice.dateTime)} • {invoice.customerName || 'Walk-in'} • {invoice.items.length} items
                {selectedPrinterType === 'ink' && (
                  <span className="text-orange-300 font-medium"> ({invoicePages.length} A4 {invoicePages.length > 1 ? 'Sheets' : 'Sheet'})</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Format Switcher */}
            <div className="flex items-center bg-slate-800 p-0.5 rounded border border-slate-700">
              <button
                type="button"
                id="btn-switch-thermal"
                onClick={() => setSelectedPrinterType('thermal')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                  selectedPrinterType === 'thermal'
                    ? 'bg-orange-500 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                Thermal ({selectedThermalWidth})
              </button>
              <button
                type="button"
                id="btn-switch-ink"
                onClick={() => setSelectedPrinterType('ink')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                  selectedPrinterType === 'ink'
                    ? 'bg-orange-500 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Ink (A4{invoicePages.length > 1 ? ` • ${invoicePages.length}P` : ''})
              </button>
            </div>

            <button
              type="button"
              id="btn-modal-download-pdf"
              onClick={() => downloadInvoicePdf(invoice, settings)}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-semibold border border-slate-700 transition-colors"
              title="Download standard A4 Invoice PDF (210 x 297 mm)"
            >
              <Download className="w-3.5 h-3.5 text-orange-400" />
              <span>A4 PDF</span>
            </button>

            <button
              type="button"
              id="btn-modal-close"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-100 flex justify-center items-start print-viewport">
          <div className="w-full flex justify-center">
            {selectedPrinterType === 'thermal' ? (
              /* THERMAL RECEIPT TEMPLATE */
              <div
                id="thermal-receipt"
                className={`bg-white text-black p-4 sm:p-5 shadow-lg border border-zinc-300 font-mono text-xs rounded-sm ${
                  selectedThermalWidth === '58mm' ? 'w-[280px]' : 'w-[360px]'
                }`}
              >
                {/* Thermal Header */}
                <div className="pb-3 border-b border-dashed border-zinc-400">
                  <div className="flex items-start gap-2.5">
                    {/* Top Left Corner Thermal Logo */}
                    <img
                      id="img-thermal-bill-logo"
                      src={getShopLogoUrl(settings)}
                      alt="Store Logo"
                      className="w-10 h-14 shrink-0 object-contain"
                      referrerPolicy="no-referrer"
                    />
                    <div className="text-left space-y-0.5 flex-1 min-w-0">
                      <h1 className="text-sm font-bold uppercase tracking-tight leading-tight">
                        {settings.shopName}
                      </h1>
                      <p className="text-[10px] font-sans text-zinc-500">
                        {settings.tagline}
                      </p>
                      <p className="text-[10px] text-zinc-600 leading-tight">
                        {formatShopAddress(settings) || 'Store Address'}
                      </p>
                      <p className="text-[10px] text-zinc-600">Ph: {settings.phone}</p>
                      {settings.gstin && (
                        <p className="text-[10px] font-bold">GSTIN: {settings.gstin}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Thermal Bill Details */}
                <div className="py-2 border-b border-dashed border-zinc-400 text-[10px] space-y-0.5">
                  <div className="flex justify-between">
                    <span>BILL NO: <strong>{invoice.invoiceNumber}</strong></span>
                    <span>DATE: <strong>{formatInvoiceDate(invoice.dateTime)}</strong></span>
                  </div>
                  <div className="flex justify-between">
                    <span>TIME: <strong>{formatInvoiceTime(invoice.dateTime)}</strong></span>
                    <span>TYPE: {invoice.gstApplied ? 'TAX INVOICE' : 'CASH MEMO'}</span>
                  </div>
                  {invoice.customerName && (
                    <div className="truncate">
                      <span>CUST: <strong>{invoice.customerName}</strong></span>
                    </div>
                  )}
                  {invoice.customerPhone && (
                    <div>
                      <span>PH: {invoice.customerPhone}</span>
                    </div>
                  )}
                  {invoice.customerAddress && (
                    <div>
                      <span>SITE: {invoice.customerAddress}</span>
                    </div>
                  )}
                  {invoice.customerGstin && (
                    <div>
                      <span>GST: <strong>{invoice.customerGstin}</strong></span>
                    </div>
                  )}
                  <div>
                    <span>PAYMENT: <strong className="uppercase">{invoice.paymentMethod}</strong></span>
                  </div>
                  {invoice.paymentMethod === 'credit' && invoice.paymentDueDate && (
                    <div className="text-zinc-800">
                      <span>PAY DUE: <strong>{invoice.paymentDueDate}</strong> {invoice.creditPaid ? '(PAID)' : '(DUE)'}</span>
                    </div>
                  )}
                </div>

                {/* Thermal Items Table */}
                <div className="py-2 border-b border-dashed border-zinc-400">
                  <div className="flex justify-between font-bold text-[10px] pb-1 border-b border-zinc-300">
                    <span className="w-1/2">ITEM</span>
                    <span className="w-1/4 text-center">QTY</span>
                    <span className="w-1/4 text-right">AMT</span>
                  </div>
                  <div className="divide-y divide-zinc-100 py-1 space-y-1">
                    {invoice.items.map((item, idx) => (
                      <div key={idx} className="pt-1">
                        <div className="font-bold text-[10px] leading-tight truncate">
                          {item.productNameSnapshot}
                        </div>
                        <div className="flex justify-between text-[9px] text-zinc-600">
                          <span>
                            {item.quantity} {item.unit} @ ₹{item.unitPrice}
                          </span>
                          <span className="font-bold text-black">₹{item.lineTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Thermal Totals */}
                <div className="py-2 border-b border-dashed border-zinc-400 space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatINR(invoice.subtotal)}</span>
                  </div>

                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-zinc-600">
                      <span>
                        Discount {invoice.discountType === 'percentage' && invoice.discountPercent ? `(${invoice.discountPercent}%)` : ''}:
                      </span>
                      <span>-{formatINR(totalDiscount)}</span>
                    </div>
                  )}

                  {invoice.gstApplied ? (
                    <>
                      <div className="flex justify-between text-zinc-600">
                        <span>CGST ({((invoice.gstRate || 18) / 2).toFixed(1)}%):</span>
                        <span>{formatINR(invoice.cgstAmount)}</span>
                      </div>
                      <div className="flex justify-between text-zinc-600">
                        <span>SGST ({((invoice.gstRate || 18) / 2).toFixed(1)}%):</span>
                        <span>{formatINR(invoice.sgstAmount)}</span>
                      </div>
                    </>
                  ) : null}

                  <div className="flex justify-between text-sm font-bold pt-1 border-t border-zinc-800 text-black">
                    <span>GRAND TOTAL:</span>
                    <span>{formatINR(invoice.grandTotal)}</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-2.5 text-center space-y-1.5">
                  <p className="text-[9px] text-zinc-600 leading-tight">
                    {settings.footerMessage}
                  </p>
                  <p className="text-[8px] text-zinc-400 font-sans">
                    Billed by: {invoice.createdBy}
                  </p>
                </div>
              </div>
            ) : (
              /* INK / A4 INVOICE TEMPLATE (Multi-page supported) */
              <div id="ink-invoice" className="w-full flex flex-col items-center gap-8 print:gap-0 print:block">
                {invoicePages.map((page, pIdx) => (
                  <React.Fragment key={page.pageNumber}>
                    {/* Visual Page Break Indicator on Screen (hidden during print) */}
                    {pIdx > 0 && (
                      <div className="no-print w-full flex items-center justify-center py-2">
                        <div className="flex items-center gap-2 px-3 py-1 bg-zinc-800 text-zinc-200 rounded-full text-xs font-medium shadow-sm border border-zinc-700">
                          <Layers className="w-3.5 h-3.5 text-orange-400" />
                          <span>Page Break — Page {page.pageNumber} of {page.totalPages}</span>
                          {page.isLastPage && (
                            <span className="text-orange-400 font-bold ml-1">• Final Page (Totals & Signatures)</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Single A4 Printable Page Sheet */}
                    <div
                      id={`ink-invoice-page-${page.pageNumber}`}
                      className="bg-white text-zinc-950 p-6 sm:p-10 shadow-lg border border-zinc-300 rounded-sm w-full max-w-[760px] font-sans print-document print-a4-page flex flex-col justify-between"
                      style={{ minHeight: '1000px' }}
                    >
                      <div>
                        {/* Header: Full store branding on Page 1, Condensed on subsequent pages */}
                        {page.isFirstPage ? (
                          <>
                            {/* Full Ink Header */}
                            <div className="flex justify-between items-start pb-5 border-b-2 border-black gap-4">
                              {/* Left: Brand Logo & Details near to it */}
                              <div className="flex items-start gap-4">
                                <img
                                  id="img-ink-bill-logo"
                                  src={getShopLogoUrl(settings)}
                                  alt={`${settings.shopName} Logo`}
                                  className="w-14 h-20 sm:w-16 sm:h-22 shrink-0 object-contain"
                                  referrerPolicy="no-referrer"
                                />
                                <div>
                                  <div className="inline-block px-2 py-0.5 bg-orange-500 text-black font-bold text-[10px] uppercase tracking-wider rounded mb-1.5">
                                    Electricals, Pipes & Hardware
                                  </div>
                                  <h1 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
                                    {settings.shopName}
                                  </h1>
                                  <p className="text-xs text-zinc-500 mt-0.5">
                                    {settings.tagline}
                                  </p>
                                  <div className="mt-2 text-xs text-zinc-600 space-y-0.5">
                                    <p className="flex items-start gap-1.5 leading-snug">
                                      <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                                      <span>{formatShopAddress(settings) || 'Store Address'}</span>
                                    </p>
                                    <p className="flex items-center gap-1.5">
                                      <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                      +91 {settings.phone}
                                    </p>
                                    {settings.gstin && (
                                      <p className="font-semibold text-zinc-900">
                                        GSTIN: {settings.gstin}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right: Bill Meta */}
                              <div className="text-right shrink-0">
                                <div className="inline-block px-2.5 py-1 bg-zinc-100 border border-zinc-200 text-zinc-900 font-bold text-xs uppercase rounded">
                                  {invoice.gstApplied ? 'TAX INVOICE' : 'CASH MEMO'}
                                </div>
                                <div className="mt-2.5 text-xs text-zinc-700 space-y-0.5">
                                  <p>
                                    <span className="text-zinc-500">Invoice No:</span>{' '}
                                    <strong className="text-zinc-950 font-bold">{invoice.invoiceNumber}</strong>
                                  </p>
                                  <p>
                                    <span className="text-zinc-500">Date:</span>{' '}
                                    <strong className="text-zinc-950 font-semibold">{formatInvoiceDate(invoice.dateTime)}</strong>
                                  </p>
                                  <p>
                                    <span className="text-zinc-500">Time:</span>{' '}
                                    <strong className="text-zinc-950 font-semibold">{formatInvoiceTime(invoice.dateTime)}</strong>
                                  </p>
                                  <p>
                                    <span className="text-zinc-500">Mode:</span>{' '}
                                    <span className="uppercase font-semibold text-zinc-950">{invoice.paymentMethod}</span>
                                  </p>
                                  {page.totalPages > 1 && (
                                    <p className="text-orange-600 font-bold text-[11px] pt-1">
                                      Page {page.pageNumber} of {page.totalPages}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Customer Details Box */}
                            <div className="my-4 p-3.5 bg-zinc-50 rounded-lg border border-zinc-200 flex flex-col sm:flex-row justify-between gap-4 text-xs">
                              <div>
                                <span className="font-semibold text-zinc-400 uppercase tracking-wider text-[10px] block mb-0.5">
                                  Billed To
                                </span>
                                <p className="text-xs font-bold text-zinc-950">
                                  {invoice.customerName || 'Walk-in Counter Customer'}
                                  {invoice.customerCategory && (
                                    <span className="ml-2 text-[10px] font-normal text-zinc-500 capitalize bg-zinc-200/60 px-1.5 py-0.5 rounded">
                                      {invoice.customerCategory}
                                    </span>
                                  )}
                                </p>
                                {invoice.customerPhone && (
                                  <p className="text-zinc-600 mt-0.5 font-mono">Contact: +91 {invoice.customerPhone}</p>
                                )}
                                {invoice.customerAddress && (
                                  <p className="text-zinc-600 mt-0.5">Site Address: {invoice.customerAddress}</p>
                                )}
                                {invoice.customerGstin && (
                                  <p className="text-zinc-700 font-mono mt-0.5 font-medium">GSTIN: {invoice.customerGstin}</p>
                                )}
                              </div>
                              <div className="sm:text-right">
                                <span className="font-semibold text-zinc-400 uppercase tracking-wider text-[10px] block mb-0.5">
                                  Payment Terms
                                </span>
                                <p className="text-xs font-bold uppercase text-zinc-900">
                                  {invoice.paymentMethod}
                                </p>
                                {invoice.paymentMethod === 'credit' && invoice.paymentDueDate && (
                                  <div className="mt-1">
                                    <p className="text-[11px] text-amber-800 font-semibold">
                                      Due Date: {invoice.paymentDueDate}
                                    </p>
                                    <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                                      invoice.creditPaid
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                                    }`}>
                                      {invoice.creditPaid ? 'PAID' : 'PAYMENT PENDING'}
                                    </span>
                                  </div>
                                )}
                                {invoice.notes && (
                                  <p className="text-zinc-500 text-[11px] italic mt-1">{invoice.notes}</p>
                                )}
                              </div>
                            </div>
                          </>
                        ) : (
                          /* Subsequent Page: Condensed Header */
                          <div className="flex justify-between items-center pb-3 border-b-2 border-black gap-4 text-xs">
                            <div className="flex items-center gap-3">
                              <img
                                src={getShopLogoUrl(settings)}
                                alt={`${settings.shopName} Logo`}
                                className="w-8 h-10 shrink-0 object-contain"
                                referrerPolicy="no-referrer"
                              />
                              <div>
                                <h2 className="font-bold text-sm text-zinc-950 tracking-tight">
                                  {settings.shopName}
                                </h2>
                                <p className="text-[11px] text-zinc-500">
                                  {settings.tagline} • GSTIN: {settings.gstin || 'N/A'} • Ph: +91 {settings.phone}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-zinc-950">
                                Invoice #{invoice.invoiceNumber}
                              </p>
                              <p className="text-[11px] text-zinc-600">
                                Date: {formatInvoiceDate(invoice.dateTime)} • Time: {formatInvoiceTime(invoice.dateTime)} • {invoice.customerName || 'Counter Sale'}
                              </p>
                              <span className="inline-block mt-0.5 px-2 py-0.5 bg-zinc-100 border border-zinc-300 text-[10px] font-bold text-zinc-900 rounded">
                                Page {page.pageNumber} of {page.totalPages} {page.isLastPage ? '(Final Page)' : ''}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Ink Invoice Items Table */}
                        <div className="overflow-x-auto print-overflow-visible mt-2">
                          <table className="w-full text-left text-xs border-collapse print-table">
                            <thead>
                              <tr className="bg-black text-white font-semibold">
                                <th className="py-2 px-3 text-center w-10">#</th>
                                <th className="py-2 px-3 text-left">Item Description</th>
                                <th className="py-2 px-3 text-center w-16">HSN</th>
                                <th className="py-2 px-3 text-center w-20">Qty</th>
                                <th className="py-2 px-3 text-right w-24">Rate (₹)</th>
                                {invoice.gstApplied && (
                                  <th className="py-2 px-3 text-center w-16">GST</th>
                                )}
                                <th className="py-2 px-3 text-right w-28">Amount (₹)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                              {page.items.map(({ item, originalIndex }) => (
                                <tr key={originalIndex} className="hover:bg-zinc-50">
                                  <td className="py-2 px-3 text-zinc-400 font-mono text-center">
                                    {originalIndex + 1}
                                  </td>
                                  <td className="py-2 px-3 font-semibold text-zinc-900 text-left">
                                    {item.productNameSnapshot}
                                  </td>
                                  <td className="py-2 px-3 text-center text-zinc-500 font-mono">
                                    {item.hsnCode || '8536'}
                                  </td>
                                  <td className="py-2 px-3 text-center font-mono">
                                    {item.quantity} {item.unit}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono">
                                    {item.unitPrice.toFixed(2)}
                                  </td>
                                  {invoice.gstApplied && (
                                    <td className="py-2 px-3 text-center font-mono">
                                      {item.gstRate}%
                                    </td>
                                  )}
                                  <td className="py-2 px-3 text-right font-bold font-mono text-zinc-950">
                                    {item.lineTotal.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Bottom Section: If NOT last page -> Continued banner; If LAST page -> Totals & Signatures */}
                      {!page.isLastPage ? (
                        <div className="mt-4 pt-3 border-t-2 border-zinc-200">
                          <div className="flex justify-between items-center py-2 px-3 bg-zinc-50 border border-zinc-200 rounded text-xs">
                            <span className="text-zinc-700">
                              Page {page.pageNumber} Items: <strong>{page.items.length}</strong> | Page Subtotal:{' '}
                              <strong className="font-mono text-zinc-950">{formatINR(page.pageSubtotal)}</strong>
                            </span>
                            <span className="font-bold text-orange-600 flex items-center gap-1">
                              <span>Carried forward to Page {page.pageNumber + 1}...</span>
                            </span>
                          </div>
                          <div className="mt-3 pt-2 border-t border-zinc-100 flex justify-between items-center text-[10px] text-zinc-400">
                            <span>{settings.shopName} • Computer generated invoice</span>
                            <span className="font-semibold text-zinc-600">
                              Page {page.pageNumber} of {page.totalPages}
                            </span>
                          </div>
                        </div>
                      ) : (
                        /* FINAL PAGE: Total Amount and Footer Information */
                        <div className="mt-4 pt-4 border-t-2 border-black print-totals-box">
                          {page.totalPages > 1 && (
                            <div className="mb-3 py-1.5 px-3 bg-zinc-50 border border-zinc-200 rounded text-xs flex justify-between items-center text-zinc-600">
                              <span>Final Page ({page.items.length} items on this sheet)</span>
                              <span className="font-medium text-zinc-900">Total Billed Items: {invoice.items.length}</span>
                            </div>
                          )}

                          {/* Calculations & Terms */}
                          <div className="flex flex-col sm:flex-row justify-between gap-6">
                            {/* Terms & Conditions Box */}
                            <div className="text-xs text-zinc-600 space-y-1 flex-1">
                              <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded text-[11px] text-zinc-600">
                                <strong className="text-zinc-800 font-semibold block mb-0.5">Terms & Conditions:</strong>
                                <p className="leading-relaxed text-zinc-600">{settings.termsAndConditions}</p>
                              </div>
                            </div>

                            {/* Calculations */}
                            <div className="w-full sm:w-64 text-xs space-y-1.5">
                              <div className="flex justify-between py-0.5 text-zinc-600">
                                <span>Subtotal:</span>
                                <span className="font-mono font-medium text-zinc-950">{formatINR(invoice.subtotal)}</span>
                              </div>

                              {totalDiscount > 0 && (
                                <div className="flex justify-between py-0.5 text-zinc-600">
                                  <span>
                                    Discount {invoice.discountType === 'percentage' && invoice.discountPercent ? `(${invoice.discountPercent}%)` : ''}:
                                  </span>
                                  <span className="font-mono text-emerald-700 font-medium">-{formatINR(totalDiscount)}</span>
                                </div>
                              )}

                              {invoice.gstApplied && (
                                <>
                                  <div className="flex justify-between py-0.5 text-zinc-600">
                                    <span>CGST ({(invoice.gstRate || 18) / 2}%):</span>
                                    <span className="font-mono">{formatINR(invoice.cgstAmount)}</span>
                                  </div>
                                  <div className="flex justify-between py-0.5 text-zinc-600">
                                    <span>SGST ({(invoice.gstRate || 18) / 2}%):</span>
                                    <span className="font-mono">{formatINR(invoice.sgstAmount)}</span>
                                  </div>
                                </>
                              )}

                              <div className="flex justify-between py-2 px-3 bg-black text-white rounded text-xs font-bold items-center mt-2">
                                <span>Grand Total:</span>
                                <span className="text-sm font-mono text-orange-400">{formatINR(invoice.grandTotal)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Signatory Footer */}
                          <div className="mt-8 pt-4 border-t border-zinc-200 flex justify-between items-end text-xs text-zinc-500 print-signatory-footer">
                            <div>
                              <p className="font-medium text-zinc-700">{settings.footerMessage}</p>
                              <p className="text-[10px] text-zinc-400 mt-0.5">Computer generated invoice</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-zinc-900">For {settings.shopName}</p>
                              <div className="h-10 flex items-center justify-end text-zinc-400 italic text-[10px]">
                                Authorized Signatory
                              </div>
                            </div>
                          </div>

                          {/* Page numbering at very bottom */}
                          <div className="mt-3 pt-2 border-t border-zinc-100 flex justify-between items-center text-[10px] text-zinc-400">
                            <span>{settings.shopName}</span>
                            <span className="font-semibold text-zinc-600">
                              Page {page.pageNumber} of {page.totalPages} (Final Page)
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="no-print p-3.5 bg-white border-t border-zinc-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-zinc-500 flex items-center gap-2">
            <span>Paper:</span>
            {selectedPrinterType === 'thermal' ? (
              <div className="flex gap-1">
                <button
                  type="button"
                  id="btn-width-80"
                  onClick={() => setSelectedThermalWidth('80mm')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold ${
                    selectedThermalWidth === '80mm'
                      ? 'bg-black text-white'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  80mm Standard
                </button>
                <button
                  type="button"
                  id="btn-width-58"
                  onClick={() => setSelectedThermalWidth('58mm')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold ${
                    selectedThermalWidth === '58mm'
                      ? 'bg-black text-white'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  58mm Compact
                </button>
              </div>
            ) : (
              <span className="font-medium text-zinc-800">
                Standard A4 Sheet ({invoicePages.length} {invoicePages.length > 1 ? 'Pages' : 'Page'})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-close-print-modal"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-semibold rounded-lg"
            >
              Close
            </button>
            <button
              type="button"
              id="btn-footer-download-pdf"
              onClick={() => downloadInvoicePdf(invoice, settings)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors border border-slate-300"
              title="Download standard A4 Invoice PDF"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Download A4 PDF</span>
            </button>
            <button
              type="button"
              id="btn-primary-print-modal"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-black text-xs font-bold rounded-lg shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print ({selectedPrinterType === 'thermal' ? `Thermal ${selectedThermalWidth}` : `Ink A4 (${invoicePages.length} ${invoicePages.length > 1 ? 'Pages' : 'Page'})`})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
