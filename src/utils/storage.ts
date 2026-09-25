import { Product, Supplier, SupplierTransaction, Invoice, ShopSettings, StockTransaction, Customer, DraftBillingState, HeldInvoice } from '../types';
import {
  INITIAL_PRODUCTS,
  INITIAL_SUPPLIERS,
  INITIAL_SUPPLIER_TRANSACTIONS,
  INITIAL_INVOICES,
  INITIAL_SHOP_SETTINGS,
  INITIAL_STOCK_TRANSACTIONS,
  INITIAL_CUSTOMERS,
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

export const DEFAULT_PRODUCT_CATEGORIES = [
  'Switches & Sockets',
  'Wires & Cables',
  'LED & Lighting',
  'MCB & Switchgear',
  'Pipes & Conduits',
  'Fans & Fixtures',
  'Accessories & Tools',
];

export function loadProducts(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    return raw ? JSON.parse(raw) : INITIAL_PRODUCTS;
  } catch {
    return INITIAL_PRODUCTS;
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
    if (!raw) return INITIAL_INVOICES;
    const parsed: any[] = JSON.parse(raw);
    const normalized = parsed.map((inv) => ({
      ...inv,
      printerType: inv.printerType === 'laser' ? 'ink' : (inv.printerType || 'ink'),
    }));
    // Ensure multi-page sample invoice inv-1005 is included for instant testing
    const hasInv1005 = normalized.some((inv) => inv.invoiceId === 'inv-1005');
    if (!hasInv1005) {
      const sample = INITIAL_INVOICES.find((i) => i.invoiceId === 'inv-1005');
      if (sample) {
        normalized.unshift(sample);
        try {
          localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(normalized));
        } catch {}
      }
    }
    return normalized;
  } catch {
    return INITIAL_INVOICES;
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
    if (!raw) return INITIAL_SUPPLIERS;
    const parsed: Supplier[] = JSON.parse(raw);
    return parsed.map((s) => {
      const initialMatch = INITIAL_SUPPLIERS.find((init) => init.supplierId === s.supplierId);
      return {
        ...s,
        balance: typeof s.balance === 'number' ? s.balance : (initialMatch?.balance ?? 0),
      };
    });
  } catch {
    return INITIAL_SUPPLIERS;
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
    return raw ? JSON.parse(raw) : INITIAL_SUPPLIER_TRANSACTIONS;
  } catch {
    return INITIAL_SUPPLIER_TRANSACTIONS;
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
    return raw ? JSON.parse(raw) : INITIAL_CUSTOMERS;
  } catch {
    return INITIAL_CUSTOMERS;
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
    // Default should be ink printer. Migrate old default from previous sessions:
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

    // Default should be Cash Memo (defaultGstOn: false). Migrate old default:
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
    return raw ? JSON.parse(raw) : INITIAL_STOCK_TRANSACTIONS;
  } catch {
    return INITIAL_STOCK_TRANSACTIONS;
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
    // Also include any categories present on existing products
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

export function resetToDemoData(): void {
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
  localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(INITIAL_INVOICES));
  localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(INITIAL_SUPPLIERS));
  localStorage.setItem(STORAGE_KEYS.SUPPLIER_TX, JSON.stringify(INITIAL_SUPPLIER_TRANSACTIONS));
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(INITIAL_SHOP_SETTINGS));
  localStorage.setItem(STORAGE_KEYS.STOCK_TX, JSON.stringify(INITIAL_STOCK_TRANSACTIONS));
  localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_PRODUCT_CATEGORIES));
  localStorage.removeItem(STORAGE_KEYS.DRAFT_BILL);
}
