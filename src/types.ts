export type PaymentMethod = 'cash' | 'upi' | 'card' | 'credit';
export type PrinterType = 'thermal' | 'ink';
export type ThermalWidth = '58mm' | '80mm';
export type BillPaperSize = 'a5' | 'a4' | 'thermal';
export type StockTransactionType = 'purchase' | 'sale' | 'adjustment' | 'return';
export type ActiveTab = 'dashboard' | 'billing' | 'inventory' | 'customers' | 'suppliers' | 'invoices' | 'reports' | 'settings';

export interface Customer {
  customerId: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  siteAddress?: string;
  gstin?: string;
  customerType: 'walk-in' | 'electrician' | 'contractor' | 'wholesale' | 'retail';
  creditBalance: number;
  totalSpent: number;
  lastPurchaseDate?: string;
  expectedPaymentDate?: string;
}

export interface Product {
  productId: string;
  name: string;
  category: string;
  skuCode?: string;
  sellingPrice: number;
  purchasePrice: number;
  gstRate: number; // e.g. 18, 12, 28, 5
  stockQty: number;
  minimumStock: number;
  unit: string; // 'pcs', 'coil', 'meter', 'box', 'set'
  supplierId?: string;
  supplierName?: string;
  activeStatus: boolean;
  hsnCode?: string;
}

export interface InvoiceItem {
  productId: string;
  productNameSnapshot: string;
  quantity: number;
  unitPrice: number;
  purchasePrice?: number; // Snapshot of cost/purchase price at time of sale
  costPrice?: number; // Alias for purchase/cost price
  lineTotal: number;
  gstRate: number;
  unit: string;
  hsnCode?: string;
}

export interface Invoice {
  invoiceId: string;
  invoiceNumber: string;
  dateTime: string;
  customerName?: string;
  customerPhone?: string;
  customerId?: string;
  customerAddress?: string;
  customerGstin?: string;
  customerCategory?: string;
  items: InvoiceItem[];
  subtotal: number;
  discountType?: 'amount' | 'percentage';
  discountAmount?: number;
  discountPercent?: number;
  gstApplied: boolean;
  gstRate?: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  paymentDueDate?: string; // YYYY-MM-DD for credit bills
  creditPaid?: boolean;
  creditPaidDate?: string;
  printerType: PrinterType;
  templateType: ThermalWidth | 'a4' | 'a5';
  createdBy: string;
  notes?: string;
  status: 'completed' | 'cancelled';
}

export interface Supplier {
  supplierId: string;
  name: string;
  phone: string;
  email?: string;
  companyName: string;
  address?: string;
  gstin?: string;
  activeStatus: boolean;
  notes?: string;
  balance?: number; // Outstanding balance to pay to this supplier (payable)
}

export type SupplierTxType = 'purchase_bill' | 'payment' | 'opening_balance' | 'adjustment';
export type SupplierPaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE';

export interface SupplierTransaction {
  id: string;
  supplierId: string;
  date: string;
  type: SupplierTxType;
  amount: number;
  paymentMode?: SupplierPaymentMode;
  referenceNo?: string;
  notes?: string;
  balanceAfter: number;
}

export interface StockTransaction {
  transactionId: string;
  productId: string;
  productName: string;
  type: StockTransactionType;
  quantity: number;
  previousStock: number;
  newStock: number;
  referenceId?: string; // e.g. invoiceId or purchase bill #
  reason?: string;
  supplierId?: string;
  supplierName?: string;
  dateTime: string;
  unitCost?: number;
  notes?: string;
}

export interface ShopSettings {
  shopName: string;
  tagline: string;
  ownerName: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  gstin: string;
  upiId?: string;
  logoUrl?: string;
  logoAspectRatio?: number;
  defaultPrinterType: PrinterType;
  thermalPaperWidth: ThermalWidth;
  defaultGstOn: boolean;
  defaultGstRate?: number;
  footerMessage: string;
  termsAndConditions: string;
  currentUserRole: 'admin' | 'staff';
  currentUserName: string;
}

export interface DraftBillingState {
  cartItems: InvoiceItem[];
  selectedCustomerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerGstin: string;
  customerCategory: 'walk-in' | 'electrician' | 'contractor' | 'wholesale' | 'retail';
  paymentMethod: PaymentMethod;
  paymentDueDate: string;
  isGstBill: boolean;
  overrideGstRate?: number;
  discountType?: 'amount' | 'percentage';
  discountAmount?: number;
  discountPercent: number;
  cashTendered: string;
  activeInvoiceId?: string;
  activeInvoiceNumber?: string;
  billPaperSize?: BillPaperSize;
}

export interface HeldInvoice {
  id: string;
  holdNumber: number;
  heldAt: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  customerGstin?: string;
  customerCategory?: 'walk-in' | 'electrician' | 'contractor' | 'wholesale' | 'retail';
  selectedCustomerId?: string;
  cartItems: InvoiceItem[];
  paymentMethod: PaymentMethod;
  paymentDueDate: string;
  isGstBill: boolean;
  discountType?: 'amount' | 'percentage';
  discountAmount?: number;
  discountPercent?: number;
  discountAmountInput?: string;
  discountPercentInput?: string;
  cashTendered?: string;
  note?: string;
  activeInvoiceId?: string;
  activeInvoiceNumber?: string;
  subtotal: number;
  grandTotal: number;
}

export interface AdminUser {
  adminId: string;
  name: string;
  password: string;
  role: 'admin';
  createdAt: string;
  lastLoginAt?: string;
}

export interface AuthSession {
  adminId: string;
  name: string;
  loginTime: string;
}
