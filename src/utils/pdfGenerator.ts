import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice, ShopSettings, Customer, Product, Supplier, SupplierTransaction } from '../types';
import { LOGO_BASE64, LOGO_PDF_BASE64 } from './logoData';
import {
  getInvoiceDiscount,
  formatShopAddress,
  formatShopPhone,
  formatShopContactLine,
  formatInvoiceDate,
  formatInvoiceTime,
} from './formatters';

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
    : (242 / 374);
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
      return { width, height };
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

interface StandardReportHeaderOptions {
  doc: jsPDF;
  settings: ShopSettings;
  reportTitle: string;
  reportSubtitle?: string;
  rightMetaLines?: string[];
  startY?: number;
  logoHeight?: number;
}

/**
 * Renders the official brand logo, dynamic shop details (name, address, phone, GSTIN)
 * from settings, report title, and right-aligned generation metadata.
 * Returns the Y coordinate immediately below the header with comfortable padding.
 */
function drawStandardReportHeader({
  doc,
  settings,
  reportTitle,
  reportSubtitle,
  rightMetaLines = [],
  startY = 11.2,
  logoHeight = 14,
}: StandardReportHeaderOptions): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const leftX = 14;
  const rightX = pageWidth - 14;

  // 1. Draw top-left brand logo
  const logoDim = drawTopLeftLogo(doc, leftX, startY, logoHeight, settings);
  const brandX = leftX + logoDim.width + 4;

  // 2. Right Meta block (Generated time, filters, etc.)
  if (rightMetaLines.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    let metaY = startY + 4.2;
    for (const line of rightMetaLines) {
      if (line) {
        doc.text(line, rightX, metaY, { align: 'right' });
        metaY += 4.5;
      }
    }
  }

  // Calculate available text width for left header before hitting right meta
  const rightReservedWidth = rightMetaLines.length > 0 ? 84 : 20;
  const maxTextWidth = Math.max(pageWidth - brandX - rightReservedWidth, 90);

  let curY = startY + 4.2;

  // Business Name from Settings (with safe fallback)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // slate-900
  const displayName = settings.shopName || 'Sri Senthur Velan Electricals and Pipes';
  doc.text(displayName, brandX, curY);
  curY += 4.8;

  // Report Title Badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(234, 88, 12); // orange-600
  doc.text(reportTitle, brandX, curY);
  curY += 4.2;

  // Shop Address from Settings (Street, City, State, PIN)
  const shopAddress = formatShopAddress(settings);
  if (shopAddress) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105); // slate-600
    const addrLines = doc.splitTextToSize(shopAddress, maxTextWidth);
    doc.text(addrLines, brandX, curY);
    curY += addrLines.length * 3.4;
  }

  // Shop Contact details from Settings (Phone, Alternate Phone, GSTIN, Email)
  const contactLine = formatShopContactLine(settings);
  if (contactLine) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85); // slate-700
    const contactLines = doc.splitTextToSize(contactLine, maxTextWidth);
    doc.text(contactLines, brandX, curY);
    curY += contactLines.length * 3.4;
  }

  // Subtitle / Filter Description if provided
  if (reportSubtitle) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const subLines = doc.splitTextToSize(reportSubtitle, maxTextWidth);
    doc.text(subLines, brandX, curY);
    curY += subLines.length * 3.4;
  }

  // Ensure clearance below both logo and text block
  return Math.max(curY + 2.5, startY + logoHeight + 3);
}

/**
 * 1. Generates and downloads an official GST / Retail Invoice PDF formatted
 *    for standard ISO A4 (210mm x 297mm) or ISO A5 (148mm x 210mm) paper.
 */
