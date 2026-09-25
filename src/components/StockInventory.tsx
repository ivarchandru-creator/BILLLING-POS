import React, { useState, useMemo, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  ArrowUpDown,
  History,
  CheckCircle2,
  Edit2,
  X,
  Download,
  Upload,
  FileSpreadsheet,
  ArrowDownRight,
  ArrowUpRight,
  Filter,
  Clock,
  RotateCcw,
  FileText,
  Boxes,
  TrendingDown,
  TrendingUp,
  Tags,
  Tag,
  Trash2,
  Check,
  Truck,
  Phone,
  Mail,
  MapPin,
  Building2,
  Eye,
} from 'lucide-react';
import { Product, Supplier, StockTransaction, ShopSettings } from '../types';
import { ELECTRICAL_CATEGORIES } from '../data/electricalShopData';
import { formatINR } from '../utils/formatters';
import { downloadInventoryStockPdf } from '../utils/pdfGenerator';
import { CsvProductImportModal } from './CsvProductImportModal';
import { downloadProductCsvTemplate, exportProductsToCsv } from '../utils/csvInventoryHelper';
import { DEFAULT_PRODUCT_CATEGORIES } from '../utils/storage';

interface StockInventoryProps {
  products: Product[];
  suppliers: Supplier[];
  stockTransactions: StockTransaction[];
  settings: ShopSettings;
  categories?: string[];
  initialStockFilter?: 'all' | 'low';
  onSaveProduct: (product: Product) => void;
  onDeleteProduct?: (productId: string) => void;
  onUpdateStock: (
    productId: string,
    quantityChange: number,
    type: 'purchase' | 'adjustment',
    reason?: string,
    supplierId?: string,
    referenceId?: string
  ) => void;
  onBulkImportProducts?: (
    importedProducts: Product[],
    options: {
      updateExisting: boolean;
      stockMode: 'set' | 'add';
    }
  ) => void;
  onAddCategory?: (category: string) => void;
  onRenameCategory?: (oldName: string, newName: string) => void;
  onDeleteCategory?: (category: string, targetCategory?: string) => void;
}

