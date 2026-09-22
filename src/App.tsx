import React, { useState, useEffect } from 'react';
import {
  ActiveTab,
  Product,
  Invoice,
  Supplier,
  SupplierTransaction,
  Customer,
  ShopSettings,
  StockTransaction,
  AuthSession,
} from './types';
import {
  loadProducts,
  saveProducts,
  loadInvoices,
  saveInvoices,
  loadSuppliers,
  saveSuppliers,
  loadSupplierTransactions,
  saveSupplierTransactions,
  loadCustomers,
  saveCustomers,
  loadShopSettings,
  saveShopSettings,
  loadStockTransactions,
  saveStockTransactions,
  resetToDemoData,
  loadDraftBilling,
  loadCategories,
  saveCategories,
  DEFAULT_PRODUCT_CATEGORIES,
} from './utils/storage';
import { getCurrentDateTimeFormatted, generateInvoiceNumber } from './utils/formatters';
import { getActiveAuthSession, clearAuthSession } from './utils/auth';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { BillingScreen } from './components/BillingScreen';
import { InvoicesHistory } from './components/InvoicesHistory';
import { StockInventory } from './components/StockInventory';
import { CustomersView } from './components/CustomersView';
import { SuppliersView } from './components/SuppliersView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { BillPrintModal } from './components/BillPrintModal';
import { AdminLoginScreen } from './components/AdminLoginScreen';

