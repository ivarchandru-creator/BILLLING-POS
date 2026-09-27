import { Product, Supplier, SupplierTransaction, Invoice, ShopSettings, StockTransaction, Customer, DraftBillingState, HeldInvoice } from '../types';
import {
  INITIAL_SHOP_SETTINGS,
} from '../data/electricalShopData';

const STORAGE_KEYS = {
  PRODUCTS: 'elec_shop_products_v3',
  INVOICES: 'elec_shop_invoices_v3',
  SUPPLIERS: 'elec_shop_suppliers_v3',
  SUPPLIER_TX: 'elec_shop_supplier_txs_v3',
  CUSTOMERS: 'elec_shop_customers_v3',
  SETTINGS: 'elec_shop_settings_v3',
  STOCK_TX: 'elec_shop_stock_tx_v3',
  DRAFT_BILL: 'elec_shop_draft_bill_v3',
  HELD_BILLS: 'elec_shop_held_bills_v1',
  CATEGORIES: 'elec_shop_categories_v3',
  RECENT_PRODUCTS: 'elec_shop_recent_billing_products_v1',
};

const CLEAN_DATA_FLAG_KEY = 'elec_shop_clean_data_initialized_v5';

export const DEFAULT_PRODUCT_CATEGORIES = [
  'Switches & Sockets',
  'Wires & Cables',
  'LED & Lighting',
  'MCB & Switchgear',
  'Pipes & Conduits',
  'Fans & Fixtures',
  'Accessories & Tools',
];

/**
 * Automatically purges legacy mock data on first load so the app is completely clean.
 */
export function initializeCleanStore(): void {
  try {
    const isCleaned = localStorage.getItem(CLEAN_DATA_FLAG_KEY);
    if (!isCleaned) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.SUPPLIER_TX, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.STOCK_TX, JSON.stringify([]));
      localStorage.removeItem(STORAGE_KEYS.DRAFT_BILL);
      localStorage.setItem(STORAGE_KEYS.HELD_BILLS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.RECENT_PRODUCTS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_PRODUCT_CATEGORIES));
      localStorage.setItem(CLEAN_DATA_FLAG_KEY, 'true');
    }
  } catch (e) {
    console.error('Error initializing clean store', e);
  }
}

// Run immediately
initializeCleanStore();

export function loadProducts(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (!raw) return [];
    const parsed: Product[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((p) => ({
      ...p,
      sellingPrice: typeof p.sellingPrice === 'number' && isFinite(p.sellingPrice) ? Math.max(0, Math.round(p.sellingPrice * 100) / 100) : 0,
      purchasePrice: typeof p.purchasePrice === 'number' && isFinite(p.purchasePrice) ? Math.max(0, Math.round(p.purchasePrice * 100) / 100) : 0,
      stockQty: typeof p.stockQty === 'number' && isFinite(p.stockQty) ? Math.max(0, p.stockQty) : 0,
      minimumStock: typeof p.minimumStock === 'number' && isFinite(p.minimumStock) ? Math.max(0, p.minimumStock) : 10,
      gstRate: typeof p.gstRate === 'number' && isFinite(p.gstRate) ? Math.max(0, p.gstRate) : 0,
      activeStatus: p.activeStatus !== false,
    }));
  } catch {
    return [];
  }
}

export function saveProducts(products: Product[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  } catch (e) {
    console.error('Failed to save products', e);
  }
}