export const StockInventory: React.FC<StockInventoryProps> = ({
  products,
  suppliers,
  stockTransactions,
  settings,
  categories,
  initialStockFilter,
  onSaveProduct,
  onDeleteProduct,
  onUpdateStock,
  onBulkImportProducts,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
}) => {
  const [activeView, setActiveView] = useState<'products' | 'transactions'>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Items');
  const [supplierFilter, setSupplierFilter] = useState('All Suppliers');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'low'>(initialStockFilter || 'all');
  const [viewDetailsProduct, setViewDetailsProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (initialStockFilter) {
      setStockStatusFilter(initialStockFilter);
      setActiveView('products');
    }
  }, [initialStockFilter]);

  // Compute active product categories dynamically
  const activeCategories = useMemo(() => {
    const base = categories && categories.length > 0 ? categories : DEFAULT_PRODUCT_CATEGORIES;
    const catSet = new Set<string>();
    base.forEach((c) => {
      if (c && c.trim()) catSet.add(c.trim());
    });
    products.forEach((p) => {
      if (p.category && p.category.trim()) catSet.add(p.category.trim());
    });
    return Array.from(catSet);
  }, [categories, products]);

  // Movement logs state
  const [txSearchQuery, setTxSearchQuery] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'in' | 'out' | 'adjustment'>('all');
  const [txCategoryFilter, setTxCategoryFilter] = useState('All');

  // Modals state
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState<Product | null>(null);

  // Manage Categories modal state
  const [isManageCatOpen, setIsManageCatOpen] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');
  const [newCatError, setNewCatError] = useState<string | null>(null);
  const [editingCategoryOldName, setEditingCategoryOldName] = useState<string | null>(null);
  const [editingCategoryNewName, setEditingCategoryNewName] = useState('');
  const [deleteCatModal, setDeleteCatModal] = useState<{
    category: string;
    productCount: number;
    fallbackCategory: string;
  } | null>(null);

  // In Add/Edit Product Modal inline custom category state
  const [isCustomCategoryInputOpen, setIsCustomCategoryInputOpen] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');

  // Stock In / Stock Adjustment modal state
  const [stockActionModal, setStockActionModal] = useState<{
    type: 'purchase' | 'adjustment';
    product: Product;
  } | null>(null);
  const [stockActionQty, setStockActionQty] = useState<number>(10);
  const [stockActionReason, setStockActionReason] = useState<string>('Stock replenishment');
  const [stockActionSupplier, setStockActionSupplier] = useState<string>('');
  const [stockActionRef, setStockActionRef] = useState<string>('');

  // Form State for New/Edit Product
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState(activeCategories[0] || 'Switches & Sockets');
  const [formSku, setFormSku] = useState('');
  const [formSellingPrice, setFormSellingPrice] = useState<number>(50);
  const [formPurchasePrice, setFormPurchasePrice] = useState<number>(35);
  const [formGstRate, setFormGstRate] = useState<number | string>(18);
  const [formStockQty, setFormStockQty] = useState<number>(50);
  const [formMinStock, setFormMinStock] = useState<number>(15);
  const [formUnit, setFormUnit] = useState('pcs');
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formHsn, setFormHsn] = useState('8536');

  const handleAddNewCategory = (catName?: string) => {
    const target = (catName || newCatInput).trim();
    if (!target) {
      setNewCatError('Please enter a category name');
      return;
    }
    if (activeCategories.some((c) => c.toLowerCase() === target.toLowerCase())) {
      setNewCatError(`Category "${target}" already exists`);
      return;
    }
    setNewCatError(null);
    onAddCategory?.(target);
    setNewCatInput('');
  };

  const handleStartRename = (cat: string) => {
    setEditingCategoryOldName(cat);
    setEditingCategoryNewName(cat);
  };

  const handleSaveRename = (oldName: string) => {
    const trimmed = editingCategoryNewName.trim();
    if (!trimmed || trimmed.toLowerCase() === oldName.toLowerCase()) {
      setEditingCategoryOldName(null);
      return;
    }
    if (
      activeCategories.some(
        (c) => c.toLowerCase() === trimmed.toLowerCase() && c.toLowerCase() !== oldName.toLowerCase()
      )
    ) {
      alert(`Category "${trimmed}" already exists.`);
      return;
    }
    onRenameCategory?.(oldName, trimmed);
    setEditingCategoryOldName(null);
  };

  const handleDeleteCategoryPrompt = (cat: string) => {
    const count = products.filter((p) => p.category.toLowerCase() === cat.toLowerCase()).length;
    const otherCats = activeCategories.filter((c) => c.toLowerCase() !== cat.toLowerCase());
    const fallback = otherCats[0] || 'Accessories & Tools';

    if (count > 0) {
      setDeleteCatModal({
        category: cat,
        productCount: count,
        fallbackCategory: fallback,
      });
    } else {
      if (window.confirm(`Delete category "${cat}"?`)) {
        onDeleteCategory?.(cat);
      }
    }
  };

  const handleConfirmDeleteWithFallback = () => {
    if (!deleteCatModal) return;
    onDeleteCategory?.(deleteCatModal.category, deleteCatModal.fallbackCategory);
    setDeleteCatModal(null);
  };

  const handleAddCustomCategoryFromProductModal = () => {
    const trimmed = customCategoryName.trim();
    if (!trimmed) return;
    onAddCategory?.(trimmed);
    setFormCategory(trimmed);
    setCustomCategoryName('');
    setIsCustomCategoryInputOpen(false);
  };

  const openNewProductModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormCategory(activeCategories[0] || 'Switches & Sockets');
    setIsCustomCategoryInputOpen(false);
    setCustomCategoryName('');
    setFormSku('');
    setFormSellingPrice(50);
    setFormPurchasePrice(35);
    setFormGstRate(18);
    setFormStockQty(50);
    setFormMinStock(15);
    setFormUnit('pcs');
    setFormSupplierId(suppliers[0]?.supplierId || '');
    setFormHsn('8536');
    setIsAddProductOpen(true);
  };

  const openEditProductModal = (product: Product) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormCategory(product.category || activeCategories[0] || 'Switches & Sockets');
    setIsCustomCategoryInputOpen(false);
    setCustomCategoryName('');
    setFormSku(product.skuCode || '');
    setFormSellingPrice(product.sellingPrice);
    setFormPurchasePrice(product.purchasePrice);
    setFormGstRate(product.gstRate);
    setFormStockQty(product.stockQty);
    setFormMinStock(product.minimumStock);
    setFormUnit(product.unit);
    setFormSupplierId(product.supplierId || '');
    setFormHsn(product.hsnCode || '8536');
    setIsAddProductOpen(true);
  };

  const handleSaveProductForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const newProduct: Product = {
      productId: editingProduct ? editingProduct.productId : `prod-${Date.now()}`,
      name: formName.trim(),
      category: formCategory,
      skuCode: formSku.trim() || undefined,
      sellingPrice: Number(formSellingPrice) || 0,
      purchasePrice: Number(formPurchasePrice) || 0,
      gstRate: formGstRate === '' ? 0 : (Number(formGstRate) >= 0 ? Number(formGstRate) : 0),
      stockQty: Number(formStockQty) || 0,
      minimumStock: Number(formMinStock) || 10,
      unit: formUnit.trim() || 'pcs',
      supplierId: formSupplierId || undefined,
      supplierName: formSupplierId ? suppliers.find((s) => s.supplierId === formSupplierId)?.companyName : undefined,
      activeStatus: true,
      hsnCode: formHsn.trim() || undefined,
    };

    onSaveProduct(newProduct);
    setIsAddProductOpen(false);
  };

  const handleConfirmStockAction = () => {
    if (!stockActionModal) return;
    const qty = Number(stockActionQty);
    if (isNaN(qty) || qty === 0) return;

    onUpdateStock(
      stockActionModal.product.productId,
      qty,
      stockActionModal.type,
      stockActionReason,
      stockActionSupplier || undefined,
      stockActionRef || undefined
    );

    setStockActionModal(null);
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory =
        categoryFilter === 'All Items' || p.category === categoryFilter;
      const q = searchQuery.toLowerCase().trim();
      const prodSupplier = suppliers.find((s) => s.supplierId === p.supplierId);
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        Boolean(p.skuCode && p.skuCode.toLowerCase().includes(q)) ||
        Boolean(p.hsnCode && p.hsnCode.toLowerCase().includes(q)) ||
        Boolean(
          prodSupplier &&
            (prodSupplier.companyName.toLowerCase().includes(q) ||
              prodSupplier.name.toLowerCase().includes(q) ||
              prodSupplier.phone.toLowerCase().includes(q))
        );
      const matchesStatus =
        stockStatusFilter === 'all' || p.stockQty <= p.minimumStock;
      const matchesSupplier =
        supplierFilter === 'All Suppliers' ||
        (supplierFilter === '__UNASSIGNED__' ? !p.supplierId : p.supplierId === supplierFilter);

      return matchesCategory && matchesSearch && matchesStatus && matchesSupplier;
    });
  }, [products, categoryFilter, searchQuery, stockStatusFilter, supplierFilter, suppliers]);

  const lowStockCount = useMemo(() => {
    return products.filter((p) => p.stockQty <= p.minimumStock).length;
  }, [products]);

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.productId, p));
    return map;
  }, [products]);

  // Enriched movement transactions with clear direction, unit, and readable reasons
  const enrichedTransactions = useMemo(() => {
    return stockTransactions.map((tx) => {
      const product = productMap.get(tx.productId);
      const unit = product?.unit || 'units';
      const category = product?.category || 'General';
      const skuCode = product?.skuCode;

      // Mathematical ground-truth delta:
      const calculatedDelta = tx.newStock - tx.previousStock;

      let isStockIn = false;
      let isStockOut = false;
      let effectiveQty = Math.abs(calculatedDelta);

      if (tx.type === 'purchase') {
        isStockIn = true;
        effectiveQty = calculatedDelta !== 0 ? Math.abs(calculatedDelta) : Math.abs(tx.quantity);
      } else if (tx.type === 'sale') {
        isStockOut = true;
        effectiveQty = calculatedDelta !== 0 ? Math.abs(calculatedDelta) : Math.abs(tx.quantity);
      } else {
        // Adjustment or return
        if (calculatedDelta > 0) {
          isStockIn = true;
        } else if (calculatedDelta < 0) {
          isStockOut = true;
        } else {
          if (tx.quantity > 0) isStockIn = true;
          else if (tx.quantity < 0) isStockOut = true;
        }
      }

      // Friendly badge label
      let typeLabel = 'Adjustment';
      let typeSubtext = 'Recount / Audit';

      if (tx.type === 'purchase') {
        typeLabel = 'Stock IN';
        typeSubtext = tx.supplierName ? tx.supplierName : 'Purchase / Restock';
      } else if (tx.type === 'sale') {
        typeLabel = 'Stock OUT';
        typeSubtext = 'Customer Bill';
      } else if (tx.type === 'return') {
        typeLabel = isStockIn ? 'Stock IN' : 'Stock OUT';
        typeSubtext = 'Customer Return';
      } else if (tx.type === 'adjustment') {
        typeLabel = isStockIn ? 'Stock IN (+)' : 'Stock OUT (-)';
        typeSubtext = 'Manual Recount';
      }

      return {
        ...tx,
        unit,
        category,
        skuCode,
        isStockIn,
        isStockOut,
        effectiveQty,
        calculatedDelta,
        typeLabel,
        typeSubtext,
      };
    });
  }, [stockTransactions, productMap]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return enrichedTransactions.filter((tx) => {
      // Type filter
      if (txTypeFilter === 'in' && !tx.isStockIn) return false;
      if (txTypeFilter === 'out' && !tx.isStockOut) return false;
      if (txTypeFilter === 'adjustment' && tx.type !== 'adjustment') return false;

      // Category filter
      if (txCategoryFilter !== 'All' && tx.category !== txCategoryFilter) return false;

      // Search query
      if (txSearchQuery.trim()) {
        const q = txSearchQuery.toLowerCase().trim();
        const matchesProduct = tx.productName.toLowerCase().includes(q);
        const matchesRef = Boolean(tx.referenceId && tx.referenceId.toLowerCase().includes(q));
        const matchesNotes = Boolean(tx.notes && tx.notes.toLowerCase().includes(q));
        const matchesReason = Boolean(tx.reason && tx.reason.toLowerCase().includes(q));
        const matchesSupplier = Boolean(tx.supplierName && tx.supplierName.toLowerCase().includes(q));
        const matchesCategory = tx.category.toLowerCase().includes(q);
        const matchesSku = Boolean(tx.skuCode && tx.skuCode.toLowerCase().includes(q));
        return matchesProduct || matchesRef || matchesNotes || matchesReason || matchesSupplier || matchesCategory || matchesSku;
      }

      return true;
    });
  }, [enrichedTransactions, txTypeFilter, txCategoryFilter, txSearchQuery]);

  // Quick stats for transactions
  const txStats = useMemo(() => {
    let inCount = 0;
    let outCount = 0;
    let adjCount = 0;
    enrichedTransactions.forEach((tx) => {
      if (tx.isStockIn) inCount++;
      else if (tx.isStockOut) outCount++;
      if (tx.type === 'adjustment') adjCount++;
    });
    return {
      total: enrichedTransactions.length,
      inCount,
      outCount,
      adjCount,
    };
  }, [enrichedTransactions]);

  return (
    <div className="w-full h-full p-6 sm:p-8 overflow-y-auto space-y-6 bg-slate-50/50">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Products & Inventory
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage electrical catalog, pricing, HSN codes, and stock levels.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* View Tab Switcher */}
          <div className="bg-slate-100 p-1 rounded-lg flex text-xs font-semibold">
            <button
              type="button"
              id="tab-view-products"
              onClick={() => setActiveView('products')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeView === 'products'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Items ({products.length})
            </button>
            <button
              type="button"
              id="tab-view-transactions"
              onClick={() => setActiveView('transactions')}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                activeView === 'transactions'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Movement Logs ({stockTransactions.length})
            </button>
          </div>

          {/* CSV Template Download */}
          <button
            type="button"
            id="btn-download-csv-template"
            onClick={downloadProductCsvTemplate}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors"
            title="Download CSV import template with sample electrical items"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">CSV Template</span>
          </button>

          {/* Import CSV Button */}
          <button
            type="button"
            id="btn-open-csv-import"
            onClick={() => setIsCsvModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
            title="Batch import electrical products from a CSV file"
          >
            <Upload className="w-3.5 h-3.5 text-orange-400" />
            <span>Import CSV</span>
          </button>

          {/* Manage Categories Button */}
          <button
            type="button"
            id="btn-manage-categories"
            onClick={() => setIsManageCatOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors"
            title="Manage, customize, rename, and add product categories"
          >
            <Tags className="w-3.5 h-3.5 text-orange-600" />
            <span>Categories ({activeCategories.length})</span>
          </button>

          <button
            type="button"
            id="btn-download-inventory-stock-pdf"
            onClick={() => {
              const filterDesc =
                categoryFilter !== 'All Items'
                  ? `Category: ${categoryFilter} (${filteredProducts.length} items)`
                  : `All Products (${filteredProducts.length} items)`;
              downloadInventoryStockPdf(filteredProducts, settings, filterDesc);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors"
            title="Download inventory audit report as standard A4 PDF (210 x 297 mm)"
          >
            <Download className="w-3.5 h-3.5 text-orange-500" />
            <span className="hidden sm:inline">Download A4 PDF</span>
          </button>

          <button
            type="button"
            id="btn-add-new-product"
            onClick={openNewProductModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors ml-auto sm:ml-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Import Notice Banner */}
      {importNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{importNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setImportNotice(null)}
            className="p-1 text-emerald-700 hover:text-emerald-950 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeView === 'products' ? (
        <>
          {/* Search & Filters */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  id="input-stock-search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products by item name, SKU, or supplier..."
                  className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs sm:text-sm font-medium text-zinc-900 focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Low Stock Quick Filter */}
              <button
                type="button"
                id="btn-filter-low-stock-toggle"
                onClick={() =>
                  setStockStatusFilter(stockStatusFilter === 'low' ? 'all' : 'low')
                }
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  stockStatusFilter === 'low'
                    ? 'bg-orange-500 text-black'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
                <span>Low Stock ({lowStockCount})</span>
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setCategoryFilter('All Items')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  categoryFilter === 'All Items'
                    ? 'bg-black text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-black'
                }`}
              >
                All Items ({products.length})
              </button>

              {activeCategories.map((cat) => {
                const isSelected = categoryFilter === cat;
                const catCount = products.filter((p) => p.category === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-black text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-black'
                    }`}
                  >
                    <span>{cat}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isSelected ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-200/80 text-zinc-600'
                      }`}
                    >
                      {catCount}
                    </span>
                  </button>
                );
              })}

              {/* Quick Add / Manage Category pill */}
              <button
                type="button"
                id="btn-filter-add-category"
                onClick={() => setIsManageCatOpen(true)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 flex items-center gap-1 cursor-pointer shrink-0"
                title="Add or manage custom categories"
              >
                <Plus className="w-3.5 h-3.5 text-orange-600" />
                <span>Add / Manage Category</span>
              </button>
            </div>

            {/* Supplier Filter Row */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
              <span className="font-semibold text-slate-500 flex items-center gap-1 text-[11px]">
                <Truck className="w-3.5 h-3.5 text-orange-500" />
                <span>Filter by Supplier:</span>
              </span>
              <select
                id="select-filter-supplier"
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-orange-500"
              >
                <option value="All Suppliers">All Suppliers ({products.length} items)</option>
                {suppliers.map((s) => {
                  const sCount = products.filter((p) => p.supplierId === s.supplierId).length;
                  return (
                    <option key={s.supplierId} value={s.supplierId}>
                      {s.companyName} ({sCount} items)
                    </option>
                  );
                })}
                <option value="__UNASSIGNED__">
                  Open Market / Unassigned ({products.filter((p) => !p.supplierId).length} items)
                </option>
              </select>

              {supplierFilter !== 'All Suppliers' && (
                <button
                  type="button"
                  onClick={() => setSupplierFilter('All Suppliers')}
                  className="text-[11px] text-orange-600 hover:text-orange-800 font-semibold flex items-center gap-0.5 ml-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>Clear Supplier Filter</span>
                </button>
              )}
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-zinc-50 text-zinc-600 font-semibold border-b border-zinc-200">
                    <th className="py-3 px-4">Item & Code</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Supplier / Distributor</th>
                    <th className="py-3 px-4 text-right">Selling Price</th>
                    <th className="py-3 px-4 text-right">Cost Price</th>
                    <th className="py-3 px-4 text-center">GST</th>
                    <th className="py-3 px-4 text-center">Current Stock</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                            <Package className="w-5 h-5" />
                          </div>
                          <p className="text-sm font-bold text-slate-800">
                            {products.length === 0
                              ? 'No products in your catalog yet'
                              : 'No electrical products matching your filters'}
                          </p>
                          <p className="text-xs text-slate-500 mt-1 mb-4 text-center">
                            {products.length === 0
                              ? 'Get started by uploading your electrical catalog via CSV template or adding items manually.'
                              : 'Try adjusting your search query, supplier filter, or category filters.'}
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setIsCsvModalOpen(true)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
                            >
                              <Upload className="w-3.5 h-3.5 text-orange-400" />
                              <span>Import Products CSV</span>
                            </button>
                            <button
                              type="button"
                              onClick={downloadProductCsvTemplate}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                              <span>CSV Template</span>
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((prod) => {
                      const isLowStock = prod.stockQty <= prod.minimumStock;
                      const supplierObj = suppliers.find((s) => s.supplierId === prod.supplierId);

                      return (
                        <tr key={prod.productId} className="hover:bg-zinc-50 transition-colors">
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => setViewDetailsProduct(prod)}
                              className="font-bold text-zinc-950 text-sm text-left hover:text-orange-600 transition-colors block cursor-pointer"
                              title="Click to view full product & supplier details"
                            >
                              {prod.name}
                            </button>
                            <div className="text-[11px] text-zinc-400 font-mono flex items-center gap-2 mt-0.5">
                              {prod.skuCode && <span>Code: {prod.skuCode}</span>}
                              {prod.hsnCode && <span>HSN: {prod.hsnCode}</span>}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-medium text-zinc-600">
                            {prod.category}
                          </td>
                          {/* Supplier / Distributor Column */}
                          <td className="py-3 px-4">
                            {supplierObj ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 font-semibold text-slate-900 text-xs">
                                  <Truck className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                                  <span className="truncate max-w-[150px]" title={supplierObj.companyName}>
                                    {supplierObj.companyName}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                  {supplierObj.name && (
                                    <span className="truncate max-w-[85px]">{supplierObj.name}</span>
                                  )}
                                  {supplierObj.phone && (
                                    <a
                                      href={`tel:${supplierObj.phone}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-orange-600 hover:text-orange-800 font-mono font-medium inline-flex items-center gap-0.5 hover:underline"
                                      title={`Call supplier: ${supplierObj.phone}`}
                                    >
                                      <Phone className="w-2.5 h-2.5" />
                                      <span>{supplierObj.phone}</span>
                                    </a>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Open Market</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-zinc-950 text-sm">
                            {formatINR(prod.sellingPrice)}
                            <span className="text-[10px] text-zinc-400 font-normal ml-0.5">
                              /{prod.unit}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-zinc-500">
                            {formatINR(prod.purchasePrice)}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-zinc-600">
                            {prod.gstRate}%
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-zinc-950 text-sm">
                            {prod.stockQty} <span className="text-zinc-400 font-normal text-xs">{prod.unit}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isLowStock ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-800">
                                  Low ({prod.stockQty}/{prod.minimumStock})
                                </span>
                                {supplierObj && (
                                  <span className="text-[10px] text-orange-600 font-medium truncate max-w-[120px]" title={`Reorder from ${supplierObj.companyName}`}>
                                    Reorder: {supplierObj.companyName}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-700">
                                In Stock
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* View Details */}
                              <button
                                type="button"
                                id={`btn-details-${prod.productId}`}
                                onClick={() => setViewDetailsProduct(prod)}
                                title="View full product & supplier details"
                                className="p-1.5 bg-zinc-100 hover:bg-orange-100 hover:text-orange-700 text-zinc-700 rounded transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Single Unified Stock Action Button */}
                              <button
                                type="button"
                                id={`btn-stock-${prod.productId}`}
                                onClick={() => {
                                  setStockActionModal({ type: 'purchase', product: prod });
                                  setStockActionQty(10);
                                  setStockActionReason('Purchase replenishment');
                                  setStockActionSupplier(prod.supplierId || suppliers[0]?.supplierId || '');
                                  setStockActionRef(`PO-${Math.floor(1000 + Math.random() * 9000)}`);
                                }}
                                title="Update Stock (Stock In or Adjust)"
                                className="px-2.5 py-1 bg-slate-900 hover:bg-orange-500 text-white rounded text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <ArrowUpDown className="w-3 h-3" />
                                <span>Stock</span>
                              </button>

                              {/* Edit */}
                              <button
                                type="button"
                                id={`btn-edit-${prod.productId}`}
                                onClick={() => openEditProductModal(prod)}
                                title="Edit product"
                                className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Product */}
                              {onDeleteProduct && (
                                <button
                                  type="button"
                                  id={`btn-delete-${prod.productId}`}
                                  onClick={() => setDeleteConfirmProduct(prod)}
                                  title={`Delete product "${prod.name}"`}
                                  className="p-1.5 bg-zinc-100 hover:bg-rose-50 hover:text-rose-600 text-zinc-400 rounded transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* STOCK TRANSACTION MOVEMENT LOGS - ENHANCED & EASY TO UNDERSTAND */
        <div className="space-y-4">
          {/* Quick Filter & Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* All Logs */}
            <button
              type="button"
              onClick={() => setTxTypeFilter('all')}
              className={`p-3 rounded-xl border text-left transition-all ${
                txTypeFilter === 'all'
                  ? 'bg-white border-slate-900 shadow-xs ring-1 ring-slate-900'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">All Movements</span>
                <Boxes className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-xl font-bold text-slate-900 mt-1 font-mono">{txStats.total}</p>
            </button>

            {/* Stock IN */}
            <button
              type="button"
              onClick={() => setTxTypeFilter('in')}
              className={`p-3 rounded-xl border text-left transition-all ${
                txTypeFilter === 'in'
                  ? 'bg-emerald-50/60 border-emerald-500 shadow-xs ring-1 ring-emerald-500'
                  : 'bg-white border-slate-200 hover:border-emerald-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-emerald-700 flex items-center gap-1">
                  <ArrowDownRight className="w-3.5 h-3.5" /> Stock IN
                </span>
              </div>
              <p className="text-xl font-bold text-emerald-700 mt-1 font-mono">+{txStats.inCount}</p>
            </button>

            {/* Stock OUT */}
            <button
              type="button"
              onClick={() => setTxTypeFilter('out')}
              className={`p-3 rounded-xl border text-left transition-all ${
                txTypeFilter === 'out'
                  ? 'bg-rose-50/60 border-rose-500 shadow-xs ring-1 ring-rose-500'
                  : 'bg-white border-slate-200 hover:border-rose-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-rose-700 flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" /> Stock OUT
                </span>
              </div>
              <p className="text-xl font-bold text-rose-700 mt-1 font-mono">-{txStats.outCount}</p>
            </button>

            {/* Adjustments */}
            <button
              type="button"
              onClick={() => setTxTypeFilter('adjustment')}
              className={`p-3 rounded-xl border text-left transition-all ${
                txTypeFilter === 'adjustment'
                  ? 'bg-amber-50/60 border-amber-500 shadow-xs ring-1 ring-amber-500'
                  : 'bg-white border-slate-200 hover:border-amber-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-amber-700 flex items-center gap-1">
                  <RotateCcw className="w-3.5 h-3.5" /> Adjustments
                </span>
              </div>
              <p className="text-xl font-bold text-amber-700 mt-1 font-mono">{txStats.adjCount}</p>
            </button>
          </div>

          {/* Search and Filters Toolbar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={txSearchQuery}
                  onChange={(e) => setTxSearchQuery(e.target.value)}
                  placeholder="Search by item name, SKU, bill number (e.g. EB-2026), supplier..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white font-medium transition-all"
                />
                {txSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setTxSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 rounded-full"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-2">
                <select
                  value={txCategoryFilter}
                  onChange={(e) => setTxCategoryFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-orange-500 focus:bg-white"
                >
                  <option value="All">All Categories</option>
                  {activeCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                {/* Reset Filters button if active */}
                {(txSearchQuery || txTypeFilter !== 'all' || txCategoryFilter !== 'All') && (
                  <button
                    type="button"
                    onClick={() => {
                      setTxSearchQuery('');
                      setTxTypeFilter('all');
                      setTxCategoryFilter('All');
                    }}
                    className="px-2.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 flex items-center gap-1 transition-colors whitespace-nowrap"
                    title="Reset all filters"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Reset</span>
                  </button>
                )}
              </div>
            </div>

            {/* Sub-bar with count and active status */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span>
                  Showing <strong className="text-slate-900 font-bold">{filteredTransactions.length}</strong> of{' '}
                  {enrichedTransactions.length} stock movement logs
                </span>
                {txTypeFilter !== 'all' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                    Filter: {txTypeFilter === 'in' ? 'Stock IN' : txTypeFilter === 'out' ? 'Stock OUT' : 'Adjustments'}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-400">
                Sorted by latest first
              </span>
            </div>
          </div>

          {/* Movement Logs List / Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {filteredTransactions.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <History className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">No stock movements found</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {txSearchQuery || txTypeFilter !== 'all' || txCategoryFilter !== 'All'
                    ? 'No movement logs match your current search or filter criteria. Try resetting filters.'
                    : 'Stock movements will appear here automatically whenever products are sold, purchased, or adjusted.'}
                </p>
                {(txSearchQuery || txTypeFilter !== 'all' || txCategoryFilter !== 'All') && (
                  <button
                    type="button"
                    onClick={() => {
                      setTxSearchQuery('');
                      setTxTypeFilter('all');
                      setTxCategoryFilter('All');
                    }}
                    className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop & Tablet Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                        <th className="py-3 px-4 w-44">Date & Time</th>
                        <th className="py-3 px-4">Item & Category</th>
                        <th className="py-3 px-4 w-36">Movement Type</th>
                        <th className="py-3 px-4 text-center w-32">Qty Change</th>
                        <th className="py-3 px-4 text-center w-36">Stock Level</th>
                        <th className="py-3 px-4">Details / Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTransactions.map((tx) => {
                        const isPositive = tx.isStockIn;
                        const isNegative = tx.isStockOut;

                        return (
                          <tr key={tx.transactionId} className="hover:bg-slate-50/70 transition-colors">
                            {/* Date & Time */}
                            <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 font-medium text-slate-800">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span>{tx.dateTime}</span>
                              </div>
                            </td>

                            {/* Item & Category */}
                            <td className="py-3 px-4">
                              <p className="font-bold text-slate-900 text-xs sm:text-[13px]">{tx.productName}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {tx.category}
                                </span>
                                {tx.skuCode && (
                                  <span className="text-[10px] font-mono text-slate-400">
                                    SKU: {tx.skuCode}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Movement Type (In / Out / Adjustment) */}
                            <td className="py-3 px-4">
                              {isPositive ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <ArrowDownRight className="w-3 h-3" />
                                  <span>Stock IN</span>
                                </span>
                              ) : isNegative ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  <ArrowUpRight className="w-3 h-3" />
                                  <span>Stock OUT</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Adjustment</span>
                                </span>
                              )}
                            </td>

                            {/* Qty Change */}
                            <td className="py-3 px-4 text-center">
                              {isPositive ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  +{tx.effectiveQty} {tx.unit}
                                </span>
                              ) : isNegative ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold font-mono bg-rose-50 text-rose-700 border border-rose-200">
                                  -{tx.effectiveQty} {tx.unit}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold font-mono bg-slate-100 text-slate-700 border border-slate-200">
                                  0 {tx.unit}
                                </span>
                              )}
                            </td>

                            {/* Stock Level (Before -> Now) */}
                            <td className="py-3 px-4 text-center">
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono">
                                <span className="text-slate-500 font-medium" title="Stock before movement">
                                  {tx.previousStock}
                                </span>
                                <span className="text-slate-400 font-sans">→</span>
                                <span className="font-bold text-slate-900" title="Resulting stock after movement">
                                  {tx.newStock} {tx.unit}
                                </span>
                              </div>
                            </td>

                            {/* Details / Reference / Notes */}
                            <td className="py-3 px-4">
                              <div className="space-y-0.5">
                                {tx.referenceId && (
                                  <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono font-semibold text-slate-800 mr-2">
                                    <FileText className="w-3 h-3 text-slate-500" />
                                    <span>{tx.referenceId}</span>
                                  </div>
                                )}
                                {tx.supplierName && (
                                  <span className="text-[11px] text-slate-600 font-medium mr-2">
                                    Supplier: {tx.supplierName}
                                  </span>
                                )}
                                {(tx.notes || tx.reason) && (
                                  <p className="text-xs text-slate-600 leading-snug">
                                    {tx.notes || tx.reason}
                                  </p>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View (< md screens) */}
                <div className="block md:hidden divide-y divide-slate-100">
                  {filteredTransactions.map((tx) => {
                    const isPositive = tx.isStockIn;
                    const isNegative = tx.isStockOut;

                    return (
                      <div key={tx.transactionId} className="p-4 space-y-2.5 hover:bg-slate-50">
                        {/* Header: Date + Movement Badge */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{tx.dateTime}</span>
                          </div>

                          {isPositive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <ArrowDownRight className="w-3 h-3" /> Stock IN
                            </span>
                          ) : isNegative ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <ArrowUpRight className="w-3 h-3" /> Stock OUT
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <RotateCcw className="w-3 h-3" /> Adjustment
                            </span>
                          )}
                        </div>

                        {/* Product Name & Category */}
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 leading-snug">{tx.productName}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {tx.category}
                            </span>
                            {tx.skuCode && (
                              <span className="text-[10px] font-mono text-slate-400">
                                SKU: {tx.skuCode}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Movement and Stock Progress */}
                        <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                          <div>
                            <span className="text-[10px] text-slate-400 font-semibold block uppercase">Quantity</span>
                            {isPositive ? (
                              <span className="text-sm font-bold font-mono text-emerald-700">+{tx.effectiveQty} {tx.unit}</span>
                            ) : isNegative ? (
                              <span className="text-sm font-bold font-mono text-rose-700">-{tx.effectiveQty} {tx.unit}</span>
                            ) : (
                              <span className="text-sm font-bold font-mono text-slate-700">0 {tx.unit}</span>
                            )}
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 font-semibold block uppercase">Stock Change</span>
                            <div className="flex items-center gap-1 text-xs font-mono">
                              <span className="text-slate-500">{tx.previousStock}</span>
                              <span className="text-slate-400">→</span>
                              <strong className="text-slate-900 font-bold">{tx.newStock} {tx.unit}</strong>
                            </div>
                          </div>
                        </div>

                        {/* Notes / Reference */}
                        {(tx.referenceId || tx.notes || tx.reason || tx.supplierName) && (
                          <div className="text-xs text-slate-600 bg-slate-50/50 p-2 rounded border border-slate-100 space-y-1">
                            {tx.referenceId && (
                              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-mono font-semibold text-slate-800 mr-2">
                                <FileText className="w-3 h-3 text-slate-400" />
                                <span>Ref: {tx.referenceId}</span>
                              </div>
                            )}
                            {tx.supplierName && (
                              <span className="text-[11px] text-slate-600 font-medium mr-2">
                                Supplier: {tx.supplierName}
                              </span>
                            )}
                            {(tx.notes || tx.reason) && (
                              <p className="text-slate-600">{tx.notes || tx.reason}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Stock In / Adjustment Action Modal */}
      {stockActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl space-y-4 border border-zinc-200">
            <div className="flex justify-between items-start pb-2 border-b border-zinc-100">
              <div>
                <h3 className="text-base font-bold text-zinc-950">
                  {stockActionModal.type === 'purchase' ? 'Stock In (Receive Inventory)' : 'Manual Stock Adjustment'}
                </h3>
                <p className="text-xs text-zinc-500">{stockActionModal.product.name}</p>
              </div>
              <button
                onClick={() => setStockActionModal(null)}
                className="p-1 text-zinc-400 hover:text-black rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Operation Type Switcher */}
              <div className="flex bg-zinc-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() =>
                    setStockActionModal({ ...stockActionModal, type: 'purchase' })
                  }
                  className={`flex-1 py-1.5 rounded-md font-semibold text-xs transition-colors ${
                    stockActionModal.type === 'purchase'
                      ? 'bg-white text-zinc-950 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-950'
                  }`}
                >
                  Stock In (Purchase)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setStockActionModal({ ...stockActionModal, type: 'adjustment' })
                  }
                  className={`flex-1 py-1.5 rounded-md font-semibold text-xs transition-colors ${
                    stockActionModal.type === 'adjustment'
                      ? 'bg-white text-zinc-950 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-950'
                  }`}
                >
                  Adjustment / Recount
                </button>
              </div>

              <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 flex justify-between items-center">
                <span className="text-zinc-600">Current Stock:</span>
                <span className="font-mono font-bold text-sm text-zinc-950">
                  {stockActionModal.product.stockQty} {stockActionModal.product.unit}
                </span>
              </div>

              <div>
                <label className="font-semibold text-zinc-700 block mb-1">
                  {stockActionModal.type === 'purchase'
                    ? 'Quantity Received (+)'
                    : 'Quantity Adjustment (+ or -)'}
                </label>
                <input
                  type="number"
                  id="input-stock-action-qty"
                  value={stockActionQty}
                  onChange={(e) => setStockActionQty(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm font-bold text-zinc-900 focus:outline-none focus:border-orange-500"
                />
              </div>

              {stockActionModal.type === 'purchase' ? (
                <>
                  <div>
                    <label className="font-semibold text-zinc-700 block mb-1">Supplier</label>
                    <select
                      id="select-stock-supplier"
                      value={stockActionSupplier}
                      onChange={(e) => setStockActionSupplier(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium focus:outline-none focus:border-orange-500"
                    >
                      <option value="">Select Supplier (Optional)</option>
                      {suppliers.map((s) => (
                        <option key={s.supplierId} value={s.supplierId}>
                          {s.companyName} ({s.name})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-zinc-700 block mb-1">Invoice / PO Reference</label>
                    <input
                      type="text"
                      id="input-stock-ref"
                      value={stockActionRef}
                      onChange={(e) => setStockActionRef(e.target.value)}
                      placeholder="e.g. INV-SUP-889"
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">Reason</label>
                  <select
                    id="select-stock-reason"
                    value={stockActionReason}
                    onChange={(e) => setStockActionReason(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium focus:outline-none focus:border-orange-500"
                  >
                    <option value="Physical recount correction">Physical recount correction</option>
                    <option value="Damaged in handling">Damaged in handling</option>
                    <option value="Returned by customer">Returned by customer</option>
                    <option value="Sample / testing">Sample / testing</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-zinc-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStockActionModal(null)}
                className="px-3.5 py-1.5 border border-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-stock-action"
                onClick={handleConfirmStockAction}
                className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-black rounded-lg text-xs font-bold shadow-xs transition-colors"
              >
                Confirm Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto border border-zinc-200">
            <div className="flex justify-between items-start pb-2 border-b border-zinc-100">
              <div>
                <h3 className="text-base font-bold text-zinc-950">
                  {editingProduct ? 'Edit Electrical Item' : 'Add New Electrical Item'}
                </h3>
              </div>
              <button
                onClick={() => setIsAddProductOpen(false)}
                className="p-1 text-zinc-400 hover:text-black rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProductForm} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Anchor Roma 10A Switch, Finolex 1.5 Wire..."
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-medium text-zinc-900 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-zinc-700 block">Category *</label>
                    <button
                      type="button"
                      onClick={() => setIsCustomCategoryInputOpen(!isCustomCategoryInputOpen)}
                      className="text-orange-600 hover:text-orange-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{isCustomCategoryInputOpen ? 'Select Existing' : '+ New Category'}</span>
                    </button>
                  </div>

                  {isCustomCategoryInputOpen ? (
                    <div className="space-y-1.5 p-2 bg-orange-50/70 border border-orange-200 rounded-lg">
                      <div className="text-[11px] font-medium text-orange-950">Add & select new category:</div>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={customCategoryName}
                          onChange={(e) => setCustomCategoryName(e.target.value)}
                          placeholder="e.g. Solar & Inverters..."
                          className="flex-1 px-2.5 py-1.5 bg-white border border-orange-300 rounded text-xs focus:outline-none focus:border-orange-500 font-medium"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCustomCategoryFromProductModal();
                            }
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomCategoryFromProductModal}
                          className="px-2.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs font-bold cursor-pointer transition-colors"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomCategoryInputOpen(false);
                            setCustomCategoryName('');
                          }}
                          className="px-2 py-1.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 rounded text-xs cursor-pointer transition-colors"
                          title="Cancel custom category"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <select
                      value={formCategory}
                      onChange={(e) => {
                        if (e.target.value === '__NEW_CAT__') {
                          setIsCustomCategoryInputOpen(true);
                        } else {
                          setFormCategory(e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-medium focus:outline-none focus:border-orange-500"
                    >
                      {activeCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value="__NEW_CAT__" className="text-orange-600 font-semibold">
                        + Add New Category...
                      </option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">
                    SKU / Code <span className="text-zinc-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    placeholder="Optional (e.g. AR-SW-10A)"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-mono font-medium focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={formSellingPrice}
                    onChange={(e) => setFormSellingPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-mono font-bold text-zinc-950 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">Cost Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formPurchasePrice}
                    onChange={(e) => setFormPurchasePrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-mono text-zinc-700 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">Unit</label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-medium focus:outline-none focus:border-orange-500"
                  >
                    <option value="pcs">pcs</option>
                    <option value="coil">coil</option>
                    <option value="meter">meter</option>
                    <option value="box">box</option>
                    <option value="set">set</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">Initial Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={formStockQty}
                    onChange={(e) => setFormStockQty(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-mono font-medium focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">Min Threshold</label>
                  <input
                    type="number"
                    min="1"
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-mono focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">
                    GST Rate (%) <span className="text-zinc-400 font-normal text-[11px]">(Manual)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      required
                      value={formGstRate}
                      onChange={(e) => setFormGstRate(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="e.g. 18"
                      className="w-full px-3 py-2 pr-7 bg-zinc-50 border border-zinc-200 rounded-lg font-mono font-medium focus:outline-none focus:border-orange-500"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 font-medium text-xs pointer-events-none">
                      %
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">HSN Code</label>
                  <input
                    type="text"
                    value={formHsn}
                    onChange={(e) => setFormHsn(e.target.value)}
                    placeholder="8536 / 8544"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-mono focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">Supplier / Distributor</label>
                  <select
                    id="select-product-form-supplier"
                    value={formSupplierId}
                    onChange={(e) => setFormSupplierId(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-medium focus:outline-none focus:border-orange-500"
                  >
                    <option value="">None / Open Market</option>
                    {suppliers.map((s) => (
                      <option key={s.supplierId} value={s.supplierId}>
                        {s.companyName} {s.phone ? `(${s.phone})` : ''} — {s.name}
                      </option>
                    ))}
                  </select>

                  {formSupplierId && (() => {
                    const selSup = suppliers.find((s) => s.supplierId === formSupplierId);
                    if (!selSup) return null;
                    return (
                      <div className="mt-2 p-2 bg-orange-50/60 border border-orange-200 rounded-lg text-[11px] text-zinc-700 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 truncate">
                          <Truck className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                          <span className="font-semibold truncate">{selSup.companyName}</span>
                          <span className="text-zinc-500 font-mono">({selSup.phone})</span>
                        </div>
                        {selSup.gstin && (
                          <span className="text-[10px] font-mono text-zinc-500 bg-white px-1.5 py-0.5 rounded border border-orange-200 shrink-0">
                            GST: {selSup.gstin}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
                <div>
                  {editingProduct && onDeleteProduct && (
                    <button
                      type="button"
                      onClick={() => {
                        const p = editingProduct;
                        setIsAddProductOpen(false);
                        setEditingProduct(null);
                        setDeleteConfirmProduct(p);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Product</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddProductOpen(false)}
                    className="px-3.5 py-1.5 border border-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold hover:bg-zinc-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    id="btn-save-product-form"
                    className="px-4 py-1.5 bg-black hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    {editingProduct ? 'Save Changes' : 'Create Item'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Comprehensive Product & Supplier Details Modal */}
      {viewDetailsProduct && (() => {
        const prod = viewDetailsProduct;
        const isLow = prod.stockQty <= prod.minimumStock;
        const sup = suppliers.find((s) => s.supplierId === prod.supplierId);
        const marginAmt = prod.sellingPrice - prod.purchasePrice;
        const marginPercent =
          prod.purchasePrice > 0
            ? ((marginAmt / prod.purchasePrice) * 100).toFixed(1)
            : '0';
        const recentMoves = stockTransactions
          .filter((tx) => tx.productId === prod.productId)
          .slice(0, 4);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto border border-zinc-200">
              {/* Header */}
              <div className="flex justify-between items-start pb-3 border-b border-zinc-100">
                <div className="pr-4">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                      {prod.category}
                    </span>
                    {prod.skuCode && (
                      <span className="px-2 py-0.5 rounded-md font-mono text-[11px] bg-slate-100 text-slate-600">
                        SKU: {prod.skuCode}
                      </span>
                    )}
                    {prod.hsnCode && (
                      <span className="px-2 py-0.5 rounded-md font-mono text-[11px] bg-slate-100 text-slate-600">
                        HSN: {prod.hsnCode}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-zinc-950 leading-snug">
                    {prod.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setViewDetailsProduct(null)}
                  className="p-1.5 text-zinc-400 hover:text-black rounded-lg hover:bg-zinc-100 transition-colors shrink-0 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Stock Status & Quick Reorder Bar */}
              <div
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isLow
                    ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    {isLow ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-black">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Low Stock Alert
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        <Check className="w-3.5 h-3.5" />
                        Stock Healthy
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 text-xs font-medium">
                    Current Balance:{' '}
                    <strong className="font-mono text-sm font-bold text-slate-950">
                      {prod.stockQty} {prod.unit}
                    </strong>{' '}
                    <span className="text-slate-500 font-normal">
                      (Minimum Threshold: {prod.minimumStock} {prod.unit})
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setViewDetailsProduct(null);
                    setStockActionModal({ type: 'purchase', product: prod });
                    setStockActionQty(prod.minimumStock * 2 || 20);
                    setStockActionReason('Purchase replenishment');
                    setStockActionSupplier(prod.supplierId || suppliers[0]?.supplierId || '');
                    setStockActionRef(`PO-${Math.floor(1000 + Math.random() * 9000)}`);
                  }}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-orange-500 text-white rounded-lg text-xs font-semibold transition-colors shrink-0 shadow-2xs cursor-pointer"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>Reorder / Stock In</span>
                </button>
              </div>

              {/* Pricing & Profit Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                  <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider block">
                    Selling Price
                  </span>
                  <span className="text-base font-bold text-zinc-900 font-mono mt-0.5 block">
                    {formatINR(prod.sellingPrice)}
                  </span>
                  <span className="text-[10px] text-zinc-400">per {prod.unit}</span>
                </div>

                <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                  <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider block">
                    Cost Price
                  </span>
                  <span className="text-base font-bold text-zinc-700 font-mono mt-0.5 block">
                    {formatINR(prod.purchasePrice)}
                  </span>
                  <span className="text-[10px] text-zinc-400">supplier rate</span>
                </div>

                <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                  <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider block">
                    Margin
                  </span>
                  <span className="text-base font-bold text-emerald-600 font-mono mt-0.5 block">
                    {formatINR(marginAmt)}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-semibold">
                    +{marginPercent}% profit
                  </span>
                </div>

                <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                  <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider block">
                    GST Slab
                  </span>
                  <span className="text-base font-bold text-zinc-900 font-mono mt-0.5 block">
                    {prod.gstRate}%
                  </span>
                  <span className="text-[10px] text-zinc-400">Tax applicable</span>
                </div>
              </div>

              {/* PROMINENT SUPPLIER & DISTRIBUTOR PROFILE */}
              <div className="p-4 bg-orange-50/50 border border-orange-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-orange-950 font-bold text-xs">
                    <Truck className="w-4 h-4 text-orange-600" />
                    <span>Assigned Supplier / Distributor Details</span>
                  </div>
                  {sup && (
                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                      Verified Supplier
                    </span>
                  )}
                </div>

                {sup ? (
                  <div className="space-y-3 pt-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-base font-bold text-zinc-950 flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-orange-600" />
                          <span>{sup.companyName}</span>
                        </h4>
                        <p className="text-xs text-zinc-600 mt-0.5">
                          Contact Person:{' '}
                          <strong className="text-zinc-800 font-semibold">
                            {sup.name}
                          </strong>
                        </p>
                      </div>

                      {/* Direct Call & Email Actions */}
                      <div className="flex items-center gap-2">
                        {sup.phone && (
                          <a
                            href={`tel:${sup.phone}`}
                            className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-black text-xs font-bold rounded-lg transition-colors shadow-2xs"
                            title={`Call ${sup.name}`}
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>Call {sup.phone}</span>
                          </a>
                        )}
                        {sup.email && (
                          <a
                            href={`mailto:${sup.email}`}
                            className="p-1.5 bg-white border border-orange-200 text-zinc-700 hover:text-black rounded-lg transition-colors"
                            title={`Email ${sup.email}`}
                          >
                            <Mail className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Metadata: Address, GSTIN, Balance */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-2 border-t border-orange-200/60">
                      {sup.address && (
                        <div className="flex items-start gap-1.5 text-zinc-600">
                          <MapPin className="w-3.5 h-3.5 text-orange-600 shrink-0 mt-0.5" />
                          <span className="text-[11px] leading-tight">{sup.address}</span>
                        </div>
                      )}
                      {sup.gstin && (
                        <div className="text-[11px] text-zinc-600">
                          <span className="text-zinc-400 block uppercase font-mono text-[9px]">
                            Supplier GSTIN
                          </span>
                          <span className="font-mono font-medium text-zinc-800">
                            {sup.gstin}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-zinc-400 block uppercase font-mono text-[9px]">
                          Payable Balance
                        </span>
                        <span className="font-mono font-bold text-zinc-900 text-xs">
                          {formatINR(sup.balance || 0)}
                        </span>
                      </div>
                    </div>

                    {sup.notes && (
                      <p className="text-[11px] text-zinc-600 bg-white/80 p-2 rounded-lg border border-orange-200/50">
                        <strong>Authorized Brands / Notes:</strong> {sup.notes}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="py-3 text-center space-y-2">
                    <p className="text-xs text-zinc-500">
                      No distributor is assigned to this product. It is currently procured from the open market.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setViewDetailsProduct(null);
                        openEditProductModal(prod);
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-orange-50 border border-orange-300 text-orange-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      Assign a Supplier Now
                    </button>
                  </div>
                )}
              </div>

              {/* Movement History Preview */}
              {recentMoves.length > 0 && (
                <div className="space-y-2 pt-1 border-t border-zinc-100">
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-700">
                    <span>Recent Stock Movements</span>
                    <span className="text-[10px] text-zinc-400">
                      {recentMoves.length} recorded
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {recentMoves.map((tx) => (
                      <div
                        key={tx.id}
                        className="p-2 bg-zinc-50 rounded-lg border border-zinc-100 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              tx.type === 'purchase'
                                ? 'bg-emerald-100 text-emerald-800'
                                : tx.type === 'sale'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-zinc-200 text-zinc-800'
                            }`}
                          >
                            {tx.type.toUpperCase()}
                          </span>
                          <span className="text-zinc-600 text-[11px]">{tx.date}</span>
                          {tx.referenceId && (
                            <span className="text-[10px] font-mono text-zinc-400">
                              Ref: {tx.referenceId}
                            </span>
                          )}
                        </div>
                        <span className="font-mono font-bold text-zinc-900">
                          {tx.type === 'sale' ? '-' : '+'}
                          {Math.abs(tx.quantity)} {prod.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer Actions */}
              <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setViewDetailsProduct(null);
                      openEditProductModal(prod);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Product</span>
                  </button>

                  {onDeleteProduct && (
                    <button
                      type="button"
                      onClick={() => {
                        const p = prod;
                        setViewDetailsProduct(null);
                        setDeleteConfirmProduct(p);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Product</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setViewDetailsProduct(null)}
                  className="px-4 py-2 border border-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CSV Product Bulk Import Modal */}
      <CsvProductImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        suppliers={suppliers}
        existingProducts={products}
        onImportProducts={(items, options) => {
          if (onBulkImportProducts) {
            onBulkImportProducts(items, options);
          } else {
            items.forEach(onSaveProduct);
          }
          setImportNotice(
            `Successfully imported ${items.length} products (${
              options.updateExisting ? 'updated matches & added new items' : 'added as new items'
            }).`
          );
          setTimeout(() => setImportNotice(null), 6000);
        }}
      />

      {/* Manage Product Categories Modal */}
      {isManageCatOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                  <Tags className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base">Product Categories</h3>
                    <span className="px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 text-[11px] font-semibold">
                      {activeCategories.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Add, rename, or customize categories to organize your shop inventory.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsManageCatOpen(false);
                  setNewCatError(null);
                  setEditingCategoryOldName(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-5 overflow-y-auto flex-1">
              {/* Add New Category Box */}
              <div className="p-4 bg-orange-50/60 border border-orange-200/80 rounded-xl space-y-3">
                <label className="block text-xs font-bold text-orange-950 uppercase tracking-wider">
                  Add New Category
                </label>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddNewCategory();
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    id="input-new-category-name"
                    value={newCatInput}
                    onChange={(e) => {
                      setNewCatInput(e.target.value);
                      if (newCatError) setNewCatError(null);
                    }}
                    placeholder="Enter category name (e.g. Solar & Inverters, Submersible Pumps...)"
                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  />
                  <button
                    type="submit"
                    id="btn-submit-add-category"
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs shrink-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Category</span>
                  </button>
                </form>

                {newCatError && (
                  <p className="text-xs text-red-600 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{newCatError}</span>
                  </p>
                )}

                {/* Suggested Categories Chips */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 mb-1.5">
                    Quick suggestions for electrical hardware shops:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Solar & Inverters',
                      'Pumps & Motors',
                      'CCTV & Security',
                      'Geysers & Heating',
                      'Fasteners & Hardware',
                      'Industrial Switchgear',
                      'Fans & Ventilation',
                      'Automation & Smart Home',
                    ]
                      .filter((sug) => !activeCategories.some((c) => c.toLowerCase() === sug.toLowerCase()))
                      .slice(0, 5)
                      .map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => handleAddNewCategory(suggestion)}
                          className="px-2.5 py-1 bg-white hover:bg-orange-100 text-slate-700 hover:text-orange-800 border border-slate-200 rounded-full text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3 h-3 text-orange-600" />
                          <span>{suggestion}</span>
                        </button>
                      ))}
                  </div>
                </div>
              </div>

              {/* Current Categories List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
                  <span>Current Categories</span>
                  <span>{activeCategories.length} total</span>
                </div>

                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white max-h-72 overflow-y-auto">
                  {activeCategories.map((cat) => {
                    const productCount = products.filter((p) => p.category === cat).length;
                    const isEditing = editingCategoryOldName === cat;

                    return (
                      <div
                        key={cat}
                        className="px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                      >
                        {isEditing ? (
                          <div className="flex-1 flex items-center gap-2">
                            <input
                              type="text"
                              value={editingCategoryNewName}
                              onChange={(e) => setEditingCategoryNewName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveRename(cat);
                                } else if (e.key === 'Escape') {
                                  setEditingCategoryOldName(null);
                                }
                              }}
                              className="flex-1 px-2.5 py-1 text-xs font-semibold bg-white border border-orange-500 rounded focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveRename(cat)}
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer transition-colors"
                              title="Save new category name"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCategoryOldName(null)}
                              className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded cursor-pointer transition-colors"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Tag className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                              <span className="font-semibold text-slate-800 text-xs truncate">{cat}</span>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium shrink-0 ${
                                  productCount > 0
                                    ? 'bg-slate-100 text-slate-700'
                                    : 'bg-zinc-100 text-zinc-400'
                                }`}
                              >
                                {productCount} {productCount === 1 ? 'item' : 'items'}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartRename(cat)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded transition-colors"
                                title={`Rename "${cat}"`}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCategoryPrompt(cat)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title={`Delete "${cat}"`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsManageCatOpen(false);
                  setNewCatError(null);
                  setEditingCategoryOldName(null);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Category Reassignment Modal */}
      {deleteCatModal && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 text-sm">
                  Delete Category & Reassign Products
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The category <strong className="text-slate-900">"{deleteCatModal.category}"</strong> has{' '}
                  <strong className="text-orange-600">{deleteCatModal.productCount}</strong> product(s) linked to it.
                  Select which category to reassign these products to:
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Reassign products to:
              </label>
              <select
                value={deleteCatModal.fallbackCategory}
                onChange={(e) =>
                  setDeleteCatModal({
                    ...deleteCatModal,
                    fallbackCategory: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-orange-500"
              >
                {activeCategories
                  .filter((c) => c.toLowerCase() !== deleteCatModal.category.toLowerCase())
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteCatModal(null)}
                className="px-3.5 py-1.5 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteWithFallback}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                Reassign & Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Product Confirmation Modal */}
      {deleteConfirmProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-zinc-200 animate-scale-up">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-zinc-950">Delete Product?</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Are you sure you want to permanently remove this electrical item from inventory?
                </p>
              </div>
            </div>

            {/* Product Details Card */}
            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-1.5 text-xs">
              <div className="flex items-center justify-between font-semibold text-zinc-900">
                <span>{deleteConfirmProduct.name}</span>
                <span className="font-mono text-zinc-700">{formatINR(deleteConfirmProduct.sellingPrice)}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500">
                <span>Category: <strong className="text-zinc-700">{deleteConfirmProduct.category}</strong></span>
                {deleteConfirmProduct.skuCode && (
                  <span>• SKU: <strong className="font-mono text-zinc-700">{deleteConfirmProduct.skuCode}</strong></span>
                )}
                <span>• Stock: <strong className="text-zinc-700">{deleteConfirmProduct.stockQty} {deleteConfirmProduct.unit}</strong></span>
              </div>
            </div>

            {/* Warning if stock > 0 */}
            {deleteConfirmProduct.stockQty > 0 && (
              <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Warning: There are currently <strong>{deleteConfirmProduct.stockQty} {deleteConfirmProduct.unit}</strong> remaining in stock. Deleting this product will remove it from active inventory and billing lookups.
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmProduct(null)}
                className="px-4 py-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 font-medium text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteProduct) {
                    onDeleteProduct(deleteConfirmProduct.productId);
                  }
                  setDeleteConfirmProduct(null);
                }}
                className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer"
              >
                Delete Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