export function downloadInvoicePdf(
  invoice: Invoice,
  settings: ShopSettings,
  paperSize: 'a4' | 'a5' = 'a4'
): void {
  const isA5 = paperSize === 'a5';
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: isA5 ? 'a5' : 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 148mm for A5, 210mm for A4
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm for A5, 297mm for A4
  const marginX = isA5 ? 9 : 14;
  const contentWidth = pageWidth - marginX * 2;

  // 1. Optional Custom Logo (if user uploaded their own custom logo in settings)
  const logoHeight = isA5 ? 11 : 14;
  const logoX = marginX;
  const logoY = isA5 ? 8.5 : 11.2;
  const logoDim = drawTopLeftLogo(doc, logoX, logoY, logoHeight, settings);

  // 2. Shop Brand Header
  const brandX = logoDim.width > 0 ? (logoX + logoDim.width + 3) : marginX;
  let currentY = isA5 ? 8.5 : 11.2;

  // Tagline highlighted above shop name: "Your trusted electrical partner"
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isA5 ? 7 : 8.5);
  doc.setTextColor(234, 88, 12); // orange-600
  doc.text('YOUR TRUSTED ELECTRICAL PARTNER', brandX, currentY);
  currentY += isA5 ? 3.6 : 4.5;

  // Shop Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isA5 ? 11.5 : 14);
  doc.setTextColor(15, 23, 42); // slate-900
  const displayName = settings.shopName || 'Sri Senthur Velan Electricals and Pipes';
  doc.text(displayName, brandX, currentY);
  currentY += isA5 ? 3.8 : 4.5;

  const metaRightX = pageWidth - marginX;
  const maxBrandWidth = Math.max(metaRightX - (isA5 ? 45 : 60) - brandX, isA5 ? 50 : 70);

  const shopContact = formatShopAddress(settings);
  if (shopContact) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(isA5 ? 6.5 : 7.5);
    doc.setTextColor(71, 85, 105);
    const addrLines = doc.splitTextToSize(shopContact, maxBrandWidth);
    doc.text(addrLines, brandX, currentY);
    currentY += addrLines.length * (isA5 ? 2.8 : 3.4);
  }

  const phoneGstin = formatShopContactLine(settings);
  if (phoneGstin) {
    doc.setFontSize(isA5 ? 6.5 : 7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    const contactLines = doc.splitTextToSize(phoneGstin, maxBrandWidth);
    doc.text(contactLines, brandX, currentY);
    currentY += contactLines.length * (isA5 ? 2.8 : 3.4);
  }

  // Top-Right: Clean Invoice Title, No & Date
  const docTitle = invoice.gstApplied ? 'TAX INVOICE' : 'CASH MEMO';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isA5 ? 11 : 13);
  doc.setTextColor(15, 23, 42);
  doc.text(docTitle, metaRightX, isA5 ? 12 : 15.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(isA5 ? 7 : 8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Invoice No: ${invoice.invoiceNumber}`, metaRightX, isA5 ? 16 : 20, { align: 'right' });
  doc.text(`Date: ${formatInvoiceDate(invoice.dateTime)}`, metaRightX, isA5 ? 19.5 : 24, { align: 'right' });

  currentY = Math.max(currentY + 2, isA5 ? 24 : 29);

  // Header Divider
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  currentY += isA5 ? 3 : 4;

  // Billed To Details (Single clean bar)
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(marginX, currentY, contentWidth, isA5 ? 7.5 : 9, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isA5 ? 7 : 8);
  doc.setTextColor(71, 85, 105);
  doc.text('Billed To:', marginX + 3, currentY + (isA5 ? 4.8 : 5.8));

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(invoice.customerName || 'Walk-in Customer', marginX + (isA5 ? 16 : 21), currentY + (isA5 ? 4.8 : 5.8));

  let custMeta = '';
  if (invoice.customerPhone) custMeta += `Ph: ${invoice.customerPhone}`;
  if (invoice.customerGstin) custMeta += (custMeta ? '  |  ' : '') + `GSTIN: ${invoice.customerGstin}`;

  if (custMeta) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(custMeta, marginX + (isA5 ? 55 : 85), currentY + (isA5 ? 4.8 : 5.8));
  }

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Mode: ${invoice.paymentMethod.toUpperCase()}`, metaRightX - 3, currentY + (isA5 ? 4.8 : 5.8), { align: 'right' });

  currentY += isA5 ? 10 : 13;

  // Itemized Table (calibrated to content width)
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
    tableWidth: contentWidth,
    showHead: 'everyPage',
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontSize: isA5 ? 7 : 8,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: isA5 ? 7 : 8,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: invoice.gstApplied
      ? {
          0: { cellWidth: isA5 ? 8 : 10, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: isA5 ? 13 : 16, halign: 'center' },
          3: { cellWidth: isA5 ? 10 : 14, halign: 'right' },
          4: { cellWidth: isA5 ? 10 : 14, halign: 'center' },
          5: { cellWidth: isA5 ? 16 : 22, halign: 'right' },
          6: { cellWidth: isA5 ? 12 : 16, halign: 'center' },
          7: { cellWidth: isA5 ? 18 : 26, halign: 'right', fontStyle: 'bold' },
        }
      : {
          0: { cellWidth: isA5 ? 9 : 12, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: isA5 ? 14 : 18, halign: 'right' },
          3: { cellWidth: isA5 ? 13 : 18, halign: 'center' },
          4: { cellWidth: isA5 ? 20 : 28, halign: 'right' },
          5: { cellWidth: isA5 ? 24 : 32, halign: 'right', fontStyle: 'bold' },
        },
    margin: {
      left: marginX,
      right: marginX,
      top: isA5 ? 12 : 18,
      bottom: isA5 ? 14 : 22,
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || currentY + 30;
  let summaryY = finalY + (isA5 ? 4 : 6);

  // Check if summary + signature blocks fit on current page
  if (summaryY + (isA5 ? 40 : 55) > pageHeight - (isA5 ? 14 : 20)) {
    doc.addPage(isA5 ? 'a5' : 'a4', 'portrait');
    summaryY = isA5 ? 12 : A4_PORTRAIT.marginTop;
  }

  // Financial Summary Block (Right Aligned)
  const summaryBoxWidth = isA5 ? 58 : 76;
  const summaryBoxX = pageWidth - marginX - summaryBoxWidth;

  // Left side info: Payment Terms / Notes
  if (settings.termsAndConditions || settings.footerMessage) {
    doc.setFontSize(isA5 ? 6.5 : 7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    const noteText = settings.termsAndConditions || settings.footerMessage || '';
    const noteLines = doc.splitTextToSize(noteText, pageWidth - marginX - summaryBoxWidth - (isA5 ? 6 : 10));
    doc.text(noteLines, marginX, summaryY + 2);
  }

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
    doc.text(formatCurrencyPdf(sgst), pageWidth - marginX, summaryY, { align: 'right' });
    summaryY += 4.5;
  }

  // Grand Total Highlight
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(summaryBoxX - 2, summaryY - 3.5, summaryBoxWidth + 2, 8, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isA5 ? 9.5 : 10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Grand Total:', summaryBoxX, summaryY + 2);
  doc.text(formatCurrencyPdf(invoice.grandTotal), pageWidth - marginX, summaryY + 2, { align: 'right' });

  summaryY += 15;

  // Signatory Stamp Section (Always guaranteed on the last page)
  let sigY = summaryY;
  if (sigY + 22 > pageHeight - (isA5 ? 14 : A4_PORTRAIT.marginBottom)) {
    doc.addPage(isA5 ? 'a5' : 'a4', 'portrait');
    sigY = isA5 ? 14 : (A4_PORTRAIT.marginTop + 4);
  }

  const sigWidth = isA5 ? 45 : 55;
  doc.setDrawColor(203, 213, 225);
  doc.line(pageWidth - marginX - sigWidth, sigY + 12, pageWidth - marginX, sigY + 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isA5 ? 7.5 : 8);
  doc.setTextColor(51, 65, 85);
  doc.text(`For ${settings.shopName || 'Store'}`, pageWidth - marginX - (sigWidth / 2), sigY + 8, {
    align: 'center',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(isA5 ? 7 : 7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Authorized Signatory', pageWidth - marginX - (sigWidth / 2), sigY + 16, { align: 'center' });

  // Add standard footer & page numbers
  addA4PageFooters(doc, `Invoice #${invoice.invoiceNumber} (${isA5 ? 'A5' : 'A4'})`, 'portrait');

  // Trigger browser download
  doc.save(`${invoice.invoiceNumber}_${isA5 ? 'A5' : 'A4'}.pdf`);
}

/**
 * 2. Generates and downloads a comprehensive Sales Ledger / Invoices History PDF report
 *    strictly formatted for standard ISO A4 paper (297mm x 210mm landscape).
 */
export function downloadSalesHistoryPdf(
  invoices: Invoice[],
  settings: ShopSettings,
  filterDescription?: string,
  products?: Product[]
): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm

  // Map of productId / name to purchasePrice / costPrice
  const productCostMap = new Map<string, number>();
  products?.forEach((p) => {
    const cost = p.purchasePrice ?? (p as any).costPrice ?? 0;
    productCostMap.set(p.productId, cost);
    if (p.name) {
      productCostMap.set(p.name.toLowerCase().trim(), cost);
    }
  });

  const getItemCostPrice = (item: any): number => {
    if (typeof item.purchasePrice === 'number' && item.purchasePrice >= 0) return item.purchasePrice;
    if (typeof item.costPrice === 'number' && item.costPrice >= 0) return item.costPrice;
    if (item.productId && productCostMap.has(item.productId)) return productCostMap.get(item.productId) || 0;
    if (item.productNameSnapshot) {
      const key = item.productNameSnapshot.toLowerCase().trim();
      if (productCostMap.has(key)) return productCostMap.get(key) || 0;
    }
    return 0;
  };

  const nowStr = new Date().toLocaleString('en-IN');
  let currentY = drawStandardReportHeader({
    doc,
    settings,
    reportTitle: 'SALES & INVOICES HISTORY REPORT (A4 FORMAT)',
    rightMetaLines: [
      `Generated on: ${nowStr}`,
      filterDescription || `Total Invoices: ${invoices.length}`,
    ],
    startY: 11.2,
    logoHeight: 14,
  });

  currentY = Math.max(currentY, 32);

  // Financial Metrics Summary Bar
  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
  const totalGst = invoices.reduce((sum, inv) => sum + (inv.gstAmount || 0), 0);
  const totalTaxable = totalRevenue - totalGst;
  const pendingCreditInvoices = invoices.filter((i) => i.paymentMethod === 'credit' && !i.creditPaid);
  const pendingCreditTotal = pendingCreditInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
  const totalProfit = invoices.reduce((sum, inv) => {
    const gross = inv.subtotal || (inv.grandTotal - (inv.gstAmount || 0));
    const disc = getInvoiceDiscount(inv);
    const tax = Math.max(0, gross - disc);
    const cogs = inv.items.reduce((s, it) => s + getItemCostPrice(it) * it.quantity, 0);
    return sum + (tax - cogs);
  }, 0);

  // Background box for summary
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, currentY, pageWidth - 28, 12, 1.5, 1.5, 'F');
  doc.setFontSize(8);

  const cardW = (pageWidth - 28) / 5;
  // Metric 1: Total Bills
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Total Invoices', 18, currentY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${invoices.length} Bills`, 18, currentY + 9.5);

  // Metric 2: Taxable Value
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Taxable Value', 18 + cardW, currentY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrencyPdf(totalTaxable), 18 + cardW, currentY + 9.5);

  // Metric 3: GST Collected
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('GST Collected', 18 + cardW * 2, currentY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrencyPdf(totalGst), 18 + cardW * 2, currentY + 9.5);

  // Metric 4: Grand Sales Total
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Grand Sales Total', 18 + cardW * 3, currentY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrencyPdf(totalRevenue), 18 + cardW * 3, currentY + 9.5);

  // Metric 5: Total Profit
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text('Total Profit', 18 + cardW * 4, currentY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(4, 120, 87); // emerald-700
  doc.text(
    totalProfit >= 0 ? `+${formatCurrencyPdf(totalProfit)}` : `-${formatCurrencyPdf(Math.abs(totalProfit))}`,
    18 + cardW * 4,
    currentY + 9.5
  );

  currentY += 16;

  // Table of Invoices (sums to 269mm content width)
  const tableHeaders = [
    '#',
    'Invoice No',
    'Date & Time',
    'Customer Details',
    'Payment Mode',
    'Taxable',
    'GST',
    'Grand Total',
    'Profit',
    'Status',
  ];

  const tableBody = invoices.map((inv, idx) => {
    const gross = inv.subtotal || (inv.grandTotal - (inv.gstAmount || 0));
    const disc = getInvoiceDiscount(inv);
    const taxable = Math.max(0, gross - disc);
    const cogs = inv.items.reduce((s, it) => s + getItemCostPrice(it) * it.quantity, 0);
    const profit = taxable - cogs;
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
      profit >= 0 ? `+${formatCurrencyPdf(profit)}` : `-${formatCurrencyPdf(Math.abs(profit))}`,
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
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 26, fontStyle: 'bold' },
      2: { cellWidth: 30 },
      3: { cellWidth: 50 },
      4: { cellWidth: 24, halign: 'center' },
      5: { cellWidth: 24, halign: 'right' },
      6: { cellWidth: 22, halign: 'right' },
      7: { cellWidth: 27, halign: 'right', fontStyle: 'bold' },
      8: { cellWidth: 28, halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87] },
      9: { cellWidth: 30, halign: 'center' },
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
    totalProfit?: number;
    totalCost?: number;
    profitMargin?: number;
    totalBills: number;
    totalDiscount?: number;
    totalGst: number;
    totalUnitsSold: number;
    avgBillValue: number;
    paymentBreakdown: Record<string, number>;
    topItems: Array<{ name: string; qty: number; total: number; unit: string; profit?: number; margin?: number }>;
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

  const nowStr = new Date().toLocaleString('en-IN');
  let currentY = drawStandardReportHeader({
    doc,
    settings,
    reportTitle: `BUSINESS PERFORMANCE & SALES REPORT (${data.selectedPeriodLabel.toUpperCase()})`,
    rightMetaLines: [`Generated: ${nowStr}`],
    startY: 11.2,
    logoHeight: 14,
  });

  currentY = Math.max(currentY, 32);

  // Row 1: 3 Metric Cards (Total Revenue, Gross Profit, Invoices)
  const cardWidth3 = (A4_PORTRAIT.contentWidth - 8) / 3; // ~58mm each
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

  // Card 2: Gross Profit & Margin
  const card2X = 14 + cardWidth3 + 4;
  const profitVal = data.totalProfit ?? 0;
  const marginStr = typeof data.profitMargin === 'number' ? ` (${data.profitMargin.toFixed(1)}%)` : '';
  doc.setFillColor(220, 252, 231); // emerald-100
  doc.roundedRect(card2X, currentY, cardWidth3, cardHeight, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(21, 128, 61); // emerald-700
  doc.text(`GROSS PROFIT${marginStr}`, card2X + 3, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 83, 45); // emerald-900
  doc.text(formatCurrencyPdf(profitVal), card2X + 3, currentY + 11.5);

  // Card 3: Total Invoices & Avg Value
  const card3X = card2X + cardWidth3 + 4;
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(card3X, currentY, cardWidth3, cardHeight, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('INVOICES / AVG TICKET', card3X + 3, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `${data.totalBills} Bills (${formatCurrencyPdf(data.avgBillValue)})`,
    card3X + 3,
    currentY + 11.5
  );

  currentY += cardHeight + 3.5;

  // Row 2: 3 Metric Cards (Total Discount, GST Collected, Total Units Sold)
  // Card 4: Total Discount Given
  const discountVal = data.totalDiscount || 0;
  doc.setFillColor(255, 237, 213); // orange-100
  doc.roundedRect(14, currentY, cardWidth3, cardHeight, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(194, 65, 12); // orange-700
  doc.text('TOTAL DISCOUNT GIVEN', 17, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(154, 52, 18);
  doc.text(`-${formatCurrencyPdf(discountVal)}`, 17, currentY + 11.5);

  // Card 5: GST Collected
  const card5X = 14 + cardWidth3 + 4;
  doc.setFillColor(238, 242, 255); // indigo-50
  doc.roundedRect(card5X, currentY, cardWidth3, cardHeight, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(67, 56, 202); // indigo-700
  doc.text('GST TAX COLLECTED', card5X + 3, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(49, 46, 129);
  doc.text(formatCurrencyPdf(data.totalGst), card5X + 3, currentY + 11.5);

  // Card 6: Total Units Sold
  const card6X = card5X + cardWidth3 + 4;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(card6X, currentY, cardWidth3, cardHeight, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('TOTAL QUANTITY SOLD', card6X + 3, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`${data.totalUnitsSold} Units Sold`, card6X + 3, currentY + 11.5);

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

  const nowStr = new Date().toLocaleString('en-IN');
  let currentY = drawStandardReportHeader({
    doc,
    settings,
    reportTitle: 'CUSTOMER STATEMENT OF ACCOUNT & CREDIT LEDGER (A4)',
    rightMetaLines: [`Generated: ${nowStr}`],
    startY: 11.2,
    logoHeight: 14,
  });

  currentY = Math.max(currentY, 32);

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

  const nowStr = new Date().toLocaleString('en-IN');
  let currentY = drawStandardReportHeader({
    doc,
    settings,
    reportTitle: 'SUPPLIER STATEMENT OF ACCOUNT & PAYABLES LEDGER (A4)',
    rightMetaLines: [`Generated: ${nowStr}`],
    startY: 11.2,
    logoHeight: 14,
  });

  currentY = Math.max(currentY, 32);

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

  const nowStr = new Date().toLocaleString('en-IN');
  let currentY = drawStandardReportHeader({
    doc,
    settings,
    reportTitle: 'INVENTORY STOCK & VALUATION AUDIT REPORT (A4)',
    reportSubtitle: filterDescription,
    rightMetaLines: [
      `Generated: ${nowStr}`,
      filterDescription || `Total Products: ${products.length}`,
    ],
    startY: 11.2,
    logoHeight: 14,
  });

  currentY = Math.max(currentY, 32);

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
