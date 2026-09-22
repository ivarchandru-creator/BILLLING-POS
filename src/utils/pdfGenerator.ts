import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice, ShopSettings, Customer, Product, Supplier, SupplierTransaction } from '../types';
import { LOGO_BASE64, LOGO_PDF_BASE64 } from './logoData';
import { getInvoiceDiscount, formatShopAddress, formatInvoiceDate, formatInvoiceTime } from './formatters';

/**
 * Helper to render the official brand logo in the top-left corner of any PDF
 * right next to the shop name preserving its natural aspect ratio.
 */
function drawTopLeftLogo(
  doc: jsPDF,
  leftX = 14,
  topY = 11.2,
  height = 14,
  settings?: ShopSettings
): { width: number; height: number } {
  const customAspectRatio = settings?.logoAspectRatio;
  const ratio = customAspectRatio && customAspectRatio > 0.1 && customAspectRatio < 10
    ? customAspectRatio
    : (242 / 374); // Natural aspect ratio ~0.647
  const width = Number((height * ratio).toFixed(2));

  if (settings?.logoUrl && settings.logoUrl.startsWith('data:image/')) {
    try {
      const mimeMatch = settings.logoUrl.match(/^data:image\/([a-zA-Z+]+);/);
      let format = 'PNG';
      if (mimeMatch) {
        const subtype = mimeMatch[1].toUpperCase();
        if (subtype === 'JPEG' || subtype === 'JPG') format = 'JPEG';
        else if (subtype === 'WEBP') format = 'WEBP';
      }
      doc.addImage(settings.logoUrl, format, leftX, topY, width, height);
      return { width, height };
    } catch (err) {
      console.warn('Could not draw custom settings logo on PDF, trying fallback:', err);
    }
  }

  try {
    if (LOGO_PDF_BASE64) {
      doc.addImage(LOGO_PDF_BASE64, 'JPEG', leftX, topY, width, height);
      return { width, height };
    }
  } catch (err) {
    console.warn('Could not draw JPEG logo, trying PNG fallback:', err);
  }

  try {
    if (LOGO_BASE64) {
      doc.addImage(LOGO_BASE64, 'PNG', leftX, topY, width, height);
    }
  } catch (err) {
    console.warn('Could not draw top-left logo on PDF:', err);
  }

  return { width, height };
}

/**
 * Standard ISO 216 A4 Dimensions (in millimeters):
 * Portrait:  210 mm (width)  x 297 mm (height)
 * Landscape: 297 mm (width)  x 210 mm (height)
 */
export const A4_PORTRAIT = {
  width: 210,
  height: 297,
  marginLeft: 14,
  marginRight: 14,
  marginTop: 15,
  marginBottom: 20,
  contentWidth: 182, // 210 - 28
};

export const A4_LANDSCAPE = {
  width: 297,
  height: 210,
  marginLeft: 14,
  marginRight: 14,
  marginTop: 15,
  marginBottom: 18,
  contentWidth: 269, // 297 - 28
};

function formatCurrencyPdf(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Helper to add standard A4 running footer on all pages of a jsPDF document
 */
function addA4PageFooters(
  doc: jsPDF,
  reportTitle: string,
  orientation: 'portrait' | 'landscape' = 'portrait'
): void {
  const totalPages = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // slate-400

    // Left: Document title & A4 tag
    doc.text(
      `${reportTitle} • ISO 216 Standard A4 Size (${Math.round(pageWidth)} x ${Math.round(pageHeight)} mm)`,
      14,
      pageHeight - 7
    );

    // Right: Page numbering
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 7, {
      align: 'right',
    });
  }
}

/**
 * 1. Generates and downloads an official GST / Retail Invoice PDF strictly formatted
 *    for standard ISO A4 paper (210mm x 297mm portrait).
 */
