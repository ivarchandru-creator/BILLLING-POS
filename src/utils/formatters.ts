import { Invoice, PaymentMethod } from '../types';
import { LOGO_URL } from './logoData';

export function formatINR(amount: number): string {
  if (isNaN(amount)) return '₹0.00';
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatINRCompact(amount: number): string {
  if (isNaN(amount)) return '₹0';
  return `₹${amount.toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`;
}

export function getPaymentMethodBadge(method: PaymentMethod): { label: string; bg: string; text: string } {
  switch (method) {
    case 'cash':
      return { label: 'Cash', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300', text: 'text-emerald-700' };
    case 'upi':
      return { label: 'UPI', bg: 'bg-blue-100 text-blue-800 border-blue-300', text: 'text-blue-700' };
    case 'card':
      return { label: 'Card', bg: 'bg-purple-100 text-purple-800 border-purple-300', text: 'text-purple-700' };
    case 'credit':
      return { label: 'Credit / Due', bg: 'bg-amber-100 text-amber-800 border-amber-300', text: 'text-amber-700' };
    default:
      return { label: method, bg: 'bg-slate-100 text-slate-800 border-slate-300', text: 'text-slate-700' };
  }
}

export function generateInvoiceNumber(existingInvoices: Invoice[]): string {
  const currentYear = new Date().getFullYear();
  const prefix = `EB-${currentYear}-`;
  const existingNumbers = existingInvoices
    .filter((inv) => inv.invoiceNumber.startsWith(prefix))
    .map((inv) => {
      const parts = inv.invoiceNumber.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      return isNaN(num) ? 0 : num;
    });

  const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 101;
  return `${prefix}${String(nextNumber).padStart(3, '0')}`;
}

export function getCurrentDateTimeFormatted(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

/**
 * Formats date part of an invoice dateTime string (e.g. "2026-09-20 09:21:45" -> "20-09-2026")
 */
export function formatInvoiceDate(dateTimeStr?: string): string {
  if (!dateTimeStr) return '';
  const datePart = dateTimeStr.split(' ')[0] || dateTimeStr.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length === 3) {
    const [yyyy, mm, dd] = parts;
    return `${dd}-${mm}-${yyyy}`;
  }
  return datePart;
}

/**
 * Formats time part of an invoice dateTime string to 12-hour AM/PM format
 * (e.g. "2026-09-20 14:30:15" -> "02:30:15 PM", "10:30" -> "10:30 AM")
 */
export function formatInvoiceTime(dateTimeStr?: string, includeSeconds = true): string {
  if (!dateTimeStr) return '';
  
  // Check if dateTimeStr has a space or 'T' separator
  let timePart = '';
  if (dateTimeStr.includes(' ')) {
    timePart = dateTimeStr.split(' ')[1] || '';
  } else if (dateTimeStr.includes('T')) {
    timePart = dateTimeStr.split('T')[1] || '';
  } else if (dateTimeStr.includes(':')) {
    timePart = dateTimeStr;
  }

  // Remove any milliseconds or timezone if present
  timePart = timePart.split('.')[0].replace('Z', '');

  if (!timePart) return '';

  const timeSegments = timePart.split(':');
  if (timeSegments.length >= 2) {
    let hours = parseInt(timeSegments[0], 10);
    const minutes = timeSegments[1];
    const seconds = timeSegments[2];

    if (isNaN(hours)) return timePart;

    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const formattedHours = String(hours).padStart(2, '0');

    if (includeSeconds && seconds !== undefined) {
      return `${formattedHours}:${minutes}:${seconds} ${ampm}`;
    }
    return `${formattedHours}:${minutes} ${ampm}`;
  }

  return timePart;
}

/**
 * Formats full invoice date and time together (e.g. "20-09-2026 • 09:21:45 AM")
 */
export function formatInvoiceDateTime(dateTimeStr?: string): string {
  if (!dateTimeStr) return '';
  const date = formatInvoiceDate(dateTimeStr);
  const time = formatInvoiceTime(dateTimeStr);
  if (date && time) return `${date} • ${time}`;
  return date || time || dateTimeStr;
}

export function getInvoiceDiscount(inv: Invoice): number {
  if (typeof inv.discountAmount === 'number' && inv.discountAmount >= 0) {
    return inv.discountAmount;
  }
  if (typeof inv.discountPercent === 'number' && inv.discountPercent > 0 && inv.subtotal) {
    return Math.round(((inv.subtotal * inv.discountPercent) / 100) * 100) / 100;
  }
  return 0;
}

export function formatShopAddress(settings: {
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}): string {
  const parts: string[] = [];
  const rawAddr = settings.address?.trim();
  if (rawAddr) {
    parts.push(rawAddr);
  }

  const localityParts: string[] = [];
  const city = settings.city?.trim();
  const state = settings.state?.trim();
  const pincode = settings.pincode?.trim();

  // Only add city/state if they are not already verbatim in rawAddr
  if (city && (!rawAddr || !rawAddr.toLowerCase().includes(city.toLowerCase()))) {
    localityParts.push(city);
  }
  if (state && (!rawAddr || !rawAddr.toLowerCase().includes(state.toLowerCase()))) {
    localityParts.push(state);
  }

  let locality = localityParts.join(', ');
  if (pincode && (!rawAddr || !rawAddr.includes(pincode))) {
    locality = locality ? `${locality} - ${pincode}` : pincode;
  }

  if (locality) {
    parts.push(locality);
  }

  return parts.join(', ');
}

export function formatShopPhone(phone?: string, altPhone?: string): string {
  const parts: string[] = [];
  if (phone && phone.trim()) {
    const clean = phone.trim();
    parts.push(clean.startsWith('+') ? clean : `+91 ${clean}`);
  }
  if (altPhone && altPhone.trim()) {
    const cleanAlt = altPhone.trim();
    parts.push(cleanAlt.startsWith('+') ? cleanAlt : `+91 ${cleanAlt}`);
  }
  return parts.join(' / ');
}

export function formatShopContactLine(settings: {
  phone?: string;
  alternatePhone?: string;
  gstin?: string;
  email?: string;
}): string {
  const parts: string[] = [];
  const phoneText = formatShopPhone(settings.phone, settings.alternatePhone);
  if (phoneText) {
    parts.push(`Ph: ${phoneText}`);
  }
  if (settings.email && settings.email.trim()) {
    parts.push(`Email: ${settings.email.trim()}`);
  }
  if (settings.gstin && settings.gstin.trim()) {
    parts.push(`GSTIN: ${settings.gstin.trim()}`);
  }
  return parts.join('  |  ');
}

export function getShopLogoUrl(settings?: { logoUrl?: string } | null): string {
  if (settings && settings.logoUrl && settings.logoUrl.trim()) {
    return settings.logoUrl.trim();
  }
  return LOGO_URL;
}