export default function App() {
  // Authentication State
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => getActiveAuthSession());

  // Navigation - default to Dashboard matching store overview
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  // Application Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierTransactions, setSupplierTransactions] = useState<SupplierTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<ShopSettings>(loadShopSettings());
  const [stockTransactions, setStockTransactions] = useState<StockTransaction[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [draftCartCount, setDraftCartCount] = useState<number>(() => loadDraftBilling()?.cartItems?.length || 0);

  // Print Modal State
  const [printModalInvoice, setPrintModalInvoice] = useState<Invoice | null>(null);

  // Initialize data on mount
  useEffect(() => {
    setProducts(loadProducts());
    setInvoices(loadInvoices());
    setSuppliers(loadSuppliers());
    setSupplierTransactions(loadSupplierTransactions());
    setCustomers(loadCustomers());
    setSettings(loadShopSettings());
    setStockTransactions(loadStockTransactions());
    setCategories(loadCategories());
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setActiveTab('dashboard');
      } else if (e.key === 'F2') {
        e.preventDefault();
        setActiveTab('billing');
      } else if (e.key === 'F3') {
        e.preventDefault();
        setActiveTab('inventory');
      } else if (e.key === 'F4') {
        e.preventDefault();
        setActiveTab('customers');
      } else if (e.key === 'F5' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setActiveTab('suppliers');
      } else if (e.key === 'F6') {
        e.preventDefault();
        setActiveTab('invoices');
      } else if (e.key === 'F7') {
        e.preventDefault();
        setActiveTab('reports');
      } else if (e.key === 'F8') {
        e.preventDefault();
        setActiveTab('settings');
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  // Low stock counter
  const lowStockCount = products.filter((p) => p.stockQty <= p.minimumStock).length;

  // Save new or updated invoice
  const handleSaveInvoice = (newInvoice: Invoice) => {
    const existingIndex = invoices.findIndex((inv) => inv.invoiceId === newInvoice.invoiceId);
    const isUpdate = existingIndex >= 0;
    const oldInvoice = isUpdate ? invoices[existingIndex] : null;

    // 1. Update invoices list
    const updatedInvoices = isUpdate
      ? invoices.map((inv, idx) => (idx === existingIndex ? newInvoice : inv))
      : [newInvoice, ...invoices];
    setInvoices(updatedInvoices);
    saveInvoices(updatedInvoices);

    // 2. Deduct stock for items sold (or adjust delta if updating existing bill)
    const updatedProducts = products.map((prod) => {
      const newSoldItem = newInvoice.items.find((item) => item.productId === prod.productId);
      const oldSoldItem = oldInvoice?.items.find((item) => item.productId === prod.productId);
      const newQty = newSoldItem ? newSoldItem.quantity : 0;
      const oldQty = oldSoldItem ? oldSoldItem.quantity : 0;
      const delta = newQty - oldQty;

      if (delta !== 0) {
        return {
          ...prod,
          stockQty: Math.max(0, prod.stockQty - delta),
        };
      }
      return prod;
    });
    setProducts(updatedProducts);
    saveProducts(updatedProducts);

    // 3. Store or update customer in Customer section
    if (
      newInvoice.customerName &&
      newInvoice.customerName.trim() &&
      newInvoice.customerName !== 'Walk-in Customer (General)'
    ) {
      setCustomers((prev) => {
        const trimmedName = newInvoice.customerName!.trim();
        const trimmedPhone = newInvoice.customerPhone?.trim() || '';

        // Find customer by ID, exact phone, or case-insensitive name
        const existingIdx = prev.findIndex(
          (c) =>
            (newInvoice.customerId && c.customerId === newInvoice.customerId) ||
            (trimmedPhone && c.phone && c.phone.replace(/\D/g, '') === trimmedPhone.replace(/\D/g, '')) ||
            c.name.toLowerCase() === trimmedName.toLowerCase()
        );

        const oldGrandTotal = oldInvoice ? oldInvoice.grandTotal : 0;
        const grandTotalDiff = newInvoice.grandTotal - oldGrandTotal;

        let updated: Customer[];
        if (existingIdx >= 0) {
          updated = prev.map((c, idx) => {
            if (idx === existingIdx) {
              const oldCreditContrib =
                oldInvoice && oldInvoice.paymentMethod === 'credit' ? oldInvoice.grandTotal : 0;
              const newCreditContrib =
                newInvoice.paymentMethod === 'credit' ? newInvoice.grandTotal : 0;
              const creditDiff = newCreditContrib - oldCreditContrib;

              return {
                ...c,
                name: trimmedName,
                phone: trimmedPhone || c.phone,
                address: newInvoice.customerAddress || c.address,
                siteAddress: newInvoice.customerAddress || c.siteAddress,
                gstin: newInvoice.customerGstin || c.gstin,
                customerType: (newInvoice.customerCategory as any) || c.customerType || 'walk-in',
                totalSpent: Math.max(0, (c.totalSpent || 0) + grandTotalDiff),
                creditBalance: Math.max(0, (c.creditBalance || 0) + creditDiff),
                lastPurchaseDate: newInvoice.dateTime.split(' ')[0],
                expectedPaymentDate:
                  newInvoice.paymentMethod === 'credit' && newInvoice.paymentDueDate
                    ? newInvoice.paymentDueDate
                    : c.expectedPaymentDate,
              };
            }
            return c;
          });
        } else {
          // New customer record - add to Customer section!
          const newCust: Customer = {
            customerId: newInvoice.customerId || `cust-${Date.now()}`,
            name: trimmedName,
            phone: trimmedPhone,
            address: newInvoice.customerAddress,
            siteAddress: newInvoice.customerAddress,
            gstin: newInvoice.customerGstin,
            customerType: (newInvoice.customerCategory as any) || 'walk-in',
            creditBalance: newInvoice.paymentMethod === 'credit' ? newInvoice.grandTotal : 0,
            totalSpent: newInvoice.grandTotal,
            lastPurchaseDate: newInvoice.dateTime.split(' ')[0],
            expectedPaymentDate:
              newInvoice.paymentMethod === 'credit' ? newInvoice.paymentDueDate : undefined,
          };
          updated = [newCust, ...prev];
        }
        saveCustomers(updated);
        return updated;
      });
    }

    // 4. Record stock transactions
    if (!isUpdate) {
      const newTransactions: StockTransaction[] = newInvoice.items.map((item, idx) => {
        const prod = products.find((p) => p.productId === item.productId);
        const prevStock = prod ? prod.stockQty : 0;
        const nextStock = Math.max(0, prevStock - item.quantity);
        return {
          transactionId: `tx-${Date.now()}-${idx}`,
          productId: item.productId,
          productName: item.productNameSnapshot,
          type: 'sale',
          quantity: item.quantity,
          previousStock: prevStock,
          newStock: nextStock,
          dateTime: getCurrentDateTimeFormatted(),
          referenceId: newInvoice.invoiceNumber,
          notes: `Sold in bill ${newInvoice.invoiceNumber} to ${newInvoice.customerName || 'Walk-in'}`,
        };
      });
      const updatedTxs = [...newTransactions, ...stockTransactions];
      setStockTransactions(updatedTxs);
      saveStockTransactions(updatedTxs);
    } else {
      const deltaTransactions: StockTransaction[] = [];
      newInvoice.items.forEach((newItem, idx) => {
        const oldItem = oldInvoice?.items.find((i) => i.productId === newItem.productId);
        const oldQty = oldItem ? oldItem.quantity : 0;
        const delta = newItem.quantity - oldQty;
        if (delta !== 0) {
          const prod = products.find((p) => p.productId === newItem.productId);
          const prevStock = prod ? prod.stockQty : 0;
          const nextStock = Math.max(0, prevStock - delta);
          deltaTransactions.push({
            transactionId: `tx-${Date.now()}-${idx}`,
            productId: newItem.productId,
            productName: newItem.productNameSnapshot,
            type: delta > 0 ? 'sale' : 'adjustment',
            quantity: Math.abs(delta),
            previousStock: prevStock,
            newStock: nextStock,
            dateTime: getCurrentDateTimeFormatted(),
            referenceId: newInvoice.invoiceNumber,
            notes: delta > 0
              ? `Added to bill ${newInvoice.invoiceNumber} (+${delta} units to ${newInvoice.customerName || 'Walk-in'})`
              : `Adjusted in bill ${newInvoice.invoiceNumber} (${delta} units returned)`,
          });
        }
      });
      // Check for removed items
      oldInvoice?.items.forEach((oldItem, idx) => {
        const stillInNew = newInvoice.items.some((i) => i.productId === oldItem.productId);
        if (!stillInNew) {
          const prod = products.find((p) => p.productId === oldItem.productId);
          const prevStock = prod ? prod.stockQty : 0;
          const nextStock = prevStock + oldItem.quantity;
          deltaTransactions.push({
            transactionId: `tx-${Date.now()}-rem-${idx}`,
            productId: oldItem.productId,
            productName: oldItem.productNameSnapshot,
            type: 'adjustment',
            quantity: oldItem.quantity,
            previousStock: prevStock,
            newStock: nextStock,
            dateTime: getCurrentDateTimeFormatted(),
            referenceId: newInvoice.invoiceNumber,
            notes: `Item removed from bill ${newInvoice.invoiceNumber} (+${oldItem.quantity} restored)`,
          });
        }
      });
      if (deltaTransactions.length > 0) {
        const updatedTxs = [...deltaTransactions, ...stockTransactions];
        setStockTransactions(updatedTxs);
        saveStockTransactions(updatedTxs);
      }
    }
  };

  // Save new or edited product
  const handleSaveProduct = (product: Product) => {
    const exists = products.some((p) => p.productId === product.productId);
    let updated: Product[];
    if (exists) {
      updated = products.map((p) => (p.productId === product.productId ? product : p));
    } else {
      updated = [product, ...products];
    }
    setProducts(updated);
    saveProducts(updated);

    // If product has a custom category not yet in categories list, add it
    if (
      product.category &&
      product.category.trim() &&
      !categories.some((c) => c.toLowerCase() === product.category.trim().toLowerCase())
    ) {
      const updatedCats = [...categories, product.category.trim()];
      setCategories(updatedCats);
      saveCategories(updatedCats);
    }
  };

  // Custom Category management
  const handleAddCategory = (newCat: string) => {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return;
    const updated = [...categories, trimmed];
    setCategories(updated);
    saveCategories(updated);
  };

  const handleRenameCategory = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || oldName.toLowerCase() === trimmed.toLowerCase()) return;
    const updatedCategories = categories.map((c) => (c === oldName ? trimmed : c));
    setCategories(updatedCategories);
    saveCategories(updatedCategories);

    // Update existing products with this category
    const updatedProducts = products.map((p) =>
      p.category === oldName ? { ...p, category: trimmed } : p
    );
    setProducts(updatedProducts);
    saveProducts(updatedProducts);
  };

  const handleDeleteCategory = (catToDelete: string, targetCategory?: string) => {
    const fallback =
      targetCategory ||
      categories.find((c) => c.toLowerCase() !== catToDelete.toLowerCase()) ||
      'Accessories & Tools';
    const updatedCategories = categories.filter(
      (c) => c.toLowerCase() !== catToDelete.toLowerCase()
    );
    setCategories(updatedCategories);
    saveCategories(updatedCategories);

    // Reassign products to fallback category
    const updatedProducts = products.map((p) =>
      p.category.toLowerCase() === catToDelete.toLowerCase()
        ? { ...p, category: fallback }
        : p
    );
    setProducts(updatedProducts);
    saveProducts(updatedProducts);
  };

  // Bulk Import products from CSV
  const handleBulkImportProducts = (
    importedProducts: Product[],
    options: { updateExisting: boolean; stockMode: 'set' | 'add' }
  ) => {
    const currentProducts = [...products];
    const newStockTransactions: StockTransaction[] = [];
    const timestamp = Date.now();

    importedProducts.forEach((imp, idx) => {
      let matchIndex = -1;
      if (options.updateExisting) {
        // Match by SKU first, then by exact name
        if (imp.skuCode) {
          matchIndex = currentProducts.findIndex(
            (p) => p.skuCode && p.skuCode.toLowerCase() === imp.skuCode?.toLowerCase()
          );
        }
        if (matchIndex === -1 && imp.name) {
          matchIndex = currentProducts.findIndex(
            (p) => p.name.toLowerCase() === imp.name.trim().toLowerCase()
          );
        }
      }

      if (matchIndex !== -1) {
        // Update existing item
        const existing = currentProducts[matchIndex];
        const prevStock = existing.stockQty;
        const newStock =
          options.stockMode === 'add' ? prevStock + imp.stockQty : imp.stockQty;

        currentProducts[matchIndex] = {
          ...existing,
          name: imp.name || existing.name,
          category: imp.category || existing.category,
          skuCode: imp.skuCode || existing.skuCode,
          sellingPrice: imp.sellingPrice,
          purchasePrice: imp.purchasePrice,
          gstRate: imp.gstRate,
          stockQty: newStock,
          minimumStock: imp.minimumStock,
          unit: imp.unit,
          supplierId: imp.supplierId || existing.supplierId,
          hsnCode: imp.hsnCode || existing.hsnCode,
        };

        if (newStock !== prevStock) {
          newStockTransactions.push({
            transactionId: `tx-import-${timestamp}-${idx}`,
            productId: existing.productId,
            productName: existing.name,
            type: newStock > prevStock ? 'purchase' : 'adjustment',
            quantity: newStock - prevStock,
            previousStock: prevStock,
            newStock: newStock,
            dateTime: getCurrentDateTimeFormatted(),
            referenceId: 'CSV-IMPORT',
            notes: `CSV Import: Stock updated from ${prevStock} to ${newStock} (${
              options.stockMode === 'add' ? 'replenishment' : 'recount'
            })`,
          });
        }
      } else {
        // Add as new product
        const newProd: Product = {
          ...imp,
          productId: imp.productId || `prod-csv-${timestamp}-${idx}`,
        };
        currentProducts.unshift(newProd);

        if (newProd.stockQty > 0) {
          newStockTransactions.push({
            transactionId: `tx-import-${timestamp}-${idx}`,
            productId: newProd.productId,
            productName: newProd.name,
            type: 'purchase',
            quantity: newProd.stockQty,
            previousStock: 0,
            newStock: newProd.stockQty,
            dateTime: getCurrentDateTimeFormatted(),
            referenceId: 'CSV-IMPORT',
            notes: `Initial opening stock via CSV import (${newProd.stockQty} ${newProd.unit})`,
          });
        }
      }
    });

    setProducts(currentProducts);
    saveProducts(currentProducts);

    if (newStockTransactions.length > 0) {
      const updatedTxs = [...newStockTransactions, ...stockTransactions];
      setStockTransactions(updatedTxs);
      saveStockTransactions(updatedTxs);
    }

    // Capture any newly imported custom categories
    const newCats: string[] = [];
    importedProducts.forEach((imp) => {
      if (
        imp.category &&
        imp.category.trim() &&
        !categories.some((c) => c.toLowerCase() === imp.category.trim().toLowerCase()) &&
        !newCats.some((c) => c.toLowerCase() === imp.category.trim().toLowerCase())
      ) {
        newCats.push(imp.category.trim());
      }
    });
    if (newCats.length > 0) {
      const updatedCats = [...categories, ...newCats];
      setCategories(updatedCats);
      saveCategories(updatedCats);
    }
  };

  // Stock In / Restock / Adjust
  const handleUpdateStock = (
    productId: string,
    quantityChange: number,
    type: 'purchase' | 'adjustment',
    reason?: string,
    supplierId?: string,
    referenceId?: string
  ) => {
    let finalQty = 0;
    let prodName = '';

    const updatedProducts = products.map((p) => {
      if (p.productId === productId) {
        finalQty = Math.max(0, p.stockQty + quantityChange);
        prodName = p.name;
        return {
          ...p,
          stockQty: finalQty,
        };
      }
      return p;
    });

    setProducts(updatedProducts);
    saveProducts(updatedProducts);

    let prevQty = 0;
    const existing = products.find((p) => p.productId === productId);
    if (existing) prevQty = existing.stockQty;

    const newTx: StockTransaction = {
      transactionId: `tx-${Date.now()}`,
      productId,
      productName: prodName,
      type,
      quantity: Math.abs(quantityChange),
      previousStock: prevQty,
      newStock: finalQty,
      dateTime: getCurrentDateTimeFormatted(),
      supplierId,
      referenceId,
      notes: reason,
    };

    const updatedTxs = [newTx, ...stockTransactions];
    setStockTransactions(updatedTxs);
    saveStockTransactions(updatedTxs);
  };

  // Save new or updated supplier
  const handleSaveSupplier = (supplier: Supplier) => {
    const exists = suppliers.some((s) => s.supplierId === supplier.supplierId);
    let updated: Supplier[];
    if (exists) {
      updated = suppliers.map((s) => (s.supplierId === supplier.supplierId ? supplier : s));
    } else {
      updated = [supplier, ...suppliers];
    }
    setSuppliers(updated);
    saveSuppliers(updated);
  };

  // Delete supplier
  const handleDeleteSupplier = (supplierId: string) => {
    const updated = suppliers.filter((s) => s.supplierId !== supplierId);
    setSuppliers(updated);
    saveSuppliers(updated);
  };

  // Record a transaction for a supplier (payment, purchase bill, adjustment)
  const handleSaveSupplierTransaction = (tx: SupplierTransaction, updatedSupplier?: Supplier) => {
    const updatedTxs = [tx, ...supplierTransactions];
    setSupplierTransactions(updatedTxs);
    saveSupplierTransactions(updatedTxs);
    if (updatedSupplier) {
      handleSaveSupplier(updatedSupplier);
    }
  };

  // Save new or edited customer
  const handleSaveCustomer = (customer: Customer) => {
    const exists = customers.some((c) => c.customerId === customer.customerId);
    let updated: Customer[];
    if (exists) {
      updated = customers.map((c) => (c.customerId === customer.customerId ? customer : c));
    } else {
      updated = [customer, ...customers];
    }
    setCustomers(updated);
    saveCustomers(updated);
  };

  // Save settings
  const handleSaveSettings = (newSettings: ShopSettings) => {
    setSettings(newSettings);
    saveShopSettings(newSettings);
  };

  // Mark credit invoice as paid (clears reminder from dashboard)
  const handleMarkCreditPaid = (invoiceId: string) => {
    const targetInv = invoices.find((inv) => inv.invoiceId === invoiceId);
    if (!targetInv) return;

    const paidDate = new Date().toISOString().split('T')[0];
    const updatedInvoices = invoices.map((inv) => {
      if (inv.invoiceId === invoiceId) {
        return {
          ...inv,
          creditPaid: true,
          creditPaidDate: paidDate,
        };
      }
      return inv;
    });

    setInvoices(updatedInvoices);
    saveInvoices(updatedInvoices);

    // Also deduct from customer's credit balance in Customers section
    if (targetInv.customerName) {
      setCustomers((prev) => {
        const updated = prev.map((c) => {
          if (
            (targetInv.customerId && c.customerId === targetInv.customerId) ||
            c.name.toLowerCase() === targetInv.customerName?.toLowerCase()
          ) {
            const newBal = Math.max(0, (c.creditBalance || 0) - targetInv.grandTotal);
            return {
              ...c,
              creditBalance: newBal,
              expectedPaymentDate: newBal === 0 ? undefined : c.expectedPaymentDate,
            };
          }
          return c;
        });
        saveCustomers(updated);
        return updated;
      });
    }
  };

  // Factory reset
  const handleResetData = () => {
    resetToDemoData();
    setProducts(loadProducts());
    setInvoices(loadInvoices());
    setSuppliers(loadSuppliers());
    setSupplierTransactions(loadSupplierTransactions());
    setCustomers(loadCustomers());
    setSettings(loadShopSettings());
    setStockTransactions(loadStockTransactions());
    setCategories(loadCategories());
    setDraftCartCount(0);
  };

  // Sign out handler
  const handleLogout = () => {
    clearAuthSession();
    setAuthSession(null);
  };

  // If not authenticated as Admin, show Admin Authentication Screen
  if (!authSession) {
    return (
      <AdminLoginScreen
        settings={settings}
        onLoginSuccess={(session) => setAuthSession(session)}
      />
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-slate-50 font-sans select-none antialiased">
      {/* Left Vertical Sidebar matching Reference Screenshot */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        settings={settings}
        lowStockCount={lowStockCount}
        draftCartCount={draftCartCount}
        currentUser={authSession}
        onLogout={handleLogout}
      />

      {/* Main Workspace: Top Bar + Content Canvas */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header Bar matching Screenshot with Top-Right Logo */}
        <Header activeTab={activeTab} settings={settings} />

        {/* Dynamic Main Content Container */}
        <main className="flex-1 h-full min-w-0 overflow-hidden relative flex flex-col bg-slate-50/60">
          {activeTab === 'dashboard' && (
            <Dashboard
              invoices={invoices}
              products={products}
              suppliers={suppliers}
              settings={settings}
              setActiveTab={setActiveTab}
              onPrintInvoice={(inv) => setPrintModalInvoice(inv)}
              onOpenStockModal={() => setActiveTab('inventory')}
              onMarkCreditPaid={handleMarkCreditPaid}
            />
          )}

          {/* Persistent Billing Screen: Kept mounted in DOM so navigating to other sections never clears entered cart items */}
          <div className={activeTab === 'billing' ? 'h-full w-full flex flex-col min-w-0' : 'hidden'}>
            <BillingScreen
              products={products}
              invoices={invoices}
              settings={settings}
              customers={customers}
              onSaveInvoice={handleSaveInvoice}
              onPreviewInvoice={(inv) => setPrintModalInvoice(inv)}
              onAddCustomer={handleSaveCustomer}
              onCartCountChange={setDraftCartCount}
            />
          </div>

          {activeTab === 'inventory' && (
            <StockInventory
              products={products}
              suppliers={suppliers}
              stockTransactions={stockTransactions}
              settings={settings}
              categories={categories}
              onSaveProduct={handleSaveProduct}
              onUpdateStock={handleUpdateStock}
              onBulkImportProducts={handleBulkImportProducts}
              onAddCategory={handleAddCategory}
              onRenameCategory={handleRenameCategory}
              onDeleteCategory={handleDeleteCategory}
            />
          )}

          {activeTab === 'customers' && (
            <CustomersView
              customers={customers}
              invoices={invoices}
              settings={settings}
              onSaveCustomer={handleSaveCustomer}
            />
          )}

          {activeTab === 'suppliers' && (
            <SuppliersView
              suppliers={suppliers}
              products={products}
              stockTransactions={stockTransactions}
              supplierTransactions={supplierTransactions}
              settings={settings}
              onSaveSupplier={handleSaveSupplier}
              onDeleteSupplier={handleDeleteSupplier}
              onSaveSupplierTransaction={handleSaveSupplierTransaction}
            />
          )}

          {activeTab === 'invoices' && (
            <InvoicesHistory
              invoices={invoices}
              settings={settings}
              onPrintInvoice={(inv) => setPrintModalInvoice(inv)}
              onMarkCreditPaid={handleMarkCreditPaid}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView invoices={invoices} settings={settings} />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onResetData={handleResetData}
            />
          )}
        </main>
      </div>

      {/* Invoice Print & Receipt Preview Modal */}
      {printModalInvoice && (
        <BillPrintModal
          invoice={printModalInvoice}
          settings={settings}
          isOpen={true}
          onClose={() => setPrintModalInvoice(null)}
        />
      )}
    </div>
  );
}