export function downloadInvoicePdf(invoice: Invoice, settings: ShopSettings): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm

  // 1. Top-Left Corner Official Store Logo (Properly aligned and sized)
  const logoHeight = 14;
  const logoX = 14;
  const logoY = 11.2;
  const logoDim = drawTopLeftLogo(doc, logoX, logoY, logoHeight, settings);

  // 2. Shop Brand Header (Directly adjacent and straight to the top-left logo)
  const brandX = logoX + logoDim.width + 3.5;
  let currentY = 15.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.setTextColor(15, 23, 42); // slate-900
  const displayName = settings.shopName || 'Sri Senthur Velan Electricals and Pipes';
  doc.text(displayName, brandX, currentY);
  currentY += 4.3;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // slate-500
  if (settings.tagline) {
    doc.text(settings.tagline, brandX, currentY);
    currentY += 3.8;
  }

  const shopContact = formatShopAddress(settings);

  if (shopContact) {
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(shopContact, brandX, currentY);
    currentY += 3.5;
  }

  const phoneGstin = [
    settings.phone ? `Ph: +91 ${settings.phone}` : '',
    settings.gstin ? `GSTIN: ${settings.gstin}` : '',
  ]
    .filter(Boolean)
    .join('  |  ');

  if (phoneGstin) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text(phoneGstin, brandX, currentY);
    currentY += 3.5;
  }

  // Top-Right: Quick Invoice Meta & Document Type
  const metaRightX = pageWidth - 14;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(metaRightX - 48, 10, 48, 20.5, 1, 1, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.roundedRect(metaRightX - 48, 10, 48, 20.5, 1, 1, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(invoice.gstApplied ? 'TAX INVOICE' : 'CASH MEMO', metaRightX - 24, 13.8, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(`No: ${invoice.invoiceNumber}`, metaRightX - 24, 17.5, { align: 'center' });
  doc.text(`Date: ${formatInvoiceDate(invoice.dateTime)}`, metaRightX - 24, 21, { align: 'center' });
  doc.text(`Time: ${formatInvoiceTime(invoice.dateTime)}`, metaRightX - 24, 24.5, { align: 'center' });
  doc.text(`Mode: ${(invoice.paymentMethod || 'CASH').toUpperCase()}`, metaRightX - 24, 28, { align: 'center' });

  currentY = Math.max(currentY + 2, logoY + logoHeight + 2.5);

  // Header Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, currentY, pageWidth - 14, currentY);
  currentY += 5;

  // Invoice Title Banner (A4 standard)
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, currentY, pageWidth - 28, 7.5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    invoice.gstApplied ? 'TAX INVOICE (GST REGISTRATION)' : 'CASH MEMO',
    pageWidth / 2,
    currentY + 5.2,
    { align: 'center' }
  );
  currentY += 12;

  // Two Column Details: Left = Bill To, Right = Invoice Metadata
  const colLeftX = 14;
  const colRightX = pageWidth / 2 + 5;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('BILL TO / CUSTOMER DETAILS:', colLeftX, currentY);
  doc.text('INVOICE / BILL DETAILS:', colRightX, currentY);
  currentY += 4.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(invoice.customerName || 'Walk-in Customer (General)', colLeftX, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Invoice No: ${invoice.invoiceNumber}`, colRightX, currentY);
  currentY += 4.5;

  if (invoice.customerPhone) {
    doc.text(`Mobile: ${invoice.customerPhone}`, colLeftX, currentY);
  } else {
    doc.text(`Category: ${invoice.customerCategory || 'Retail'}`, colLeftX, currentY);
  }
  doc.text(`Invoice Date: ${formatInvoiceDate(invoice.dateTime)}`, colRightX, currentY);
  currentY += 4.5;
  doc.text(`Invoice Time: ${formatInvoiceTime(invoice.dateTime)}`, colRightX, currentY);
  currentY += 4.5;

  if (invoice.customerAddress) {
    doc.text(`Site / Address: ${invoice.customerAddress}`, colLeftX, currentY);
  }
  const paymentText =
    invoice.paymentMethod === 'credit'
      ? `Payment: CREDIT (${invoice.creditPaid ? 'Settled' : `Due: ${invoice.paymentDueDate || 'Pending'}`})`
      : `Payment: ${invoice.paymentMethod.toUpperCase()}`;
  doc.text(paymentText, colRightX, currentY);
  currentY += 4.5;

  if (invoice.customerGstin) {
    doc.text(`Customer GSTIN: ${invoice.customerGstin}`, colLeftX, currentY);
    currentY += 4.5;
  }

  currentY += 4;

  // Itemized Table (calibrated to exact A4 182mm content width)
  const tableHeaders = invoice.gstApplied
    ? ['#', 'Item Description', 'HSN', 'Qty', 'Unit', 'Rate', 'GST %', 'Amount']
    : ['#', 'Item Description', 'Qty', 'Unit', 'Rate', 'Amount'];

  const tableBody = invoice.items.map((item, idx) => {
    if (invoice.gstApplied) {
      return [
        String(idx + 1),
        item.productNameSnapshot,
        item.hsnCode || '8536',
        String(item.quantity),
        item.unit,
        formatCurrencyPdf(item.unitPrice),
        `${item.gstRate || 0}%`,
        formatCurrencyPdf(item.lineTotal),
      ];
    }
    return [
      String(idx + 1),
      item.productNameSnapshot,
      String(item.quantity),
      item.unit,
      formatCurrencyPdf(item.unitPrice),
      formatCurrencyPdf(item.lineTotal),
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [tableHeaders],
    body: tableBody,
    theme: 'grid',
    tableWidth: A4_PORTRAIT.contentWidth,
    showHead: 'everyPage',
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: invoice.gstApplied
      ? {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 16, halign: 'center' },
          3: { cellWidth: 14, halign: 'right' },
          4: { cellWidth: 14, halign: 'center' },
          5: { cellWidth: 22, halign: 'right' },
          6: { cellWidth: 16, halign: 'center' },
          7: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
        }
      : {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 18, halign: 'right' },
          3: { cellWidth: 18, halign: 'center' },
          4: { cellWidth: 28, halign: 'right' },
          5: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
        },
    margin: {
      left: A4_PORTRAIT.marginLeft,
      right: A4_PORTRAIT.marginRight,
      top: 18,
      bottom: 22,
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || currentY + 40;
  let summaryY = finalY + 6;

  // Check if summary + signature blocks fit on current A4 page
  // Needs ~55mm of vertical space
  if (summaryY + 55 > pageHeight - A4_PORTRAIT.marginBottom) {
    doc.addPage('a4', 'portrait');
    summaryY = A4_PORTRAIT.marginTop;
  }

  // Financial Summary Block (Right Aligned)
  const summaryBoxWidth = 76;
  const summaryBoxX = pageWidth - 14 - summaryBoxWidth;

  // Left side info: Payment Terms / Notes
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('TERMS & CONDITIONS:', 14, summaryY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    settings.termsAndConditions ||
      '1. Goods once sold will not be taken back without original bill.\n2. Warranty as per manufacturer terms & conditions only.\n3. Interest @18% p.a. charged on overdue credit bills.',
    14,
    summaryY + 4.5
  );

  // Right side totals
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  doc.text('Subtotal:', summaryBoxX, summaryY);
  doc.text(formatCurrencyPdf(invoice.subtotal), pageWidth - 14, summaryY, { align: 'right' });
  summaryY += 4.5;

  if (invoice.discountAmount && invoice.discountAmount > 0) {
    const discountLabel = invoice.discountType === 'percentage' && invoice.discountPercent
      ? `Discount (${invoice.discountPercent}%):`
      : 'Discount:';
    doc.text(discountLabel, summaryBoxX, summaryY);
    doc.text(`-${formatCurrencyPdf(invoice.discountAmount)}`, pageWidth - 14, summaryY, { align: 'right' });
    summaryY += 4.5;
  }

  if (invoice.gstApplied && invoice.gstAmount > 0) {
    const cgst = invoice.cgstAmount ?? invoice.gstAmount / 2;
    const sgst = invoice.sgstAmount ?? invoice.gstAmount / 2;

    doc.text('CGST:', summaryBoxX, summaryY);
    doc.text(formatCurrencyPdf(cgst), pageWidth - 14, summaryY, { align: 'right' });
    summaryY += 4;

    doc.text('SGST:', summaryBoxX, summaryY);
    doc.text(formatCurrencyPdf(sgst), pageWidth - 14, summaryY, { align: 'right' });
    summaryY += 4.5;
  }

  // Grand Total Highlight
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(summaryBoxX - 2, summaryY - 3.5, summaryBoxWidth + 2, 8, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Grand Total:', summaryBoxX, summaryY + 2);
  doc.text(formatCurrencyPdf(invoice.grandTotal), pageWidth - 14, summaryY + 2, { align: 'right' });

  summaryY += 15;

  // Signatory Stamp Section (Always guaranteed on the last page)
  let sigY = summaryY;
  if (sigY + 22 > pageHeight - A4_PORTRAIT.marginBottom) {
    doc.addPage('a4', 'portrait');
    sigY = A4_PORTRAIT.marginTop + 4;
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(pageWidth - 14 - 55, sigY + 12, pageWidth - 14, sigY + 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(`For ${settings.shopName || 'Store'}`, pageWidth - 14 - 27.5, sigY + 8, {
    align: 'center',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Authorized Signatory', pageWidth - 14 - 27.5, sigY + 16, { align: 'center' });

  // Add standard A4 footer & page numbers
  addA4PageFooters(doc, `Invoice #${invoice.invoiceNumber}`, 'portrait');

  // Trigger browser download
  doc.save(`${invoice.invoiceNumber}_A4.pdf`);
}

/**
 * 2. Generates and downloads a comprehensive Sales Ledger / Invoices History PDF report
 *    strictly formatted for standard ISO A4 paper (297mm x 210mm landscape).
 */
export function downloadSalesHistoryPdf(
  invoices: Invoice[],
  settings: ShopSettings,
  filterDescription?: string
): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm

  // Top-Left Corner Official Logo (Properly sized and straight to shop name)
  const historyLogoHeight = 14;
  const historyLogoX = 14;
  const historyLogoY = 11.2;
  const historyLogoDim = drawTopLeftLogo(doc, historyLogoX, historyLogoY, historyLogoHeight, settings);

  const brandX = historyLogoX + historyLogoDim.width + 3.5;

  // Title Header straight to the logo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.setTextColor(15, 23, 42);
  const displayName = settings.shopName || 'Sri Senthur Velan Electricals and Pipes';
  doc.text(displayName, brandX, 15.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(234, 88, 12); // orange-600
  doc.text('SALES & INVOICES HISTORY REPORT (A4 FORMAT)', brandX, 20.5);

  if (settings.phone || settings.gstin) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      [settings.phone ? `Ph: +91 ${settings.phone}` : '', settings.gstin ? `GSTIN: ${settings.gstin}` : '']
        .filter(Boolean)
        .join('  |  '),
      brandX,
      25
    );
  }

  const metaRightX = pageWidth - 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const nowStr = new Date().toLocaleString('en-IN');
  doc.text(`Generated on: ${nowStr}`, metaRightX, 15.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(filterDescription || `Total Invoices: ${invoices.length}`, metaRightX, 21, {
    align: 'right',
  });
  let currentY = 32;

  // Financial Metrics Summary Bar
  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
  const totalGst = invoices.reduce((sum, inv) => sum + (inv.gstAmount || 0), 0);
  const totalTaxable = totalRevenue - totalGst;
  const pendingCreditInvoices = invoices.filter((i) => i.paymentMethod === 'credit' && !i.creditPaid);
  const pendingCreditTotal = pendingCreditInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);

  // Background box for summary
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, currentY, pageWidth - 28, 12, 1.5, 1.5, 'F');
  doc.setFontSize(8.5);

  const cardW = (pageWidth - 28) / 4;
  // Metric 1
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Total Invoices', 18, currentY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${invoices.length} Bills`, 18, currentY + 9.5);

  // Metric 2
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Taxable Value', 18 + cardW, currentY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrencyPdf(totalTaxable), 18 + cardW, currentY + 9.5);

  // Metric 3
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('GST Collected', 18 + cardW * 2, currentY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrencyPdf(totalGst), 18 + cardW * 2, currentY + 9.5);

  // Metric 4
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Grand Sales Total', 18 + cardW * 3, currentY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrencyPdf(totalRevenue), 18 + cardW * 3, currentY + 9.5);

  currentY += 16;

  // Table of Invoices (exactly sums to 269mm content width)
  const tableHeaders = [
    '#',
    'Invoice No',
    'Date & Time',
    'Customer Details',
    'Payment Mode',
    'Taxable',
    'GST',
    'Grand Total',
    'Status',
  ];

  const tableBody = invoices.map((inv, idx) => {
    const taxable = Math.max(0, inv.grandTotal - (inv.gstAmount || 0));
    const isCredit = inv.paymentMethod === 'credit';
    let statusText = 'Completed';
    if (isCredit) {
      statusText = inv.creditPaid ? 'Credit (Settled)' : `Credit Due (${inv.paymentDueDate || 'Pending'})`;
    }

    const customerDetails = [
      inv.customerName || 'Walk-in',
      inv.customerPhone ? `Ph: ${inv.customerPhone}` : '',
      inv.customerAddress ? `Site: ${inv.customerAddress}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return [
      String(idx + 1),
      inv.invoiceNumber,
      inv.dateTime,
      customerDetails,
      inv.paymentMethod.toUpperCase(),
      formatCurrencyPdf(taxable),
      formatCurrencyPdf(inv.gstAmount || 0),
      formatCurrencyPdf(inv.grandTotal),
      statusText,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [tableHeaders],
    body: tableBody,
    theme: 'grid',
    tableWidth: A4_LANDSCAPE.contentWidth,
    showHead: 'everyPage',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 26, fontStyle: 'bold' },
      2: { cellWidth: 32 },
      3: { cellWidth: 58 },
      4: { cellWidth: 25, halign: 'center' },
      5: { cellWidth: 26, halign: 'right' },
      6: { cellWidth: 24, halign: 'right' },
      7: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
      8: { cellWidth: 38, halign: 'center' },
    },
    margin: {
      left: A4_LANDSCAPE.marginLeft,
      right: A4_LANDSCAPE.marginRight,
      top: 16,
      bottom: 20,
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || currentY + 50;

  if (pendingCreditTotal > 0 && finalY + 12 < doc.internal.pageSize.getHeight() - 15) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(180, 83, 9); // amber-700
    doc.text(
      `* Note: Pending credit receivables in this period: ${formatCurrencyPdf(pendingCreditTotal)} (${pendingCreditInvoices.length} invoices).`,
      14,
      finalY + 6
    );
  }

  // Add standard A4 footer & page numbers
  addA4PageFooters(doc, 'Sales Ledger & Invoices History', 'landscape');

  const dateTag = new Date().toISOString().slice(0, 10);
  doc.save(`Sales_History_Report_${dateTag}_A4.pdf`);
}

/**
 * 3. Generates and downloads the Reports & Analytics summary PDF
 *    strictly formatted for standard ISO A4 paper (210mm x 297mm portrait).
 */
export function downloadAnalyticsReportPdf(
  data: {
    period: 'daily' | 'monthly' | 'yearly';
    selectedPeriodLabel: string;
    totalRevenue: number;
    totalBills: number;
    totalDiscount?: number;
    totalGst: number;
    totalUnitsSold: number;
    avgBillValue: number;
    paymentBreakdown: Record<string, number>;
    topItems: Array<{ name: string; qty: number; total: number; unit: string }>;
    invoices: Invoice[];
  },
  settings: ShopSettings
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm

  // Top-Left Corner Official Logo (Properly sized and straight to shop name)
  const analyticsLogoHeight = 14;
  const analyticsLogoX = 14;
  const analyticsLogoY = 11.2;
  const analyticsLogoDim = drawTopLeftLogo(doc, analyticsLogoX, analyticsLogoY, analyticsLogoHeight, settings);

  const brandX = analyticsLogoX + analyticsLogoDim.width + 3.5;

  // Header straight to the logo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.setTextColor(15, 23, 42);
  const displayName = settings.shopName || 'Sri Senthur Velan Electricals and Pipes';
  doc.text(displayName, brandX, 15.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(234, 88, 12);
  doc.text(
    `BUSINESS PERFORMANCE & SALES REPORT (${data.selectedPeriodLabel.toUpperCase()})`,
    brandX,
    20.5
  );

  if (settings.phone || settings.gstin) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      [settings.phone ? `Ph: +91 ${settings.phone}` : '', settings.gstin ? `GSTIN: ${settings.gstin}` : '']
        .filter(Boolean)
        .join('  |  '),
      brandX,
      25
    );
  }

  const analyticsRightX = pageWidth - 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, analyticsRightX, 15.5, {
    align: 'right',
  });
  let currentY = 32;

  // Row 1: 3 Metric Cards (Total Revenue, Invoices, Total Discount)
  const cardWidth3 = (A4_PORTRAIT.contentWidth - 8) / 3; // 58mm each
  const cardHeight = 15;

  // Card 1: Total Revenue
  doc.setFillColor(254, 243, 199); // amber-100
  doc.roundedRect(14, currentY, cardWidth3, cardHeight, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(146, 64, 14); // amber-800
  doc.text('TOTAL REVENUE', 17, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(120, 53, 15);
  doc.text(formatCurrencyPdf(data.totalRevenue), 17, currentY + 11.5);

  // Card 2: Total Invoices & Avg Value
  const card2X = 14 + cardWidth3 + 4;
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(card2X, currentY, cardWidth3, cardHeight, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('INVOICES / AVG TICKET', card2X + 3, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `${data.totalBills} Bills (${formatCurrencyPdf(data.avgBillValue)})`,
    card2X + 3,
    currentY + 11.5
  );

  // Card 3: Total Discount Given
  const card3X = card2X + cardWidth3 + 4;
  const discountVal = data.totalDiscount || 0;
  doc.setFillColor(255, 237, 213); // orange-100
  doc.roundedRect(card3X, currentY, cardWidth3, cardHeight, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(194, 65, 12); // orange-700
  doc.text('TOTAL DISCOUNT GIVEN', card3X + 3, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(154, 52, 18);
  doc.text(`-${formatCurrencyPdf(discountVal)}`, card3X + 3, currentY + 11.5);

  currentY += cardHeight + 3.5;

  // Row 2: 2 Metric Cards (GST Tax Collected, Total Units Sold)
  const cardWidth2 = (A4_PORTRAIT.contentWidth - 6) / 2; // 88mm

  // Card 4: GST Collected
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.roundedRect(14, currentY, cardWidth2, cardHeight, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(6, 95, 70); // emerald-800
  doc.text('GST TAX COLLECTED', 17, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(6, 78, 59);
  doc.text(formatCurrencyPdf(data.totalGst), 17, currentY + 11.5);

  // Card 5: Total Units Sold
  const card5X = 14 + cardWidth2 + 6;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(card5X, currentY, cardWidth2, cardHeight, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('TOTAL QUANTITY UNITS SOLD', card5X + 3, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`${data.totalUnitsSold} Units Dispensed`, card5X + 3, currentY + 11.5);

  currentY += cardHeight + 8;

  // Section 1: Payment Collection Channels
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Payment Collection Breakdown', 14, currentY);
  currentY += 3.5;

  const paymentHeaders = ['Payment Method', 'Collected Amount', 'Share %'];
  const paymentRows = [
    [
      'Cash',
      formatCurrencyPdf(data.paymentBreakdown.cash || 0),
      data.totalRevenue > 0
        ? `${Math.round(((data.paymentBreakdown.cash || 0) / data.totalRevenue) * 100)}%`
        : '0%',
    ],
    [
      'UPI',
      formatCurrencyPdf(data.paymentBreakdown.upi || 0),
      data.totalRevenue > 0
        ? `${Math.round(((data.paymentBreakdown.upi || 0) / data.totalRevenue) * 100)}%`
        : '0%',
    ],
    [
      'Card / POS',
      formatCurrencyPdf(data.paymentBreakdown.card || 0),
      data.totalRevenue > 0
        ? `${Math.round(((data.paymentBreakdown.card || 0) / data.totalRevenue) * 100)}%`
        : '0%',
    ],
    [
      'Credit Ledger',
      formatCurrencyPdf(data.paymentBreakdown.credit || 0),
      data.totalRevenue > 0
        ? `${Math.round(((data.paymentBreakdown.credit || 0) / data.totalRevenue) * 100)}%`
        : '0%',
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    head: [paymentHeaders],
    body: paymentRows,
    theme: 'grid',
    tableWidth: A4_PORTRAIT.contentWidth,
    headStyles: {
      fillColor: [71, 85, 105],
      fontSize: 8,
      textColor: [255, 255, 255],
    },
    bodyStyles: {
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 72, fontStyle: 'bold' },
      1: { cellWidth: 65, halign: 'right' },
      2: { cellWidth: 45, halign: 'center' },
    },
    margin: { left: 14, right: 14, top: 18, bottom: 20 },
  });

  currentY = (doc as any).lastAutoTable?.finalY + 7;

  // Check if Top Items section fits on current A4 page
  if (currentY + 45 > pageHeight - A4_PORTRAIT.marginBottom) {
    doc.addPage('a4', 'portrait');
    currentY = A4_PORTRAIT.marginTop;
  }

  // Section 2: Top Selling Items
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Top Selling Electrical Products', 14, currentY);
  currentY += 3.5;

  const topItemHeaders = ['#', 'Product Name', 'Units Sold', 'Total Revenue Generated'];
  const topItemRows = data.topItems.map((item, idx) => [
    String(idx + 1),
    item.name,
    `${item.qty} ${item.unit}`,
    formatCurrencyPdf(item.total),
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [topItemHeaders],
    body:
      topItemRows.length > 0
        ? topItemRows
        : [['-', 'No items sold during this period', '-', '-']],
    theme: 'grid',
    tableWidth: A4_PORTRAIT.contentWidth,
    headStyles: {
      fillColor: [30, 41, 59],
      fontSize: 8,
      textColor: [255, 255, 255],
    },
    bodyStyles: {
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
      2: { cellWidth: 40, halign: 'center' },
      3: { cellWidth: 50, halign: 'right' },
    },
    margin: { left: 14, right: 14, top: 18, bottom: 20 },
  });

  currentY = (doc as any).lastAutoTable?.finalY + 7;

  // Section 3: Time-Ordered Sales & Discount Breakdown
  if (currentY + 40 > pageHeight - A4_PORTRAIT.marginBottom) {
    doc.addPage('a4', 'portrait');
    currentY = A4_PORTRAIT.marginTop;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);

  const timeSectionTitle =
    data.period === 'daily'
      ? 'Daily Time-Ordered Sales & Discount Log'
      : data.period === 'monthly'
      ? 'Day-by-Day Sales & Discount Breakdown'
      : 'Month-by-Month Sales & Discount Breakdown';
  doc.text(timeSectionTitle, 14, currentY);
  currentY += 3.5;

  let timeHeaders: string[] = [];
  let timeRows: (string | number)[][] = [];

  if (data.period === 'daily') {
    timeHeaders = ['Time / Bill #', 'Customer', 'Payment', 'Gross', 'Discount', 'GST', 'Net Total'];
    const sorted = [...data.invoices].sort((a, b) => a.dateTime.localeCompare(b.dateTime));
    timeRows = sorted.map((inv) => {
      const timePart = inv.dateTime.split(' ')[1] || '';
      const disc = getInvoiceDiscount(inv);
      return [
        `${timePart} (${inv.invoiceNumber})`,
        inv.customerName || 'Walk-in',
        inv.paymentMethod.toUpperCase(),
        formatCurrencyPdf(inv.subtotal || (inv.grandTotal - (inv.gstAmount || 0))),
        disc > 0 ? `-${formatCurrencyPdf(disc)}` : '₹0.00',
        formatCurrencyPdf(inv.gstAmount || 0),
        formatCurrencyPdf(inv.grandTotal),
      ];
    });
  } else if (data.period === 'monthly') {
    timeHeaders = ['Date', 'Bills', 'Gross Subtotal', 'Total Discount', 'GST Collected', 'Net Revenue'];
    const dayMap: Record<string, { date: string; bills: number; gross: number; discount: number; gst: number; net: number }> = {};
    data.invoices.forEach((inv) => {
      const day = inv.dateTime.split(' ')[0];
      if (!dayMap[day]) {
        dayMap[day] = { date: day, bills: 0, gross: 0, discount: 0, gst: 0, net: 0 };
      }
      dayMap[day].bills += 1;
      dayMap[day].gross += inv.subtotal || (inv.grandTotal - (inv.gstAmount || 0));
      dayMap[day].discount += getInvoiceDiscount(inv);
      dayMap[day].gst += inv.gstAmount || 0;
      dayMap[day].net += inv.grandTotal;
    });
    timeRows = Object.values(dayMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => [
        r.date,
        String(r.bills),
        formatCurrencyPdf(r.gross),
        r.discount > 0 ? `-${formatCurrencyPdf(r.discount)}` : '₹0.00',
        formatCurrencyPdf(r.gst),
        formatCurrencyPdf(r.net),
      ]);
  } else {
    timeHeaders = ['Month', 'Bills', 'Gross Subtotal', 'Total Discount', 'GST Collected', 'Net Revenue'];
    const monthMap: Record<string, { month: string; bills: number; gross: number; discount: number; gst: number; net: number }> = {};
    data.invoices.forEach((inv) => {
      const m = inv.dateTime.substring(0, 7);
      if (!monthMap[m]) {
        monthMap[m] = { month: m, bills: 0, gross: 0, discount: 0, gst: 0, net: 0 };
      }
      monthMap[m].bills += 1;
      monthMap[m].gross += inv.subtotal || (inv.grandTotal - (inv.gstAmount || 0));
      monthMap[m].discount += getInvoiceDiscount(inv);
      monthMap[m].gst += inv.gstAmount || 0;
      monthMap[m].net += inv.grandTotal;
    });
    timeRows = Object.values(monthMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((r) => [
        r.month,
        String(r.bills),
        formatCurrencyPdf(r.gross),
        r.discount > 0 ? `-${formatCurrencyPdf(r.discount)}` : '₹0.00',
        formatCurrencyPdf(r.gst),
        formatCurrencyPdf(r.net),
      ]);
  }

  autoTable(doc, {
    startY: currentY,
    head: [timeHeaders],
    body:
      timeRows.length > 0
        ? timeRows
        : [['-', 'No transactions recorded for this period', '-', '-', '-', '-']],
    theme: 'grid',
    tableWidth: A4_PORTRAIT.contentWidth,
    headStyles: {
      fillColor: [15, 23, 42],
      fontSize: 8,
      textColor: [255, 255, 255],
    },
    bodyStyles: {
      fontSize: 8,
    },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right', fontStyle: 'bold' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14, top: 18, bottom: 20 },
  });

  // Add standard A4 running footer & page numbers
  addA4PageFooters(doc, `Analytics Report (${data.period.toUpperCase()})`, 'portrait');

  doc.save(`Reports_Analytics_${data.period}_${new Date().toISOString().slice(0, 10)}_A4.pdf`);
}

/**
 * 4. Generates and downloads a Customer Statement / Credit Ledger PDF
 *    strictly formatted for standard ISO A4 paper (210mm x 297mm portrait).
 */
export function downloadCustomerLedgerPdf(
  customer: Customer,
  customerInvoices: Invoice[],
  settings: ShopSettings
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Top-Left Corner Official Logo (Properly sized and straight to shop name)
  const custLogoHeight = 14;
  const custLogoX = 14;
  const custLogoY = 11.2;
  const custLogoDim = drawTopLeftLogo(doc, custLogoX, custLogoY, custLogoHeight, settings);

  const brandX = custLogoX + custLogoDim.width + 3.5;

  // Header straight to the logo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.setTextColor(15, 23, 42);
  const displayName = settings.shopName || 'Sri Senthur Velan Electricals and Pipes';
  doc.text(displayName, brandX, 15.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(234, 88, 12);
  doc.text('CUSTOMER STATEMENT OF ACCOUNT & CREDIT LEDGER (A4)', brandX, 20.5);

  if (settings.phone || settings.gstin) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      [settings.phone ? `Ph: +91 ${settings.phone}` : '', settings.gstin ? `GSTIN: ${settings.gstin}` : '']
        .filter(Boolean)
        .join('  |  '),
      brandX,
      25
    );
  }

  const custRightX = pageWidth - 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, custRightX, 15.5, {
    align: 'right',
  });
  let currentY = 32;

  // Customer Details & Balance Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, currentY, pageWidth - 28, 22, 1.5, 1.5, 'F');
  doc.setFontSize(8.5);

  const colRightX = pageWidth / 2 + 10;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(customer.name, 18, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Mobile: ${customer.phone || 'N/A'}`, 18, currentY + 9.5);
  if (customer.address) {
    doc.text(`Address: ${customer.address}`, 18, currentY + 14);
  }
  if (customer.gstin) {
    doc.text(`GSTIN: ${customer.gstin}`, 18, currentY + 18.5);
  }

  // Right column: Credit stats
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 83, 9); // amber-700
  doc.text(`Outstanding Credit: ${formatCurrencyPdf(customer.creditBalance)}`, colRightX, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Total Lifetime Spend: ${formatCurrencyPdf(customer.totalSpent)}`, colRightX, currentY + 9.5);
  if (customer.expectedPaymentDate) {
    doc.text(`Payment Due By: ${customer.expectedPaymentDate}`, colRightX, currentY + 14);
  }
  doc.text(`Category: ${customer.customerType?.toUpperCase() || 'RETAIL'}`, colRightX, currentY + 18.5);

  currentY += 27;

  // Invoices Table
  const tableHeaders = ['#', 'Invoice No', 'Date', 'Payment Mode', 'Items Count', 'Status', 'Bill Total'];
  const tableBody = customerInvoices.map((inv, idx) => {
    const isCredit = inv.paymentMethod === 'credit';
    const status = isCredit
      ? inv.creditPaid
        ? 'Settled'
        : `Due (${inv.paymentDueDate || 'Pending'})`
      : 'Paid';

    return [
      String(idx + 1),
      inv.invoiceNumber,
      inv.dateTime.split(' ')[0],
      inv.paymentMethod.toUpperCase(),
      String(inv.items.length),
      status,
      formatCurrencyPdf(inv.grandTotal),
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [tableHeaders],
    body:
      tableBody.length > 0
        ? tableBody
        : [['-', 'No transaction history recorded yet', '-', '-', '-', '-', '-']],
    theme: 'grid',
    tableWidth: A4_PORTRAIT.contentWidth,
    showHead: 'everyPage',
    headStyles: {
      fillColor: [30, 41, 59],
      fontSize: 8,
      textColor: [255, 255, 255],
    },
    bodyStyles: {
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 32, fontStyle: 'bold' },
      2: { cellWidth: 26 },
      3: { cellWidth: 26, halign: 'center' },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 36, halign: 'center' },
      6: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14, top: 18, bottom: 20 },
  });

  // Footer
  addA4PageFooters(doc, `Customer Statement: ${customer.name}`, 'portrait');

  const safeName = customer.name.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Statement_${safeName}_A4.pdf`);
}