export function loadInvoices(): Invoice[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.INVOICES);
    if (!raw) return [];
    const parsed: any[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((inv) => ({
      ...inv,
      subtotal: typeof inv.subtotal === 'number' && isFinite(inv.subtotal) ? Math.round(inv.subtotal * 100) / 100 : 0,
      grandTotal: typeof inv.grandTotal === 'number' && isFinite(inv.grandTotal) ? Math.round(inv.grandTotal * 100) / 100 : 0,
      gstAmount: typeof inv.gstAmount === 'number' && isFinite(inv.gstAmount) ? Math.round(inv.gstAmount * 100) / 100 : 0,
      cgstAmount: typeof inv.cgstAmount === 'number' && isFinite(inv.cgstAmount) ? Math.round(inv.cgstAmount * 100) / 100 : 0,
      sgstAmount: typeof inv.sgstAmount === 'number' && isFinite(inv.sgstAmount) ? Math.round(inv.sgstAmount * 100) / 100 : 0,
      discountAmount: typeof inv.discountAmount === 'number' && isFinite(inv.discountAmount) ? Math.max(0, Math.round(inv.discountAmount * 100) / 100) : 0,
      items: Array.isArray(inv.items)
        ? inv.items.map((it: any) => ({
            ...it,
            quantity: typeof it.quantity === 'number' && isFinite(it.quantity) ? it.quantity : 1,
            unitPrice: typeof it.unitPrice === 'number' && isFinite(it.unitPrice) ? Math.round(it.unitPrice * 100) / 100 : 0,
            lineTotal: typeof it.lineTotal === 'number' && isFinite(it.lineTotal) ? Math.round(it.lineTotal * 100) / 100 : Math.round(((it.quantity || 1) * (it.unitPrice || 0)) * 100) / 100,
          }))
        : [],
      printerType: inv.printerType === 'laser' ? 'ink' : (inv.printerType || 'ink'),
    }));
  } catch {
    return [];
  }
}

export function saveInvoices(invoices: Invoice[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
  } catch (e) {
    console.error('Failed to save invoices', e);
  }
}

export function loadSuppliers(): Supplier[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SUPPLIERS);
    if (!raw) return [];
    const parsed: Supplier[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((s) => ({
      ...s,
      balance: typeof s.balance === 'number' && isFinite(s.balance) ? Math.round(s.balance * 100) / 100 : 0,
    }));
  } catch {
    return [];
  }
}

export function saveSuppliers(suppliers: Supplier[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(suppliers));
  } catch (e) {
    console.error('Failed to save suppliers', e);
  }
}

export function loadSupplierTransactions(): SupplierTransaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SUPPLIER_TX);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSupplierTransactions(transactions: SupplierTransaction[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SUPPLIER_TX, JSON.stringify(transactions));
  } catch (e) {
    console.error('Failed to save supplier transactions', e);
  }
}

export function loadCustomers(): Customer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    if (!raw) return [];
    const parsed: Customer[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((c) => ({
      ...c,
      creditBalance: typeof c.creditBalance === 'number' && isFinite(c.creditBalance) ? Math.max(0, Math.round(c.creditBalance * 100) / 100) : 0,
      totalSpent: typeof c.totalSpent === 'number' && isFinite(c.totalSpent) ? Math.max(0, Math.round(c.totalSpent * 100) / 100) : 0,
    }));
  } catch {
    return [];
  }
}

export function saveCustomers(customers: Customer[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  } catch (e) {
    console.error('Failed to save customers', e);
  }
}

export function loadShopSettings(): ShopSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return INITIAL_SHOP_SETTINGS;
    const parsed = JSON.parse(raw);
    const merged: ShopSettings = {
      ...INITIAL_SHOP_SETTINGS,
      ...parsed,
    };
    if (
      !merged.shopName ||
      merged.shopName === 'ElectroFlow' ||
      merged.shopName === 'ElectroFlow Electricals' ||
      merged.shopName === 'Sri Senthur Velan' ||
      merged.shopName.trim().toLowerCase() === 'sri senthur velan' ||
      !merged.shopName.toLowerCase().includes('pipes')
    ) {
      merged.shopName = 'Sri Senthur Velan Electricals and Pipes';
      merged.tagline = 'Your trusted electrical partner';
      try {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
      } catch {
        // ignore
      }
    }
    if (!merged.tagline || merged.tagline === 'Electricals, Pipes & Hardware Retail') {
      merged.tagline = 'Your trusted electrical partner';
    }

    // Default printer: ink
    const inkMigrated = localStorage.getItem('srisenthur_default_printer_ink_v1');
    if (!inkMigrated) {
      merged.defaultPrinterType = 'ink';
      try {
        localStorage.setItem('srisenthur_default_printer_ink_v1', 'true');
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
      } catch {
        // ignore
      }
    } else if ((merged.defaultPrinterType as string) === 'laser' || !merged.defaultPrinterType) {
      merged.defaultPrinterType = 'ink';
      try {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
      } catch {
        // ignore
      }
    }

    // Default cash memo (defaultGstOn: false)
    const cashMemoMigrated = localStorage.getItem('srisenthur_default_cash_memo_v1');
    if (!cashMemoMigrated) {
      merged.defaultGstOn = false;
      try {
        localStorage.setItem('srisenthur_default_cash_memo_v1', 'true');
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
      } catch {
        // ignore
      }
    }
    if (merged.upiId !== undefined) {
      delete merged.upiId;
      try {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
      } catch {
        // ignore
      }
    }
    if (merged.email === 'ivar.chandru@gmail.com') {
      merged.email = '';
      try {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
      } catch {
        // ignore
      }
    }
    return merged;
  } catch {
    return INITIAL_SHOP_SETTINGS;
  }
}

