import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Product, Invoice, Customer, Supplier, StockTransaction, ShopSettings } from '../types';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  autoSync: boolean;
  isConfigured: boolean;
  lastSynced?: string;
}

const STORAGE_KEY_SUPABASE = 'srisenthur_supabase_config_v1';

// Read config from localStorage or Vite environment variables
export function getSupabaseConfig(): SupabaseConfig {
  // 1. Check environment variables first (production environment setup)
  const metaEnv = (import.meta as any).env || {};
  const envUrl = (metaEnv.VITE_SUPABASE_URL || '').trim();
  const envKey = (metaEnv.VITE_SUPABASE_ANON_KEY || '').trim();

  if (envUrl && envKey) {
    return {
      url: envUrl,
      anonKey: envKey,
      autoSync: true,
      isConfigured: true,
    };
  }

  // 2. Check localStorage fallback
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SUPABASE);
    if (raw) {
      const parsed = JSON.parse(raw);
      const url = (parsed.url || '').trim();
      const anonKey = (parsed.anonKey || '').trim();
      if (url && anonKey) {
        return {
          url,
          anonKey,
          autoSync: parsed.autoSync !== false,
          isConfigured: true,
          lastSynced: parsed.lastSynced,
        };
      }
    }
  } catch {
    // fallback
  }

  return {
    url: '',
    anonKey: '',
    autoSync: true,
    isConfigured: false,
  };
}

export function saveSupabaseConfig(config: {
  url: string;
  anonKey: string;
  autoSync?: boolean;
  lastSynced?: string;
}): void {
  try {
    const existing = getSupabaseConfig();
    const updated = {
      url: config.url.trim(),
      anonKey: config.anonKey.trim(),
      autoSync: config.autoSync !== undefined ? config.autoSync : existing.autoSync,
      lastSynced: config.lastSynced !== undefined ? config.lastSynced : existing.lastSynced,
    };
    localStorage.setItem(STORAGE_KEY_SUPABASE, JSON.stringify(updated));
    // Reset client cache so new credentials take effect
    cachedClient = null;
  } catch (err) {
    console.error('Failed to save Supabase config', err);
  }
}