/**
 * Generates and downloads a Supplier Statement of Account & Purchase/Payment Ledger PDF
 * strictly formatted for standard ISO A4 paper (210mm x 297mm portrait).
 */
export function downloadSupplierLedgerPdf(
  supplier: Supplier,
  transactions: SupplierTransaction[],
  settings: ShopSettings
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Top-Left Corner Official Logo
  const supLogoHeight = 14;
  const supLogoX = 14;
  const supLogoY = 11.2;
  const supLogoDim = drawTopLeftLogo(doc, supLogoX, supLogoY, supLogoHeight, settings);

  const brandX = supLogoX + supLogoDim.width + 3.5;

  // Header straight to the logo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.setTextColor(15, 23, 42);
  const displayName = settings.shopName || 'Sri Senthur Velan Electricals and Pipes';
  doc.text(displayName, brandX, 15.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(234, 88, 12);
  doc.text('SUPPLIER STATEMENT OF ACCOUNT & PAYABLES LEDGER (A4)', brandX, 20.5);

  if (settings.phone || settings.gstin) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      [settings.phone ? `Ph: +91 ${settings.phone}` : '', settings.gstin ? `GSTIN: ${settings.gstin}` : '']
        .filter(Boolean)
        .join('  |  '),
      brandX,
      25
    );
  }

  const supRightX = pageWidth - 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, supRightX, 15.5, {
    align: 'right',
  });
  let currentY = 32;

  // Supplier Details & Balance Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, currentY, pageWidth - 28, 22, 1.5, 1.5, 'F');
  doc.setFontSize(8.5);

  const colRightX = pageWidth / 2 + 10;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(supplier.companyName, 18, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Contact Person: ${supplier.name} | Phone: ${supplier.phone}`, 18, currentY + 9.5);
  if (supplier.address) {
    doc.text(`Address: ${supplier.address}`, 18, currentY + 14);
  }
  doc.text(`GSTIN: ${supplier.gstin || 'Unregistered / None (Optional)'}`, 18, currentY + 18.5);

  // Right column: Balance to pay stats
  const balance = supplier.balance || 0;
  doc.setFont('helvetica', 'bold');
  if (balance > 0) {
    doc.setTextColor(190, 24, 93); // rose-700
    doc.text(`Balance to Pay: ${formatCurrencyPdf(balance)}`, colRightX, currentY + 5);
  } else {
    doc.setTextColor(16, 185, 129); // emerald-600
    doc.text(`Balance to Pay: ${formatCurrencyPdf(balance)} (Settled)`, colRightX, currentY + 5);
  }

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  if (supplier.email) {
    doc.text(`Email: ${supplier.email}`, colRightX, currentY + 9.5);
  } else {
    doc.text(`Status: Active Distributor`, colRightX, currentY + 9.5);
  }
  doc.text(`Total Transactions Recorded: ${transactions.length}`, colRightX, currentY + 14);
  if (supplier.notes) {
    doc.text(`Brands: ${supplier.notes}`, colRightX, currentY + 18.5);
  }

  currentY += 27;

  // Ledger Table
  const tableHeaders = ['#', 'Date & Time', 'Txn Type', 'Reference No', 'Payment Mode', 'Amount', 'Balance After'];
  const tableBody = transactions.map((tx, idx) => {
    let typeLabel = 'Payment';
    if (tx.type === 'purchase_bill') typeLabel = 'Purchase Bill';
    else if (tx.type === 'adjustment') typeLabel = 'Adjustment';
    else if (tx.type === 'opening_balance') typeLabel = 'Opening Balance';

    const amtFormatted = tx.type === 'payment'
      ? `- ${formatCurrencyPdf(tx.amount)}`
      : `+ ${formatCurrencyPdf(tx.amount)}`;

    return [
      String(idx + 1),
      tx.date,
      typeLabel,
      tx.referenceNo || '—',
      tx.paymentMode ? tx.paymentMode.replace('_', ' ') : '—',
      amtFormatted,
      formatCurrencyPdf(tx.balanceAfter),
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [tableHeaders],
    body:
      tableBody.length > 0
        ? tableBody
        : [['-', 'No transaction entries logged yet', '-', '-', '-', '-', '-']],
    theme: 'grid',
    tableWidth: A4_PORTRAIT.contentWidth,
    showHead: 'everyPage',
    headStyles: {
      fillColor: [30, 41, 59],
      fontSize: 8,
      textColor: [255, 255, 255],
    },
    bodyStyles: {
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 32 },
      2: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 30 },
      4: { cellWidth: 24, halign: 'center' },
      5: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14, top: 18, bottom: 20 },
  });

  // Footer
  addA4PageFooters(doc, `Supplier Statement: ${supplier.companyName}`, 'portrait');

  const safeName = supplier.companyName.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Supplier_Ledger_${safeName}_A4.pdf`);
}

