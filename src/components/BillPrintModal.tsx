import React, { useState, useEffect, useMemo } from 'react';
import { Printer, X, FileText, Receipt, MapPin, Phone, Download, Layers } from 'lucide-react';
import { Invoice, ShopSettings, PrinterType, ThermalWidth } from '../types';
import {
  formatINR,
  getInvoiceDiscount,
  formatShopAddress,
  formatShopPhone,
  getShopLogoUrl,
  formatInvoiceDate,
  formatInvoiceTime,
  formatInvoiceDateTime,
} from '../utils/formatters';
import { downloadInvoicePdf } from '../utils/pdfGenerator';
import { paginateInvoiceItems } from '../utils/invoicePagination';

interface BillPrintModalProps {
  invoice: Invoice;
  settings: ShopSettings;
  isOpen: boolean;
  onClose: () => void;
  onPrintConfirm?: () => void;
}

export const BillPrintModal: React.FC<BillPrintModalProps> = ({
  invoice,
  settings,
  isOpen,
  onClose,
  onPrintConfirm,
}) => {
  // Paginate items for A5 printing: max 15 products per page
  const a5Pages = useMemo(() => {
    return paginateInvoiceItems(invoice.items, 15);
  }, [invoice.items]);

  // Paginate items for A4 printing: max 25 products per page
  const a4Pages = useMemo(() => {
    return paginateInvoiceItems(invoice.items, 25);
  }, [invoice.items]);

  // Determine bill format (A5, A4, or Thermal):
  const getInitialFormat = (): 'a5' | 'a4' | 'thermal' => {
    if (invoice.templateType === 'a5') return 'a5';
    if (invoice.templateType === 'a4') return 'a4';
    if (invoice.printerType === 'thermal' || invoice.templateType === '58mm' || invoice.templateType === '80mm') return 'thermal';
    if (settings.defaultPrinterType === 'thermal') return 'thermal';
    return 'a5'; // Default to A5 for counter billing
  };

  const [selectedFormat, setSelectedFormat] = useState<'a5' | 'a4' | 'thermal'>(getInitialFormat());
  const [selectedThermalWidth, setSelectedThermalWidth] = useState<ThermalWidth>(
    settings.thermalPaperWidth || '80mm'
  );

  // Whenever the modal opens or invoice template changes, sync format
  useEffect(() => {
    if (isOpen) {
      setSelectedFormat(getInitialFormat());
      setSelectedThermalWidth(settings.thermalPaperWidth || '80mm');
    }
  }, [isOpen, invoice.invoiceId, invoice.templateType, invoice.printerType, settings.defaultPrinterType, settings.thermalPaperWidth]);

  const hasConfirmedRef = React.useRef(false);

  useEffect(() => {
    hasConfirmedRef.current = false;
  }, [invoice.invoiceId]);

  const triggerPrintConfirm = () => {
    if (!hasConfirmedRef.current) {
      hasConfirmedRef.current = true;
      if (onPrintConfirm) {
        onPrintConfirm();
      }
    }
  };

  const handlePrint = () => {
    window.print();
    triggerPrintConfirm();
  };

  const handleDownload = () => {
    downloadInvoicePdf(invoice, settings, selectedFormat === 'a5' ? 'a5' : 'a4');
    triggerPrintConfirm();
  };

  // Keyboard navigation for Print Modal: Enter/Ctrl+P to Print, Escape to Close, Alt+4/Alt+5 or 4/5 to switch size
  useEffect(() => {
    if (!isOpen) return;
    const handleModalKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      const isAlt = e.altKey;
      const key = e.key.toLowerCase();
      const code = e.code;

      if (e.key === 'Enter' || (isCmdOrCtrl && (key === 'p' || code === 'KeyP'))) {
        e.preventDefault();
        handlePrint();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if ((isAlt && (e.key === '4' || code === 'Digit4')) || key === '4') {
        e.preventDefault();
        setSelectedFormat('a4');
      } else if ((isAlt && (e.key === '5' || code === 'Digit5')) || key === '5') {
        e.preventDefault();
        setSelectedFormat('a5');
      } else if ((isAlt || isCmdOrCtrl) && (key === 'd' || code === 'KeyD')) {
        e.preventDefault();
        handleDownload();
      }
    };
    window.addEventListener('keydown', handleModalKeyDown);
    return () => window.removeEventListener('keydown', handleModalKeyDown);
  }, [isOpen, invoice, settings, selectedFormat]);

  if (!isOpen) return null;

  const totalDiscount = getInvoiceDiscount(invoice);
  const activePages = selectedFormat === 'a5' ? a5Pages : a4Pages;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 overflow-y-auto print-modal-backdrop">
      {/* Dynamic @page rule for browser print based on selected paper format */}
      <style>{`
        @media print {
          @page {
            size: ${selectedFormat === 'a5' ? 'A5 portrait' : 'A4 portrait'} !important;
            margin: ${selectedFormat === 'a5' ? '6mm 6mm' : '10mm 8mm'} !important;
          }
        }
      `}</style>
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
                {selectedFormat === 'a5' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-slate-950">
                    A5 Format
                  </span>
                )}
                {selectedFormat === 'a4' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500 text-white">
                    A4 Format
                  </span>
                )}
                {selectedFormat !== 'thermal' && activePages.length > 1 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-black">
                    <Layers className="w-3 h-3" />
                    {activePages.length} Pages
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                {formatInvoiceDateTime(invoice.dateTime)} • {invoice.customerName || 'Walk-in'} • {invoice.items.length} items
                {selectedFormat === 'a5' && (
                  <span className="text-emerald-300 font-medium"> (A5 Format • 148×210 mm)</span>
                )}
                {selectedFormat === 'a4' && (
                  <span className="text-blue-300 font-medium"> (A4 Format • 210×297 mm)</span>
                )}
                {selectedFormat === 'thermal' && (
                  <span className="text-orange-300 font-medium"> (Thermal {selectedThermalWidth})</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Format Switcher */}
            <div className="flex items-center bg-slate-800 p-0.5 rounded border border-slate-700">
              <button
                type="button"
                id="btn-switch-a4"
                onClick={() => setSelectedFormat('a4')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                  selectedFormat === 'a4'
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="A4 Full Sheet (Alt+4)"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>A4</span>
              </button>

              <button
                type="button"
                id="btn-switch-a5"
                onClick={() => setSelectedFormat('a5')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                  selectedFormat === 'a5'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="A5 Half Sheet (Alt+5)"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>A5</span>
              </button>

              <button
                type="button"
                id="btn-switch-thermal"
                onClick={() => setSelectedFormat('thermal')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  selectedFormat === 'thermal'
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Thermal POS Receipt (80mm / 58mm)"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Thermal ({selectedThermalWidth})</span>
              </button>
            </div>

            <button
              type="button"
              id="btn-modal-download-pdf"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
              title={`Download ${selectedFormat === 'a5' ? 'A5' : 'A4'} Invoice PDF (Alt+D)`}
            >
              <Download className="w-3.5 h-3.5 text-orange-400" />
              <span>{selectedFormat === 'a5' ? 'A5 PDF' : 'A4 PDF'}</span>
            </button>

            <button
              type="button"
              id="btn-modal-print-action"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-bold shadow-xs transition-colors cursor-pointer"
              title="Print Bill (Enter or Ctrl+P)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Bill</span>
              <span className="text-[10px] font-mono opacity-80 ml-0.5">↵</span>
            </button>

            <button
              type="button"
              id="btn-modal-close"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-100 flex justify-center items-start print-viewport">
          <div className="w-full flex justify-center">
            {selectedFormat === 'thermal' ? (
              /* THERMAL RECEIPT TEMPLATE */
              <div
                id="thermal-receipt"
                className={`bg-white text-black p-3 sm:p-4 shadow-lg border border-zinc-300 font-mono text-xs rounded-sm ${
                  selectedThermalWidth === '58mm' ? 'w-[280px]' : 'w-[360px]'
                }`}
              >
                {/* Thermal Header */}
                <div className="pb-2 border-b border-dashed border-zinc-400 text-center">
                  <div className="flex justify-center mb-1.5">
                    <img
                      src={getShopLogoUrl(settings)}
                      alt="Logo"
                      className="w-10 h-14 object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <p className="text-[9.5px] font-extrabold uppercase tracking-wider text-orange-600 mb-0.5">
                    Your trusted electrical partner
                  </p>
                  <h1 className="text-sm font-black uppercase tracking-tight leading-tight">
                    {settings.shopName || 'Sri Senthur Velan Electricals and Pipes'}
                  </h1>
                  {formatShopAddress(settings) && (
                    <p className="text-[10px] text-zinc-600 leading-tight mt-0.5">
                      {formatShopAddress(settings)}
                    </p>
                  )}
                  {(settings.phone || settings.alternatePhone) && (
                    <p className="text-[10px] text-zinc-600">
                      Ph: {formatShopPhone(settings.phone, settings.alternatePhone)}
                    </p>
                  )}
                  {settings.email && (
                    <p className="text-[10px] text-zinc-600 truncate">
                      Email: {settings.email}
                    </p>
                  )}
                  {settings.gstin && (
                    <p className="text-[10px] font-bold">GSTIN: {settings.gstin}</p>
                  )}
                </div>

                {/* Thermal Bill Details */}
                <div className="py-1.5 border-b border-dashed border-zinc-400 text-[10px] space-y-0.5">
                  <div className="flex justify-between font-bold">
                    <span>{invoice.gstApplied ? 'TAX INVOICE' : 'CASH MEMO'}</span>
                    <span>#{invoice.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>Date: {formatInvoiceDate(invoice.dateTime)}</span>
                  </div>
                  {invoice.customerName && invoice.customerName !== 'Walk-in Customer' && (
                    <div className="pt-0.5">
                      <span>Customer: <strong>{invoice.customerName}</strong></span>
                      {invoice.customerPhone && <span className="block">Ph: {invoice.customerPhone}</span>}
                      {invoice.customerGstin && <span className="block">GST: {invoice.customerGstin}</span>}
                    </div>
                  )}
                </div>

                {/* Thermal Items Table */}
                <div className="py-1.5 border-b border-dashed border-zinc-400">
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
                <div className="py-1.5 border-b border-dashed border-zinc-400 space-y-0.5 text-[10px]">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatINR(invoice.subtotal)}</span>
                  </div>

                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-zinc-600">
                      <span>Discount:</span>
                      <span>-{formatINR(totalDiscount)}</span>
                    </div>
                  )}

                  {invoice.gstApplied ? (
                    <>
                      <div className="flex justify-between text-zinc-600">
                        <span>CGST:</span>
                        <span>{formatINR(invoice.cgstAmount)}</span>
                      </div>
                      <div className="flex justify-between text-zinc-600">
                        <span>SGST:</span>
                        <span>{formatINR(invoice.sgstAmount)}</span>
                      </div>
                    </>
                  ) : null}

                  <div className="flex justify-between text-sm font-bold pt-1 border-t border-zinc-800 text-black">
                    <span>TOTAL:</span>
                    <span>{formatINR(invoice.grandTotal)}</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-2 text-center">
                  <p className="text-[9px] text-zinc-600 leading-tight">
                    {settings.footerMessage || 'Thank you! Visit again.'}
                  </p>
                </div>
              </div>
            ) : selectedFormat === 'a5' ? (
              /* A5 INVOICE TEMPLATE (Multi-page supported: max 15 products per page) */
              <div id="a5-invoice-wrapper" className="w-full flex flex-col items-center gap-8 print:gap-0 print:block">
                {a5Pages.map((page, pIdx) => (
                  <React.Fragment key={page.pageNumber}>
                    {/* Visual Page Break Indicator on Screen (hidden during print) */}
                    {pIdx > 0 && (
                      <div className="no-print w-full flex items-center justify-center py-2">
                        <div className="flex items-center gap-2 px-3 py-1 bg-zinc-800 text-zinc-200 rounded-full text-xs font-medium shadow-sm border border-zinc-700">
                          <Layers className="w-3.5 h-3.5 text-emerald-400" />
                          <span>A5 Page Break — Page {page.pageNumber} of {page.totalPages}</span>
                          {page.isLastPage && (
                            <span className="text-emerald-400 font-bold ml-1">• Final Page (Totals & Signatures)</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Single A5 Printable Page Sheet */}
                    <div
                      id={`a5-invoice-page-${page.pageNumber}`}
                      className="bg-white text-zinc-950 p-5 sm:p-6 shadow-lg border border-zinc-300 rounded-sm w-full max-w-[560px] font-sans print-document print-a5-page flex flex-col justify-between"
                      style={{ minHeight: '740px' }}
                    >
                      <div>
                        {/* Header: Full store branding on Page 1, Condensed on subsequent pages */}
                        {page.isFirstPage ? (
                          <>
                            {/* Full Header */}
                            <div className="flex justify-between items-start pb-3 border-b-2 border-zinc-900 gap-3">
                              <div className="flex items-start gap-3">
                                <div className="w-12 h-16 shrink-0 bg-white border border-slate-200/80 rounded-md p-1 shadow-2xs flex items-center justify-center">
                                  <img
                                    id="img-a5-bill-logo"
                                    src={getShopLogoUrl(settings)}
                                    alt={`${settings.shopName || 'Sri Senthur Velan'} Logo`}
                                    className="max-w-full max-h-full object-contain"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                                <div>
                                  <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-orange-600 mb-0.5 font-sans">
                                    Your trusted electrical partner
                                  </p>
                                  <h1 className="text-base sm:text-lg font-black text-zinc-950 tracking-tight leading-tight">
                                    {settings.shopName || 'Sri Senthur Velan Electricals and Pipes'}
                                  </h1>
                                  <div className="mt-0.5 text-[10px] text-zinc-600 space-y-0.5 leading-tight">
                                    {formatShopAddress(settings) && <p>{formatShopAddress(settings)}</p>}
                                    {(settings.phone || settings.alternatePhone) && (
                                      <p>
                                        <span className="font-semibold text-zinc-800">Ph:</span>{' '}
                                        {formatShopPhone(settings.phone, settings.alternatePhone)}
                                      </p>
                                    )}
                                    {settings.email && (
                                      <p>
                                        <span className="font-semibold text-zinc-800">Email:</span>{' '}
                                        {settings.email}
                                      </p>
                                    )}
                                    {settings.gstin && (
                                      <p className="font-semibold text-zinc-900">
                                        <span>GSTIN:</span> {settings.gstin}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <h2 className="text-xs font-bold text-zinc-950 uppercase tracking-wide bg-zinc-100 px-2 py-0.5 rounded border border-zinc-300 inline-block">
                                  {invoice.gstApplied ? 'TAX INVOICE (A5)' : 'CASH MEMO (A5)'}
                                </h2>
                                <div className="mt-1 text-[10.5px] text-zinc-700 space-y-0.5 leading-tight">
                                  <p><span className="text-zinc-500">Invoice:</span> <strong className="text-zinc-950">{invoice.invoiceNumber}</strong></p>
                                  <p><span className="text-zinc-500">Date:</span> <strong className="text-zinc-950">{formatInvoiceDate(invoice.dateTime)}</strong></p>
                                  {page.totalPages > 1 && (
                                    <p className="text-zinc-500 text-[10px]">
                                      Page {page.pageNumber} of {page.totalPages}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Customer Info Strip */}
                            <div className="my-2.5 py-1.5 px-2.5 bg-zinc-50 rounded border border-zinc-200 flex justify-between items-center text-[10.5px]">
                              <div>
                                <span className="text-zinc-500 mr-1.5">Billed To:</span>
                                <strong className="text-zinc-950">{invoice.customerName || 'Walk-in Customer'}</strong>
                                {invoice.customerPhone && <span className="text-zinc-600 ml-2">Ph: {invoice.customerPhone}</span>}
                                {invoice.customerGstin && <span className="text-zinc-800 font-semibold ml-2">GSTIN: {invoice.customerGstin}</span>}
                              </div>
                              <span className="text-zinc-600 uppercase font-semibold text-[10px]">
                                Mode: {invoice.paymentMethod}
                              </span>
                            </div>
                          </>
                        ) : (
                          /* Subsequent Page: Condensed Header */
                          <div className="flex justify-between items-center pb-2.5 border-b border-zinc-900 gap-3 text-xs">
                            <div>
                              <h2 className="font-bold text-sm text-zinc-950">
                                {settings.shopName}
                              </h2>
                              <p className="text-[10px] text-zinc-500">
                                Invoice #{invoice.invoiceNumber} • {formatInvoiceDate(invoice.dateTime)}
                              </p>
                            </div>
                            <div className="text-right text-[11px] font-semibold text-zinc-600">
                              Page {page.pageNumber} of {page.totalPages}
                            </div>
                          </div>
                        )}

                        {/* Items Table - Clean & Compact (Max 15 per page) */}
                        <div className="overflow-x-auto print-overflow-visible mt-2">
                          <table className="w-full text-left text-[11px] border-collapse print-table">
                            <thead>
                              <tr className="bg-zinc-900 text-white font-semibold">
                                <th className="py-1.5 px-2 text-center w-7">#</th>
                                <th className="py-1.5 px-2 text-left">Item Description</th>
                                {invoice.gstApplied && <th className="py-1.5 px-2 text-center w-14">HSN</th>}
                                <th className="py-1.5 px-2 text-center w-14">Qty</th>
                                <th className="py-1.5 px-2 text-right w-18">Rate (₹)</th>
                                {invoice.gstApplied && <th className="py-1.5 px-2 text-center w-12">GST</th>}
                                <th className="py-1.5 px-2 text-right w-20">Amount (₹)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200">
                              {page.items.map(({ item, originalIndex }) => (
                                <tr key={originalIndex} className="hover:bg-zinc-50">
                                  <td className="px-2 py-1 text-zinc-400 font-mono text-center text-[10.5px]">
                                    {originalIndex + 1}
                                  </td>
                                  <td className="px-2 py-1 font-medium text-zinc-900 text-[10.5px]">
                                    {item.productNameSnapshot}
                                  </td>
                                  {invoice.gstApplied && (
                                    <td className="px-2 py-1 text-center text-zinc-500 font-mono text-[9.5px]">
                                      {item.hsnCode || '8536'}
                                    </td>
                                  )}
                                  <td className="px-2 py-1 text-center font-mono text-[10.5px]">
                                    {item.quantity} {item.unit}
                                  </td>
                                  <td className="px-2 py-1 text-right font-mono text-[10.5px]">
                                    {item.unitPrice.toFixed(2)}
                                  </td>
                                  {invoice.gstApplied && (
                                    <td className="px-2 py-1 text-center font-mono text-[9.5px]">
                                      {item.gstRate}%
                                    </td>
                                  )}
                                  <td className="px-2 py-1 text-right font-bold font-mono text-zinc-950 text-[10.5px]">
                                    {item.lineTotal.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Bottom Section */}
                      {!page.isLastPage ? (
                        <div className="mt-3 pt-2 border-t border-zinc-200 flex justify-between text-[10px] text-zinc-500">
                          <span>Continued on next page...</span>
                          <span>Page {page.pageNumber} of {page.totalPages}</span>
                        </div>
                      ) : (
                        /* FINAL PAGE ONLY: Totals, Terms, and Signatures */
                        <div className="mt-3 pt-3 border-t border-zinc-900 print-totals-box">
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1 text-[9.5px] text-zinc-600 leading-tight">
                              {settings.termsAndConditions ? (
                                <p><strong>Terms:</strong> {settings.termsAndConditions}</p>
                              ) : (
                                <p>{settings.footerMessage || 'Thank you! Visit again. Goods once sold cannot be returned.'}</p>
                              )}
                              <p className="mt-2 text-[9px] text-zinc-400">
                                Page {page.pageNumber} of {page.totalPages}
                              </p>
                            </div>

                            <div className="w-48 space-y-1 text-xs font-mono">
                              <div className="flex justify-between text-zinc-600 text-[10.5px]">
                                <span>Subtotal:</span>
                                <span>{formatINR(invoice.subtotal)}</span>
                              </div>
                              {totalDiscount > 0 && (
                                <div className="flex justify-between text-emerald-700 text-[10.5px]">
                                  <span>Discount:</span>
                                  <span>-{formatINR(totalDiscount)}</span>
                                </div>
                              )}
                              {invoice.gstApplied && (
                                <>
                                  <div className="flex justify-between text-zinc-600 text-[10px]">
                                    <span>CGST:</span>
                                    <span>{formatINR(invoice.cgstAmount)}</span>
                                  </div>
                                  <div className="flex justify-between text-zinc-600 text-[10px]">
                                    <span>SGST:</span>
                                    <span>{formatINR(invoice.sgstAmount)}</span>
                                  </div>
                                </>
                              )}
                              <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-zinc-900 text-zinc-950 bg-zinc-50 px-1 py-0.5 rounded">
                                <span>Grand Total:</span>
                                <span>{formatINR(invoice.grandTotal)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Signatory line */}
                          <div className="mt-3 pt-2 border-t border-dashed border-zinc-300 flex justify-between items-end text-[9px] text-zinc-500">
                            <span>* Computer Generated Invoice (A5 Size)</span>
                            <div className="text-right">
                              <p className="font-semibold text-zinc-700">For {settings.shopName}</p>
                              <p className="mt-3 border-t border-zinc-400 pt-0.5">Authorized Signatory</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            ) : (
              /* INK / A4 INVOICE TEMPLATE (Multi-page supported: max 25 products per page) */
              <div id="ink-invoice" className="w-full flex flex-col items-center gap-8 print:gap-0 print:block">
                {a4Pages.map((page, pIdx) => (
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
                            {/* Full Header */}
                            <div className="flex justify-between items-start pb-4 border-b-2 border-zinc-900 gap-4">
                              {/* Left: Brand Logo, Highlighted Tagline & Full Shop Details */}
                              <div className="flex items-start gap-3.5">
                                <div className="w-14 h-18 shrink-0 bg-white border border-slate-200/80 rounded-lg p-1 shadow-2xs flex items-center justify-center">
                                  <img
                                    id="img-ink-bill-logo"
                                    src={getShopLogoUrl(settings)}
                                    alt={`${settings.shopName || 'Sri Senthur Velan'} Logo`}
                                    className="max-w-full max-h-full object-contain"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                                <div>
                                  <p className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-orange-600 mb-1 font-sans">
                                    Your trusted electrical partner
                                  </p>
                                  <h1 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight leading-tight">
                                    {settings.shopName || 'Sri Senthur Velan Electricals and Pipes'}
                                  </h1>
                                  <div className="mt-1 text-xs text-zinc-600 space-y-0.5">
                                    {formatShopAddress(settings) && (
                                      <p>{formatShopAddress(settings)}</p>
                                    )}
                                    {(settings.phone || settings.alternatePhone) && (
                                      <p>
                                        <span className="font-semibold text-zinc-800">Ph:</span>{' '}
                                        {formatShopPhone(settings.phone, settings.alternatePhone)}
                                      </p>
                                    )}
                                    {settings.email && (
                                      <p>
                                        <span className="font-semibold text-zinc-800">Email:</span>{' '}
                                        {settings.email}
                                      </p>
                                    )}
                                    {settings.gstin && (
                                      <p className="font-semibold text-zinc-900">
                                        <span>GSTIN:</span> {settings.gstin}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right: Invoice Type & Meta */}
                              <div className="text-right shrink-0">
                                <h2 className="text-base font-bold text-zinc-950 uppercase tracking-wide">
                                  {invoice.gstApplied ? 'TAX INVOICE' : 'CASH MEMO'}
                                </h2>
                                <div className="mt-1 text-xs text-zinc-700 space-y-0.5">
                                  <p>
                                    <span className="text-zinc-500">Invoice No:</span>{' '}
                                    <strong className="text-zinc-950 font-bold">{invoice.invoiceNumber}</strong>
                                  </p>
                                  <p>
                                    <span className="text-zinc-500">Date:</span>{' '}
                                    <strong className="text-zinc-950">{formatInvoiceDate(invoice.dateTime)}</strong>
                                  </p>
                                  {page.totalPages > 1 && (
                                    <p className="text-zinc-500 text-[11px]">
                                      Page {page.pageNumber} of {page.totalPages}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Customer Details Bar (Clean & essential) */}
                            <div className="my-3 py-2 px-3 bg-zinc-50 rounded border border-zinc-200 flex justify-between items-center text-xs">
                              <div>
                                <span className="text-zinc-500 mr-2">Billed To:</span>
                                <strong className="text-zinc-950">
                                  {invoice.customerName || 'Walk-in Customer'}
                                </strong>
                                {invoice.customerPhone && (
                                  <span className="text-zinc-600 ml-3">Ph: {invoice.customerPhone}</span>
                                )}
                                {invoice.customerGstin && (
                                  <span className="text-zinc-800 font-semibold ml-3">GSTIN: {invoice.customerGstin}</span>
                                )}
                              </div>
                              <div className="text-zinc-600 uppercase font-medium text-[11px]">
                                Mode: {invoice.paymentMethod}
                              </div>
                            </div>
                          </>
                        ) : (
                          /* Subsequent Page: Condensed Header */
                          <div className="flex justify-between items-center pb-3 border-b border-zinc-900 gap-4 text-xs">
                            <div>
                              <h2 className="font-bold text-sm text-zinc-950">
                                {settings.shopName}
                              </h2>
                              <p className="text-[11px] text-zinc-500">
                                Invoice #{invoice.invoiceNumber} • {formatInvoiceDate(invoice.dateTime)}
                              </p>
                            </div>
                            <div className="text-right text-xs text-zinc-600">
                              Page {page.pageNumber} of {page.totalPages}
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
                                  <td className={`px-3 text-zinc-400 font-mono text-center ${page.items.length > 15 ? 'py-1 text-[11px]' : 'py-2 text-xs'}`}>
                                    {originalIndex + 1}
                                  </td>
                                  <td className={`px-3 font-semibold text-zinc-900 text-left ${page.items.length > 15 ? 'py-1 text-[11px]' : 'py-2 text-xs'}`}>
                                    {item.productNameSnapshot}
                                  </td>
                                  <td className={`px-3 text-center text-zinc-500 font-mono ${page.items.length > 15 ? 'py-1 text-[10px]' : 'py-2 text-xs'}`}>
                                    {item.hsnCode || '8536'}
                                  </td>
                                  <td className={`px-3 text-center font-mono ${page.items.length > 15 ? 'py-1 text-[11px]' : 'py-2 text-xs'}`}>
                                    {item.quantity} {item.unit}
                                  </td>
                                  <td className={`px-3 text-right font-mono ${page.items.length > 15 ? 'py-1 text-[11px]' : 'py-2 text-xs'}`}>
                                    {item.unitPrice.toFixed(2)}
                                  </td>
                                  {invoice.gstApplied && (
                                    <td className={`px-3 text-center font-mono ${page.items.length > 15 ? 'py-1 text-[10px]' : 'py-2 text-xs'}`}>
                                      {item.gstRate}%
                                    </td>
                                  )}
                                  <td className={`px-3 text-right font-bold font-mono text-zinc-950 ${page.items.length > 15 ? 'py-1 text-[11px]' : 'py-2 text-xs'}`}>
                                    {item.lineTotal.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Bottom Section */}
                      {!page.isLastPage ? (
                        <div className="mt-4 pt-2 border-t border-zinc-200 flex justify-between text-xs text-zinc-500">
                          <span>Continued on next page...</span>
                          <span>Page {page.pageNumber} of {page.totalPages}</span>
                        </div>
                      ) : (
                        /* FINAL PAGE: Totals and Signatures */
                        <div className="mt-4 pt-4 border-t border-zinc-900 print-totals-box">
                          {/* Calculations & Terms */}
                          <div className="flex flex-col sm:flex-row justify-between gap-6 items-start">
                            {/* Terms */}
                            <div className="text-xs text-zinc-600 flex-1">
                              {settings.termsAndConditions && (
                                <p className="text-[11px] text-zinc-600 leading-relaxed">
                                  <strong>Terms:</strong> {settings.termsAndConditions}
                                </p>
                              )}
                            </div>

                            {/* Totals */}
                            <div className="w-full sm:w-60 text-xs space-y-1">
                              <div className="flex justify-between py-0.5 text-zinc-600">
                                <span>Subtotal:</span>
                                <span className="font-mono text-zinc-950">{formatINR(invoice.subtotal)}</span>
                              </div>

                              {totalDiscount > 0 && (
                                <div className="flex justify-between py-0.5 text-zinc-600">
                                  <span>Discount:</span>
                                  <span className="font-mono text-emerald-700">-{formatINR(totalDiscount)}</span>
                                </div>
                              )}

                              {invoice.gstApplied && (
                                <>
                                  <div className="flex justify-between py-0.5 text-zinc-600">
                                    <span>CGST:</span>
                                    <span className="font-mono">{formatINR(invoice.cgstAmount)}</span>
                                  </div>
                                  <div className="flex justify-between py-0.5 text-zinc-600">
                                    <span>SGST:</span>
                                    <span className="font-mono">{formatINR(invoice.sgstAmount)}</span>
                                  </div>
                                </>
                              )}

                              <div className="flex justify-between py-1.5 px-2.5 bg-zinc-950 text-white rounded text-xs font-bold items-center mt-1.5">
                                <span>Total:</span>
                                <span className="text-sm font-mono">{formatINR(invoice.grandTotal)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Signatory Footer */}
                          <div className="mt-6 pt-4 border-t border-zinc-200 flex justify-between items-end text-xs text-zinc-500 print-signatory-footer">
                            <div>
                              {settings.footerMessage && (
                                <p className="text-zinc-600">{settings.footerMessage}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-zinc-900">For {settings.shopName}</p>
                              <div className="h-7 flex items-center justify-end text-zinc-400 italic text-[10px]">
                                Authorized Signatory
                              </div>
                            </div>
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
            {selectedFormat === 'thermal' ? (
              <div className="flex gap-1">
                <button
                  type="button"
                  id="btn-width-80"
                  onClick={() => setSelectedThermalWidth('80mm')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
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
                  className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                    selectedThermalWidth === '58mm'
                      ? 'bg-black text-white'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  58mm Compact
                </button>
              </div>
            ) : selectedFormat === 'a5' ? (
              <span className="font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                A5 Format {a5Pages.length > 1 ? `(${a5Pages.length} Pages)` : ''}
              </span>
            ) : (
              <span className="font-medium text-zinc-800 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                A4 Format {a4Pages.length > 1 ? `(${a4Pages.length} Pages)` : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-close-print-modal"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-semibold rounded-lg cursor-pointer flex items-center gap-1.5"
            >
              <span>Close</span>
              <kbd className="font-mono text-[10px] text-zinc-400 bg-zinc-100 px-1 rounded">Esc</kbd>
            </button>
            <button
              type="button"
              id="btn-footer-download-pdf"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors border border-slate-300 cursor-pointer"
              title={`Download standard ${selectedFormat === 'a5' ? 'A5' : 'A4'} Invoice PDF (Alt+D)`}
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Download {selectedFormat === 'a5' ? 'A5' : 'A4'} PDF</span>
              <kbd className="font-mono text-[10px] text-slate-400">Alt+D</kbd>
            </button>
            <button
              type="button"
              id="btn-primary-print-modal"
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-black text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Print document (Enter or Ctrl+P)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Bill</span>
              <kbd className="font-mono text-[11px] bg-black/15 text-black px-1.5 py-0.5 rounded font-extrabold">↵ Enter</kbd>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