export function clearSupabaseConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_SUPABASE);
    cachedClient = null;
  } catch (err) {
    console.error('Failed to clear Supabase config', err);
  }
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return null;

  if (cachedClient) return cachedClient;

  try {
    cachedClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

// Test connection
export async function testSupabaseConnection(
  urlInput?: string,
  keyInput?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const config = getSupabaseConfig();
    const targetUrl = (urlInput || config.url || '').trim();
    const targetKey = (keyInput || config.anonKey || '').trim();

    if (!targetUrl || !targetKey) {
      return { success: false, message: 'Please provide both Supabase Project URL and Anon Public Key.' };
    }

    if (!targetUrl.startsWith('https://')) {
      return { success: false, message: 'Project URL must start with https:// (e.g. https://xyz.supabase.co)' };
    }

    const testClient = createClient(targetUrl, targetKey, {
      auth: { persistSession: false },
    });

    // Attempt a light ping by querying products
    const { error } = await testClient.from('products').select('count', { count: 'exact', head: true });
    
    if (error) {
      // If table doesn't exist yet, connection is still valid (Postgres returned 404 or relation does not exist)
      if (
        error.code === '42P01' ||
        error.message?.includes('does not exist') ||
        error.message?.includes('relation "public.products" does not exist')
      ) {
        return {
          success: true,
          message: 'Connected to Supabase successfully! (Tables not created yet — please run the SQL Schema script below in your Supabase SQL Editor).',
        };
      }
      return { success: false, message: `Supabase Error (${error.code || 'API'}): ${error.message}` };
    }

    return { success: true, message: 'Connected to Supabase successfully and verified database tables!' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to connect to Supabase.' };
  }
}

// SQL Schema for the user to execute in Supabase SQL editor
export const SUPABASE_SQL_SCHEMA = `-- ========================================================
-- SRI SENTHUR VELAN ELECTRICALS & PIPES
-- SUPABASE POSTGRESQL DATABASE SCHEMA
-- Run this in your Supabase Dashboard -> SQL Editor -> Run
-- ========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
  product_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  sku_code TEXT,
  hsn_code TEXT,
  selling_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  purchase_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  gst_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  stock_qty NUMERIC(12,3) NOT NULL DEFAULT 0.000,
  minimum_stock NUMERIC(12,3) NOT NULL DEFAULT 10.000,
  unit TEXT NOT NULL DEFAULT 'pcs',
  supplier_id TEXT,
  supplier_name TEXT,
  active_status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. INVOICES TABLE
CREATE TABLE IF NOT EXISTS public.invoices (
  invoice_id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  date_time TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_id TEXT,
  customer_address TEXT,
  customer_gstin TEXT,
  customer_category TEXT DEFAULT 'walk-in',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  discount_percent NUMERIC(5,2) DEFAULT 0.00,
  discount_type TEXT DEFAULT 'amount',
  gst_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  cgst_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  sgst_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  grand_total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  gst_applied BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'completed',
  credit_paid BOOLEAN DEFAULT false,
  credit_paid_date TEXT,
  payment_due_date TEXT,
  created_by TEXT DEFAULT 'admin',
  printer_type TEXT DEFAULT 'ink',
  template_type TEXT DEFAULT 'a4',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS public.customers (
  customer_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  site_address TEXT,
  gstin TEXT,
  customer_type TEXT NOT NULL DEFAULT 'walk-in',
  credit_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total_spent NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  last_purchase_date TEXT,
  expected_payment_date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. SUPPLIERS TABLE
CREATE TABLE IF NOT EXISTS public.suppliers (
  supplier_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  gstin TEXT,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  active_status BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. STOCK TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.stock_transactions (
  transaction_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  type TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL,
  previous_stock NUMERIC(12,3) NOT NULL,
  new_stock NUMERIC(12,3) NOT NULL,
  reason TEXT,
  supplier_id TEXT,
  supplier_name TEXT,
  reference_id TEXT,
  notes TEXT,
  date_time TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. SHOP SETTINGS TABLE (Single row configuration)
CREATE TABLE IF NOT EXISTS public.shop_settings (
  id TEXT PRIMARY KEY DEFAULT 'current',
  settings JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security (RLS) & open public access for Anon Key
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;

-- Allow anon read/write policies for POS application
DROP POLICY IF EXISTS "Public access for products" ON public.products;
CREATE POLICY "Public access for products" ON public.products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for invoices" ON public.invoices;
CREATE POLICY "Public access for invoices" ON public.invoices FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for customers" ON public.customers;
CREATE POLICY "Public access for customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for suppliers" ON public.suppliers;
CREATE POLICY "Public access for suppliers" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for stock_transactions" ON public.stock_transactions;
CREATE POLICY "Public access for stock_transactions" ON public.stock_transactions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for shop_settings" ON public.shop_settings;
CREATE POLICY "Public access for shop_settings" ON public.shop_settings FOR ALL USING (true) WITH CHECK (true);
`;

// Helper: Push all local store data into Supabase
export async function pushAllLocalDataToSupabase(data: {
  products: Product[];
  invoices: Invoice[];
  customers: Customer[];
  suppliers: Supplier[];
  stockTransactions: StockTransaction[];
  settings: ShopSettings;
}): Promise<{ success: boolean; count: number; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, count: 0, error: 'Supabase is not configured or client initialization failed.' };
  }

  try {
    let syncedCount = 0;

    // 1. Products
    if (data.products.length > 0) {
      const formattedProducts = data.products.map((p) => ({
        product_id: p.productId,
        name: p.name,
        category: p.category,
        sku_code: p.skuCode || null,
        hsn_code: p.hsnCode || null,
        selling_price: p.sellingPrice,
        purchase_price: p.purchasePrice,
        gst_rate: p.gstRate,
        stock_qty: p.stockQty,
        minimum_stock: p.minimumStock,
        unit: p.unit,
        supplier_id: p.supplierId || null,
        supplier_name: p.supplierName || null,
        active_status: p.activeStatus !== false,
      }));

      const { error: prodErr } = await client
        .from('products')
        .upsert(formattedProducts, { onConflict: 'product_id' });
      if (prodErr) throw new Error(`Products sync failed: ${prodErr.message}`);
      syncedCount += formattedProducts.length;
    }

    // 2. Customers
    if (data.customers.length > 0) {
      const formattedCustomers = data.customers.map((c) => ({
        customer_id: c.customerId,
        name: c.name,
        phone: c.phone,
        email: c.email || null,
        address: c.address || null,
        site_address: c.siteAddress || null,
        gstin: c.gstin || null,
        customer_type: c.customerType || 'walk-in',
        credit_balance: c.creditBalance || 0,
        total_spent: c.totalSpent || 0,
        last_purchase_date: c.lastPurchaseDate || null,
        expected_payment_date: c.expectedPaymentDate || null,
      }));

      const { error: custErr } = await client
        .from('customers')
        .upsert(formattedCustomers, { onConflict: 'customer_id' });
      if (custErr) throw new Error(`Customers sync failed: ${custErr.message}`);
      syncedCount += formattedCustomers.length;
    }

    // 3. Suppliers
    if (data.suppliers.length > 0) {
      const formattedSuppliers = data.suppliers.map((s) => ({
        supplier_id: s.supplierId,
        name: s.name,
        company_name: s.companyName,
        phone: s.phone,
        email: s.email || null,
        address: s.address || null,
        gstin: s.gstin || null,
        balance: s.balance || 0,
        active_status: s.activeStatus !== false,
        notes: s.notes || null,
      }));

      const { error: supErr } = await client
        .from('suppliers')
        .upsert(formattedSuppliers, { onConflict: 'supplier_id' });
      if (supErr) throw new Error(`Suppliers sync failed: ${supErr.message}`);
      syncedCount += formattedSuppliers.length;
    }

    // 4. Invoices
    if (data.invoices.length > 0) {
      const formattedInvoices = data.invoices.map((inv) => ({
        invoice_id: inv.invoiceId,
        invoice_number: inv.invoiceNumber,
        date_time: inv.dateTime,
        customer_name: inv.customerName || null,
        customer_phone: inv.customerPhone || null,
        customer_id: inv.customerId || null,
        customer_address: inv.customerAddress || null,
        customer_gstin: inv.customerGstin || null,
        customer_category: inv.customerCategory || 'walk-in',
        subtotal: inv.subtotal,
        discount_amount: inv.discountAmount || 0,
        discount_percent: inv.discountPercent || 0,
        discount_type: inv.discountType || 'amount',
        gst_amount: inv.gstAmount,
        cgst_amount: inv.cgstAmount || 0,
        sgst_amount: inv.sgstAmount || 0,
        grand_total: inv.grandTotal,
        payment_method: inv.paymentMethod,
        items: inv.items,
        gst_applied: inv.gstApplied,
        status: inv.status,
        credit_paid: inv.creditPaid || false,
        credit_paid_date: inv.creditPaidDate || null,
        payment_due_date: inv.paymentDueDate || null,
        created_by: inv.createdBy || 'admin',
        printer_type: inv.printerType || 'ink',
        template_type: inv.templateType || 'a4',
        notes: inv.notes || null,
      }));

      const { error: invErr } = await client
        .from('invoices')
        .upsert(formattedInvoices, { onConflict: 'invoice_id' });
      if (invErr) throw new Error(`Invoices sync failed: ${invErr.message}`);
      syncedCount += formattedInvoices.length;
    }

    // 5. Stock Transactions
    if (data.stockTransactions.length > 0) {
      const formattedStock = data.stockTransactions.map((st) => ({
        transaction_id: st.transactionId,
        product_id: st.productId,
        product_name: st.productName,
        type: st.type,
        quantity: st.quantity,
        previous_stock: st.previousStock,
        new_stock: st.newStock,
        reason: st.reason || null,
        supplier_id: st.supplierId || null,
        supplier_name: st.supplierName || null,
        reference_id: st.referenceId || null,
        notes: st.notes || null,
        date_time: st.dateTime,
      }));

      const { error: stockErr } = await client
        .from('stock_transactions')
        .upsert(formattedStock, { onConflict: 'transaction_id' });
      if (stockErr) throw new Error(`Stock transactions sync failed: ${stockErr.message}`);
      syncedCount += formattedStock.length;
    }

    // 6. Shop Settings
    const { error: setErr } = await client.from('shop_settings').upsert({
      id: 'current',
      settings: data.settings,
      updated_at: new Date().toISOString(),
    });
    if (setErr) throw new Error(`Settings sync failed: ${setErr.message}`);

    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    saveSupabaseConfig({
      url: getSupabaseConfig().url,
      anonKey: getSupabaseConfig().anonKey,
      lastSynced: nowStr,
    });

    return { success: true, count: syncedCount };
  } catch (err: any) {
    return { success: false, count: 0, error: err?.message || 'Supabase sync failed' };
  }
}