/**
 * 5. Generates and downloads an Inventory Stock Valuation & Audit Report PDF
 *    strictly formatted for standard ISO A4 paper (210mm x 297mm portrait).
 */
export function downloadInventoryStockPdf(
  products: Product[],
  settings: ShopSettings,
  filterDescription?: string
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Top-Left Corner Official Logo (Properly sized and straight to shop name)
  const stockLogoHeight = 14;
  const stockLogoX = 14;
  const stockLogoY = 11.2;
  const stockLogoDim = drawTopLeftLogo(doc, stockLogoX, stockLogoY, stockLogoHeight, settings);

  const brandX = stockLogoX + stockLogoDim.width + 3.5;

  // Header straight to the logo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.setTextColor(15, 23, 42);
  const displayName = settings.shopName || 'Sri Senthur Velan Electricals and Pipes';
  doc.text(displayName, brandX, 15.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(234, 88, 12);
  doc.text('INVENTORY STOCK & VALUATION AUDIT REPORT (A4)', brandX, 20.5);

  if (settings.phone || settings.gstin) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      [settings.phone ? `Ph: +91 ${settings.phone}` : '', settings.gstin ? `GSTIN: ${settings.gstin}` : '']
        .filter(Boolean)
        .join('  |  '),
      brandX,
      25
    );
  }

  const stockRightX = pageWidth - 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, stockRightX, 15.5, {
    align: 'right',
  });
  let currentY = 32;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(filterDescription || `Total Products: ${products.length}`, stockRightX, currentY, {
    align: 'right',
  });
  currentY += 7;

  // Valuation Calculation
  const totalStockQty = products.reduce((sum, p) => sum + p.stockQty, 0);
  const totalSellingVal = products.reduce((sum, p) => sum + p.stockQty * p.sellingPrice, 0);
  const totalPurchaseVal = products.reduce((sum, p) => sum + p.stockQty * p.purchasePrice, 0);
  const lowStockCount = products.filter((p) => p.stockQty <= p.minimumStock).length;

  // Summary box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, currentY, pageWidth - 28, 12, 1.5, 1.5, 'F');
  doc.setFontSize(8.5);

  const cardW = (pageWidth - 28) / 4;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Total Items / Qty', 18, currentY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${products.length} (${totalStockQty})`, 18, currentY + 9.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Purchase Valuation', 18 + cardW, currentY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrencyPdf(totalPurchaseVal), 18 + cardW, currentY + 9.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Retail Selling Value', 18 + cardW * 2, currentY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrencyPdf(totalSellingVal), 18 + cardW * 2, currentY + 9.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Low Stock Alert', 18 + cardW * 3, currentY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(lowStockCount > 0 ? 220 : 15, lowStockCount > 0 ? 38 : 23, lowStockCount > 0 ? 38 : 42);
  doc.text(`${lowStockCount} Items Low`, 18 + cardW * 3, currentY + 9.5);

  currentY += 16;

  // Products Table
  const tableHeaders = ['#', 'Product & SKU', 'Category', 'Stock Qty', 'Buy Rate', 'Sale Rate', 'Valuation'];
  const tableBody = products.map((p, idx) => {
    const val = p.stockQty * p.sellingPrice;
    const isLow = p.stockQty <= p.minimumStock;
    const nameWithSku = p.skuCode ? `${p.name} [${p.skuCode}]` : p.name;
    const stockDisplay = isLow ? `${p.stockQty} ${p.unit} (LOW)` : `${p.stockQty} ${p.unit}`;

    return [
      String(idx + 1),
      nameWithSku,
      p.category,
      stockDisplay,
      formatCurrencyPdf(p.purchasePrice),
      formatCurrencyPdf(p.sellingPrice),
      formatCurrencyPdf(val),
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [tableHeaders],
    body: tableBody,
    theme: 'grid',
    tableWidth: A4_PORTRAIT.contentWidth,
    showHead: 'everyPage',
    headStyles: {
      fillColor: [30, 41, 59],
      fontSize: 8,
      textColor: [255, 255, 255],
    },
    bodyStyles: {
      fontSize: 7.5,
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
      2: { cellWidth: 32 },
      3: { cellWidth: 26, halign: 'center' },
      4: { cellWidth: 26, halign: 'right' },
      5: { cellWidth: 26, halign: 'right' },
      6: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14, top: 18, bottom: 20 },
  });

  // Footer
  addA4PageFooters(doc, 'Stock Inventory Valuation Audit', 'portrait');

  const dateTag = new Date().toISOString().slice(0, 10);
  doc.save(`Inventory_Stock_Report_${dateTag}_A4.pdf`);
}