export function saveShopSettings(settings: ShopSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings', e);
  }
}

export function loadStockTransactions(): StockTransaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STOCK_TX);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStockTransactions(txs: StockTransaction[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.STOCK_TX, JSON.stringify(txs));
  } catch (e) {
    console.error('Failed to save stock transactions', e);
  }
}

export function loadDraftBilling(): DraftBillingState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DRAFT_BILL);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveDraftBilling(draft: DraftBillingState): void {
  try {
    localStorage.setItem(STORAGE_KEYS.DRAFT_BILL, JSON.stringify(draft));
  } catch (e) {
    console.error('Failed to save draft billing', e);
  }
}

export function clearDraftBilling(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.DRAFT_BILL);
  } catch (e) {
    console.error('Failed to clear draft billing', e);
  }
}

export function loadHeldInvoices(): HeldInvoice[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HELD_BILLS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveHeldInvoices(held: HeldInvoice[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.HELD_BILLS, JSON.stringify(held));
  } catch (e) {
    console.error('Failed to save held invoices', e);
  }
}

export function loadCategories(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    let cats: string[] = raw ? JSON.parse(raw) : [...DEFAULT_PRODUCT_CATEGORIES];
    const products = loadProducts();
    products.forEach((p) => {
      if (p.category && !cats.some((c) => c.trim().toLowerCase() === p.category.trim().toLowerCase())) {
        cats.push(p.category.trim());
      }
    });
    const unique = Array.from(new Set(cats.map((c) => c.trim()).filter(Boolean)));
    return unique.length > 0 ? unique : [...DEFAULT_PRODUCT_CATEGORIES];
  } catch {
    return [...DEFAULT_PRODUCT_CATEGORIES];
  }
}

export function saveCategories(categories: string[]): void {
  try {
    const cleaned = Array.from(new Set(categories.map((c) => c.trim()).filter(Boolean)));
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(cleaned));
  } catch (e) {
    console.error('Failed to save categories', e);
  }
}

export function loadRecentBillingProductIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECENT_PRODUCTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRecentBillingProductIds(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.RECENT_PRODUCTS, JSON.stringify(ids.slice(0, 20)));
  } catch (e) {
    console.error('Failed to save recent billing products', e);
  }
}

/**
 * Resets the entire store to a pristine, clean empty state (Zero mock data).
 */
export function clearAllStoreData(): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.SUPPLIER_TX, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.STOCK_TX, JSON.stringify([]));
    localStorage.removeItem(STORAGE_KEYS.DRAFT_BILL);
    localStorage.setItem(STORAGE_KEYS.HELD_BILLS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.RECENT_PRODUCTS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_PRODUCT_CATEGORIES));
    localStorage.setItem(CLEAN_DATA_FLAG_KEY, 'true');
  } catch (e) {
    console.error('Failed to clear store data', e);
  }
}

export const resetToDemoData = clearAllStoreData;