// Helper: Pull data from Supabase into memory
export async function pullDataFromSupabase(): Promise<{
  success: boolean;
  data?: {
    products: Product[];
    invoices: Invoice[];
    customers: Customer[];
    suppliers: Supplier[];
    stockTransactions: StockTransaction[];
    settings?: ShopSettings;
  };
  error?: string;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase is not configured' };
  }

  try {
    const [prodRes, invRes, custRes, supRes, stockRes, setRes] = await Promise.all([
      client.from('products').select('*').order('created_at', { ascending: true }),
      client.from('invoices').select('*').order('created_at', { ascending: false }),
      client.from('customers').select('*').order('created_at', { ascending: true }),
      client.from('suppliers').select('*').order('created_at', { ascending: true }),
      client.from('stock_transactions').select('*').order('created_at', { ascending: false }).limit(200),
      client.from('shop_settings').select('*').eq('id', 'current').maybeSingle(),
    ]);

    if (prodRes.error) throw new Error(`Fetch products failed: ${prodRes.error.message}`);
    if (invRes.error) throw new Error(`Fetch invoices failed: ${invRes.error.message}`);
    if (custRes.error) throw new Error(`Fetch customers failed: ${custRes.error.message}`);
    if (supRes.error) throw new Error(`Fetch suppliers failed: ${supRes.error.message}`);

    const products: Product[] = (prodRes.data || []).map((p: any) => ({
      productId: p.product_id,
      name: p.name,
      category: p.category,
      skuCode: p.sku_code || undefined,
      hsnCode: p.hsn_code || undefined,
      sellingPrice: Number(p.selling_price) || 0,
      purchasePrice: Number(p.purchase_price) || 0,
      gstRate: Number(p.gst_rate) || 0,
      stockQty: Number(p.stock_qty) || 0,
      minimumStock: Number(p.minimum_stock) || 10,
      unit: p.unit || 'pcs',
      supplierId: p.supplier_id || undefined,
      supplierName: p.supplier_name || undefined,
      activeStatus: p.active_status !== false,
    }));

    const invoices: Invoice[] = (invRes.data || []).map((inv: any) => ({
      invoiceId: inv.invoice_id,
      invoiceNumber: inv.invoice_number,
      dateTime: inv.date_time,
      customerName: inv.customer_name || undefined,
      customerPhone: inv.customer_phone || undefined,
      customerId: inv.customer_id || undefined,
      customerAddress: inv.customer_address || undefined,
      customerGstin: inv.customer_gstin || undefined,
      customerCategory: inv.customer_category || 'walk-in',
      subtotal: Number(inv.subtotal) || 0,
      discountAmount: Number(inv.discount_amount) || 0,
      discountPercent: Number(inv.discount_percent) || 0,
      discountType: inv.discount_type || 'amount',
      gstAmount: Number(inv.gst_amount) || 0,
      cgstAmount: Number(inv.cgst_amount) || 0,
      sgstAmount: Number(inv.sgst_amount) || 0,
      grandTotal: Number(inv.grand_total) || 0,
      paymentMethod: inv.payment_method,
      items: inv.items || [],
      gstApplied: Boolean(inv.gst_applied),
      status: inv.status || 'completed',
      creditPaid: Boolean(inv.credit_paid),
      creditPaidDate: inv.credit_paid_date || undefined,
      paymentDueDate: inv.payment_due_date || undefined,
      createdBy: inv.created_by || 'admin',
      printerType: inv.printer_type || 'ink',
      templateType: inv.template_type || 'a4',
      notes: inv.notes || undefined,
    }));

    const customers: Customer[] = (custRes.data || []).map((c: any) => ({
      customerId: c.customer_id,
      name: c.name,
      phone: c.phone,
      email: c.email || undefined,
      address: c.address || undefined,
      siteAddress: c.site_address || undefined,
      gstin: c.gstin || undefined,
      customerType: c.customer_type || 'walk-in',
      creditBalance: Number(c.credit_balance) || 0,
      totalSpent: Number(c.total_spent) || 0,
      lastPurchaseDate: c.last_purchase_date || undefined,
      expectedPaymentDate: c.expected_payment_date || undefined,
    }));

    const suppliers: Supplier[] = (supRes.data || []).map((s: any) => ({
      supplierId: s.supplier_id,
      name: s.name || s.company_name,
      companyName: s.company_name,
      phone: s.phone,
      email: s.email || undefined,
      address: s.address || undefined,
      gstin: s.gstin || undefined,
      balance: Number(s.balance) || 0,
      activeStatus: s.active_status !== false,
      notes: s.notes || undefined,
    }));

    const stockTransactions: StockTransaction[] = (stockRes.data || []).map((st: any) => ({
      transactionId: st.transaction_id,
      productId: st.product_id,
      productName: st.product_name,
      type: st.type,
      quantity: Number(st.quantity) || 0,
      previousStock: Number(st.previous_stock) || 0,
      newStock: Number(st.new_stock) || 0,
      reason: st.reason || undefined,
      supplierId: st.supplier_id || undefined,
      supplierName: st.supplier_name || undefined,
      referenceId: st.reference_id || undefined,
      notes: st.notes || undefined,
      dateTime: st.date_time,
    }));

    let settings: ShopSettings | undefined = undefined;
    if (setRes.data && setRes.data.settings) {
      settings = setRes.data.settings;
    }

    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    saveSupabaseConfig({
      url: getSupabaseConfig().url,
      anonKey: getSupabaseConfig().anonKey,
      lastSynced: nowStr,
    });

    return {
      success: true,
      data: {
        products,
        invoices,
        customers,
        suppliers,
        stockTransactions,
        settings,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to pull Supabase data' };
  }
}

// Real-time Single Record Sync helpers (background, silent fallback)
export async function syncSingleInvoiceToSupabase(inv: Invoice): Promise<void> {
  const config = getSupabaseConfig();
  if (!config.isConfigured || !config.autoSync) return;
  const client = getSupabaseClient();
  if (!client) return;

  try {
    await client.from('invoices').upsert({
      invoice_id: inv.invoiceId,
      invoice_number: inv.invoiceNumber,
      date_time: inv.dateTime,
      customer_name: inv.customerName || null,
      customer_phone: inv.customerPhone || null,
      customer_id: inv.customerId || null,
      customer_address: inv.customerAddress || null,
      customer_gstin: inv.customerGstin || null,
      customer_category: inv.customerCategory || 'walk-in',
      subtotal: inv.subtotal,
      discount_amount: inv.discountAmount || 0,
      discount_percent: inv.discountPercent || 0,
      discount_type: inv.discountType || 'amount',
      gst_amount: inv.gstAmount,
      cgst_amount: inv.cgstAmount || 0,
      sgst_amount: inv.sgstAmount || 0,
      grand_total: inv.grandTotal,
      payment_method: inv.paymentMethod,
      items: inv.items,
      gst_applied: inv.gstApplied,
      status: inv.status,
      credit_paid: inv.creditPaid || false,
      credit_paid_date: inv.creditPaidDate || null,
      payment_due_date: inv.paymentDueDate || null,
      created_by: inv.createdBy || 'admin',
      printer_type: inv.printerType || 'ink',
      template_type: inv.templateType || 'a4',
      notes: inv.notes || null,
    });
  } catch (err) {
    console.warn('Real-time Supabase invoice sync error:', err);
  }
}

export async function syncSingleProductToSupabase(p: Product): Promise<void> {
  const config = getSupabaseConfig();
  if (!config.isConfigured || !config.autoSync) return;
  const client = getSupabaseClient();
  if (!client) return;

  try {
    await client.from('products').upsert({
      product_id: p.productId,
      name: p.name,
      category: p.category,
      sku_code: p.skuCode || null,
      hsn_code: p.hsnCode || null,
      selling_price: p.sellingPrice,
      purchase_price: p.purchasePrice,
      gst_rate: p.gstRate,
      stock_qty: p.stockQty,
      minimum_stock: p.minimumStock,
      unit: p.unit,
      supplier_id: p.supplierId || null,
      supplier_name: p.supplierName || null,
      active_status: p.activeStatus !== false,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Real-time Supabase product sync error:', err);
  }
}

export async function deleteSingleProductFromSupabase(productId: string): Promise<void> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return;
  const client = getSupabaseClient();
  if (!client) return;

  try {
    await client.from('products').delete().eq('product_id', productId);
  } catch (err) {
    console.warn('Real-time Supabase product delete error:', err);
  }
}

export async function deleteSingleInvoiceFromSupabase(invoiceId: string): Promise<void> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return;
  const client = getSupabaseClient();
  if (!client) return;

  try {
    await client.from('invoices').delete().eq('invoice_id', invoiceId);
  } catch (err) {
    console.warn('Real-time Supabase invoice delete error:', err);
  }
}

export async function syncSingleCustomerToSupabase(c: Customer): Promise<void> {
  const config = getSupabaseConfig();
  if (!config.isConfigured || !config.autoSync) return;
  const client = getSupabaseClient();
  if (!client) return;

  try {
    await client.from('customers').upsert({
      customer_id: c.customerId,
      name: c.name,
      phone: c.phone,
      email: c.email || null,
      address: c.address || null,
      site_address: c.siteAddress || null,
      gstin: c.gstin || null,
      customer_type: c.customerType || 'walk-in',
      credit_balance: c.creditBalance || 0,
      total_spent: c.totalSpent || 0,
      last_purchase_date: c.lastPurchaseDate || null,
      expected_payment_date: c.expectedPaymentDate || null,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Real-time Supabase customer sync error:', err);
  }
}

export async function syncSingleSupplierToSupabase(s: Supplier): Promise<void> {
  const config = getSupabaseConfig();
  if (!config.isConfigured || !config.autoSync) return;
  const client = getSupabaseClient();
  if (!client) return;

  try {
    await client.from('suppliers').upsert({
      supplier_id: s.supplierId,
      name: s.name,
      company_name: s.companyName,
      phone: s.phone,
      email: s.email || null,
      address: s.address || null,
      gstin: s.gstin || null,
      balance: s.balance || 0,
      active_status: s.activeStatus !== false,
      notes: s.notes || null,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Real-time Supabase supplier sync error:', err);
  }
}
