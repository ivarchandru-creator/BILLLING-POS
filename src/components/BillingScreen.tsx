import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  CheckCircle2,
  Smartphone,
  CreditCard,
  Banknote,
  FileText,
  ShoppingCart,
  Percent,
  X,
  Receipt,
  RotateCcw,
  Sparkles,
  Info,
  Check,
  Calendar,
  User,
  Phone,
  MapPin,
  Building2,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { Product, InvoiceItem, Invoice, PaymentMethod, ShopSettings, Customer } from '../types';
import { formatINR, generateInvoiceNumber, getCurrentDateTimeFormatted } from '../utils/formatters';
import { loadDraftBilling, saveDraftBilling, clearDraftBilling, loadRecentBillingProductIds, saveRecentBillingProductIds } from '../utils/storage';

interface BillingScreenProps {
  products: Product[];
  invoices: Invoice[];
  settings: ShopSettings;
  customers?: Customer[];
  onSaveInvoice: (invoice: Invoice) => void;
  onPreviewInvoice: (invoice: Invoice) => void;
  onAddCustomer?: (customer: Customer) => void;
  onCartCountChange?: (count: number) => void;
}

export const BillingScreen: React.FC<BillingScreenProps> = ({
  products,
  invoices,
  settings,
  customers = [],
  onSaveInvoice,
  onPreviewInvoice,
  onAddCustomer,
  onCartCountChange,
}) => {
  // Product Search
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const handleCompleteSaleRef = useRef<(forceNew?: boolean) => void>(() => {});
  const handlePrintBillRef = useRef<() => void>(() => {});

  // Restore draft state from localStorage if available
  const initialDraft = useMemo(() => loadDraftBilling(), []);

  // Cart / Line Items (preserved across sections & browser reloads)
  const [cartItems, setCartItems] = useState<InvoiceItem[]>(() => initialDraft?.cartItems || []);

  // GST Mode: Cash Memo (Default) vs GST Tax Invoice (Optional)
  const [isGstBill, setIsGstBill] = useState(() => initialDraft?.isGstBill ?? (settings.defaultGstOn ?? false));
  const [overrideGstRate, setOverrideGstRate] = useState<number>(() => initialDraft?.overrideGstRate ?? (settings.defaultGstRate || 18));

  // Customer State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(() => initialDraft?.selectedCustomerId || 'walk-in');
  const [customerName, setCustomerName] = useState(() => {
    if (initialDraft?.customerName === 'Walk-in Customer (General)') return '';
    return initialDraft?.customerName ?? '';
  });
  const [customerPhone, setCustomerPhone] = useState(() => initialDraft?.customerPhone ?? '');
  const [customerAddress, setCustomerAddress] = useState(() => initialDraft?.customerAddress ?? '');
  const [customerGstin, setCustomerGstin] = useState(() => initialDraft?.customerGstin ?? '');
  const [customerCategory, setCustomerCategory] = useState<'walk-in' | 'electrician' | 'contractor' | 'wholesale' | 'retail'>(
    () => initialDraft?.customerCategory || 'walk-in'
  );

  // Credit Payment Due Date State (Default +7 days)
  const [paymentDueDate, setPaymentDueDate] = useState<string>(() => {
    if (initialDraft?.paymentDueDate) return initialDraft.paymentDueDate;
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });

  // Selected customer details
  const currentCustomer = useMemo(() => {
    return customers.find((c) => c.customerId === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  // Payment Method
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() => initialDraft?.paymentMethod || 'cash');

  // Recently Added Products for quick access under search bar
  const [recentProductIds, setRecentProductIds] = useState<string[]>(() => {
    const saved = loadRecentBillingProductIds();
    if (saved && saved.length > 0) return saved;
    const fromInvoices = (invoices || [])
      .slice()
      .reverse()
      .flatMap((inv) => inv.items.map((it) => it.productId))
      .filter(Boolean);
    const initial = Array.from(new Set(fromInvoices));
    if (initial.length > 0) return initial.slice(0, 10);
    return products.slice(0, 8).map((p) => p.productId);
  });

  const addRecentProduct = (productId: string) => {
    setRecentProductIds((prev) => {
      const updated = [productId, ...prev.filter((id) => id !== productId)].slice(0, 16);
      saveRecentBillingProductIds(updated);
      return updated;
    });
  };

  const recentProducts = useMemo(() => {
    return recentProductIds
      .map((id) => products.find((p) => p.productId === id))
      .filter((p): p is Product => Boolean(p));
  }, [recentProductIds, products]);

  // Cash Tendered & Change Due
  const [cashTendered, setCashTendered] = useState<string>(() => initialDraft?.cashTendered ?? '');

  // Discount: Amount in ₹ by default, with Percentage as an option
  const [discountType, setDiscountType] = useState<'amount' | 'percentage'>(
    () => initialDraft?.discountType || (initialDraft?.discountAmount ? 'amount' : initialDraft?.discountPercent ? 'percentage' : 'amount')
  );
  const [discountAmountInput, setDiscountAmountInput] = useState<string>(() => {
    if (initialDraft?.discountAmount !== undefined && initialDraft.discountAmount > 0) {
      return String(initialDraft.discountAmount);
    }
    return '';
  });
  const [discountPercentInput, setDiscountPercentInput] = useState<string>(() => {
    if (initialDraft?.discountPercent !== undefined && initialDraft.discountPercent > 0) {
      return String(initialDraft.discountPercent);
    }
    return '';
  });

  // Active Invoice Session
  const [activeInvoiceSession, setActiveInvoiceSession] = useState<{
    invoiceId: string;
    invoiceNumber: string;
  } | null>(() => {
    if (initialDraft?.activeInvoiceId && initialDraft?.activeInvoiceNumber) {
      return {
        invoiceId: initialDraft.activeInvoiceId,
        invoiceNumber: initialDraft.activeInvoiceNumber,
      };
    }
    return null;
  });

  // Selected Product IDs in Cart (for deleting selected products or bulk actions)
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Notification Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (text: string) => {
    setToastMsg(text);
    setTimeout(() => setToastMsg(null), 2500);
  };

  // Financial Calculations
  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.lineTotal, 0);
  }, [cartItems]);

  const { discountAmount, effectiveDiscountPercent } = useMemo(() => {
    if (discountType === 'amount') {
      const rawAmt = parseFloat(discountAmountInput) || 0;
      const validAmt = Math.max(0, Math.min(subtotal, rawAmt));
      const pct = subtotal > 0 ? (validAmt / subtotal) * 100 : 0;
      return {
        discountAmount: validAmt,
        effectiveDiscountPercent: Math.round(pct * 100) / 100,
      };
    } else {
      const rawPct = parseFloat(discountPercentInput) || 0;
      const validPct = Math.max(0, Math.min(100, rawPct));
      const amt = (subtotal * validPct) / 100;
      return {
        discountAmount: Math.round(amt * 100) / 100,
        effectiveDiscountPercent: validPct,
      };
    }
  }, [discountType, discountAmountInput, discountPercentInput, subtotal]);

  const discountedSubtotal = Math.max(0, subtotal - discountAmount);

  // Switch between Amount (₹) and Percentage (%) mode
  const handleDiscountTypeChange = (newType: 'amount' | 'percentage') => {
    if (newType === discountType) return;
    setDiscountType(newType);

    if (newType === 'percentage') {
      const curAmt = parseFloat(discountAmountInput) || 0;
      if (curAmt > 0 && subtotal > 0) {
        const pct = Math.round((curAmt / subtotal) * 1000) / 10;
        setDiscountPercentInput(String(Math.min(100, pct)));
      }
    } else {
      const curPct = parseFloat(discountPercentInput) || 0;
      if (curPct > 0 && subtotal > 0) {
        const amt = Math.round((subtotal * curPct) / 100);
        setDiscountAmountInput(String(amt));
      }
    }
  };

  // Sync draft state to localStorage & notify parent component of active cart item count
  useEffect(() => {
    onCartCountChange?.(cartItems.length);
    const hasDiscount = Boolean(
      (discountType === 'amount' && parseFloat(discountAmountInput) > 0) ||
      (discountType === 'percentage' && parseFloat(discountPercentInput) > 0)
    );
    if (
      cartItems.length > 0 ||
      customerPhone.trim() ||
      customerAddress.trim() ||
      customerGstin.trim() ||
      hasDiscount ||
      (customerName && customerName !== 'Walk-in Customer (General)')
    ) {
      saveDraftBilling({
        cartItems,
        selectedCustomerId,
        customerName,
        customerPhone,
        customerAddress,
        customerGstin,
        customerCategory,
        paymentMethod,
        paymentDueDate,
        isGstBill,
        overrideGstRate,
        discountType,
        discountAmount: discountType === 'amount' ? (parseFloat(discountAmountInput) || 0) : discountAmount,
        discountPercent: effectiveDiscountPercent,
        cashTendered,
        activeInvoiceId: activeInvoiceSession?.invoiceId,
        activeInvoiceNumber: activeInvoiceSession?.invoiceNumber,
      });
    } else {
      clearDraftBilling();
    }
  }, [
    cartItems,
    selectedCustomerId,
    customerName,
    customerPhone,
    customerAddress,
    customerGstin,
    customerCategory,
    paymentMethod,
    paymentDueDate,
    isGstBill,
    overrideGstRate,
    discountType,
    discountAmountInput,
    discountPercentInput,
    discountAmount,
    effectiveDiscountPercent,
    cashTendered,
    activeInvoiceSession,
    onCartCountChange,
  ]);


  // If neither name nor mobile number is entered, automatically set category to walk-in general
  useEffect(() => {
    if (!customerName.trim() && !customerPhone.trim()) {
      if (customerCategory !== 'walk-in') {
        setCustomerCategory('walk-in');
      }
    }
  }, [customerName, customerPhone, customerCategory]);

  // Close search results dropdown when clicking outside search container
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Keyboard Shortcuts (Ctrl+F for search, F12 for Checkout, Escape to close search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        setIsSearchFocused(true);
      } else if (e.key === 'Escape') {
        setIsSearchFocused(false);
      } else if ((e.key === 'F12' || (e.ctrlKey && e.key === 'Enter')) && cartItems.length > 0) {
        e.preventDefault();
        handleCompleteSaleRef.current?.();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p' && cartItems.length > 0) {
        e.preventDefault();
        handlePrintBillRef.current?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartItems.length]);

  // Filtered Products for Search Autocomplete (expanded for multi-product selection)
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          Boolean(p.skuCode && p.skuCode.toLowerCase().includes(query)) ||
          p.category.toLowerCase().includes(query) ||
          (p.hsnCode && p.hsnCode.includes(query))
      )
      .slice(0, 30);
  }, [products, searchQuery]);

  // Product Search submit event
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    if (searchResults.length > 0) {
      handleAddToCart(searchResults[0]);
    } else {
      showToast(`No product found matching: ${searchQuery}`);
    }
  };

  // Add Product to Cart - Keeps search active so user can add multiple items from one search!
  const handleAddToCart = (product: Product, customQty = 1) => {
    addRecentProduct(product.productId);
    setCartItems((prev) => {
      const existing = prev.find((item) => item.productId === product.productId);
      if (existing) {
        const newQty = existing.quantity + customQty;
        return prev.map((item) =>
          item.productId === product.productId
            ? {
                ...item,
                quantity: newQty,
                lineTotal: newQty * item.unitPrice,
              }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.productId,
          productNameSnapshot: product.name,
          quantity: customQty,
          unitPrice: product.sellingPrice,
          lineTotal: customQty * product.sellingPrice,
          gstRate: isGstBill ? product.gstRate : 0,
          unit: product.unit,
          hsnCode: product.hsnCode,
        },
      ];
    });

    // NOTE: Keep search input and search results OPEN!
    // Do NOT wipe searchQuery or close isSearchFocused!
    showToast(`Added ${product.name}`);
  };

  // Adjust Quantity
  const handleUpdateQty = (productId: string, delta: number) => {
    setCartItems((prev) => {
      const target = prev.find((item) => item.productId === productId);
      if (target && target.quantity + delta <= 0) {
        setSelectedProductIds((s) => s.filter((id) => id !== productId));
        return prev.filter((item) => item.productId !== productId);
      }
      return prev.map((item) => {
        if (item.productId === productId) {
          const newQty = item.quantity + delta;
          return {
            ...item,
            quantity: newQty,
            lineTotal: newQty * item.unitPrice,
          };
        }
        return item;
      });
    });
  };

  // Edit Unit Price directly (for Electrician / Contractor discount)
  const handleUpdatePrice = (productId: string, newPrice: number) => {
    if (newPrice < 0) return;
    setCartItems((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? {
              ...item,
              unitPrice: newPrice,
              lineTotal: item.quantity * newPrice,
            }
          : item
      )
    );
  };

  // Remove Item
  const handleRemoveItem = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.productId !== productId));
    setSelectedProductIds((prev) => prev.filter((id) => id !== productId));
  };

  // Toggle Selection for a Product
  const toggleSelectProduct = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  // Toggle Select All Products
  const toggleSelectAll = () => {
    if (selectedProductIds.length === cartItems.length && cartItems.length > 0) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(cartItems.map((item) => item.productId));
    }
  };

  // Delete Selected Products from Cart
  const handleDeleteSelectedProducts = () => {
    if (selectedProductIds.length === 0) return;
    const count = selectedProductIds.length;
    setCartItems((prev) => prev.filter((item) => !selectedProductIds.includes(item.productId)));
    setSelectedProductIds([]);
    showToast(`Deleted ${count} selected product${count > 1 ? 's' : ''} from bill`);
  };

  // Split into Taxable + CGST + SGST (or 0 if Non-GST Cash Memo)
  const { taxableAmount, cgstAmount, sgstAmount, totalGst, grandTotal } = useMemo(() => {
    if (!isGstBill) {
      const roundedTotal = Math.round(discountedSubtotal);
      return {
        taxableAmount: roundedTotal,
        cgstAmount: 0,
        sgstAmount: 0,
        totalGst: 0,
        grandTotal: roundedTotal,
      };
    }

    // Standard Indian GST calculation
    const avgRate = overrideGstRate || 18;
    const taxable = Math.round((discountedSubtotal / (1 + avgRate / 100)) * 100) / 100;
    const tax = Math.round((discountedSubtotal - taxable) * 100) / 100;
    const cgst = Math.round((tax / 2) * 100) / 100;
    const sgst = Math.round((tax - cgst) * 100) / 100;
    return {
      taxableAmount: taxable,
      cgstAmount: cgst,
      sgstAmount: sgst,
      totalGst: tax,
      grandTotal: Math.round(discountedSubtotal),
    };
  }, [discountedSubtotal, isGstBill, overrideGstRate]);

  // Cash Change Calculation
  const cashNum = parseFloat(cashTendered) || 0;
  const changeDue = cashNum > 0 ? Math.max(0, cashNum - grandTotal) : 0;



  // Clear Cart & Reset for Next Customer:
  // Every product is deleted from the invoice section ONLY when Clear All is clicked!
  const handleClearCart = () => {
    const itemCount = cartItems.length;
    setCartItems([]);
    setSelectedProductIds([]);
    clearDraftBilling();
    setActiveInvoiceSession(null);
    setDiscountType('amount');
    setDiscountAmountInput('');
    setDiscountPercentInput('');
    setCashTendered('');
    setSelectedCustomerId('walk-in');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setCustomerGstin('');
    setCustomerCategory('walk-in');
    setIsGstBill(settings.defaultGstOn ?? false);
    showToast(itemCount > 0 ? 'All products deleted. New invoice ready.' : 'Invoice reset for new customer.');
  };

  // Helper to build the Invoice object snapshot
  const buildCurrentInvoice = (forceNewId: boolean = false): Invoice => {
    const isUpdatingExisting = !forceNewId && Boolean(activeInvoiceSession?.invoiceId);
    const targetInvoiceId = isUpdatingExisting ? activeInvoiceSession!.invoiceId : `inv-${Date.now()}`;
    const targetInvoiceNumber = isUpdatingExisting ? activeInvoiceSession!.invoiceNumber : generateInvoiceNumber(invoices);

    const hasEnteredName = Boolean(customerName.trim() && customerName.trim() !== 'Walk-in Customer (General)');
    const hasEnteredPhone = Boolean(customerPhone.trim());
    const isAutoWalkIn = !hasEnteredName && !hasEnteredPhone;

    const resolvedCustomerName = isAutoWalkIn
      ? 'Walk-in Customer (General)'
      : (customerName.trim() || 'Walk-in Customer (General)');

    const resolvedCategory = isAutoWalkIn ? 'walk-in' : (customerCategory || 'walk-in');

    return {
      invoiceId: targetInvoiceId,
      invoiceNumber: targetInvoiceNumber,
      dateTime: getCurrentDateTimeFormatted(),
      customerId: selectedCustomerId !== 'new' && selectedCustomerId !== 'walk-in' ? selectedCustomerId : undefined,
      customerName: resolvedCustomerName,
      customerPhone: customerPhone.trim() || undefined,
      customerAddress: customerAddress.trim() || undefined,
      customerGstin: customerGstin.trim() || undefined,
      customerCategory: resolvedCategory,
      items: [...cartItems],
      subtotal,
      discountType,
      discountAmount,
      discountPercent: effectiveDiscountPercent,
      gstApplied: isGstBill,
      gstRate: isGstBill ? overrideGstRate : 0,
      gstAmount: totalGst,
      cgstAmount,
      sgstAmount,
      grandTotal,
      paymentMethod,
      paymentDueDate: paymentMethod === 'credit' ? paymentDueDate : undefined,
      creditPaid: paymentMethod === 'credit' ? false : true,
      creditPaidDate: paymentMethod === 'credit' ? undefined : getCurrentDateTimeFormatted(),
      printerType: settings.defaultPrinterType,
      templateType: settings.thermalPaperWidth,
      createdBy: settings.ownerName || 'Tpk Chandru',
      status: 'completed',
    };
  };

  // 1. Print / Preview Bill:
  // After printing, previously selected items are NOT deleted.
  // Items remain in the invoice section so if the customer asks for any more products,
  // it is easy to add products and print again!
  const handlePrintBill = () => {
    if (cartItems.length === 0) {
      showToast('Cart is empty. Please add products to print bill.');
      return;
    }
    const invoiceToPrint = buildCurrentInvoice();
    onPreviewInvoice(invoiceToPrint);
    showToast(`Bill #${invoiceToPrint.invoiceNumber} opened for printing. Products kept in invoice.`);
  };

  handlePrintBillRef.current = handlePrintBill;

  // 2. Complete Bill:
  // Sales are recorded in Sales History ONLY when Complete Bill is clicked.
  // All products REMAIN in the invoice section until the user explicitly clicks "Clear All".
  const handleCompleteSale = () => {
    if (cartItems.length === 0) {
      showToast('Cart is empty. Please add products to complete bill.');
      return;
    }

    const hasEnteredName = Boolean(customerName.trim() && customerName.trim() !== 'Walk-in Customer (General)');
    const hasEnteredPhone = Boolean(customerPhone.trim());
    const isAutoWalkIn = !hasEnteredName && !hasEnteredPhone;

    if (paymentMethod === 'credit') {
      if (isAutoWalkIn && selectedCustomerId === 'walk-in') {
        showToast('Please enter customer name or mobile for credit (udhar) bill');
        return;
      }
      if (!paymentDueDate) {
        showToast('Please select expected paying date for credit bill');
        return;
      }
    }

    const isUpdatingExisting = Boolean(activeInvoiceSession?.invoiceId);
    const invoiceToSave = buildCurrentInvoice();

    // 1. Record the sale in Sales History & update inventory stock
    onSaveInvoice(invoiceToSave);

    // 2. Mark active invoice session so subsequent edits update this bill
    setActiveInvoiceSession({
      invoiceId: invoiceToSave.invoiceId,
      invoiceNumber: invoiceToSave.invoiceNumber,
    });

    // 3. Open print modal / preview
    onPreviewInvoice(invoiceToSave);

    // 4. NOTICE: Products are KEPT in the invoice section!
    // They are NOT deleted until the user clicks "Clear All".
    if (isUpdatingExisting) {
      showToast(`Bill #${invoiceToSave.invoiceNumber} updated in Sales History! Items kept in bill.`);
    } else {
      showToast(`Bill #${invoiceToSave.invoiceNumber} recorded in Sales History! Items kept in bill.`);
    }
  };

  handleCompleteSaleRef.current = handleCompleteSale;

  return (
    <div className="w-full h-full p-4 sm:p-6 overflow-y-auto space-y-6 bg-slate-50 font-sans">
      {/* Toast feedback */}
      {toastMsg && (
        <div className="fixed top-16 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5 animate-fade-in font-medium text-xs sm:text-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">New Invoice</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-orange-100 text-orange-800">
              #{activeInvoiceSession?.invoiceNumber || generateInvoiceNumber(invoices)}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Quick POS Billing Counter & Checkout
          </p>
        </div>

        {/* Bill Mode: Cash Memo (Default) vs GST Bill (Optional) */}
        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center bg-slate-200/70 p-1 rounded-xl text-xs font-medium">
            <button
              type="button"
              id="btn-mode-cash-memo"
              onClick={() => {
                setIsGstBill(false);
                setCartItems((prev) =>
                  prev.map((item) => ({
                    ...item,
                    gstRate: 0,
                  }))
                );
              }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-medium ${
                !isGstBill
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Cash Memo (Default non-tax invoice)"
            >
              Cash Memo (Default)
            </button>
            <button
              type="button"
              id="btn-mode-gst-bill"
              onClick={() => {
                setIsGstBill(true);
                setCartItems((prev) =>
                  prev.map((item) => {
                    const matchedProd = products.find((p) => p.productId === item.productId);
                    return {
                      ...item,
                      gstRate: matchedProd?.gstRate ?? overrideGstRate ?? 18,
                    };
                  })
                );
              }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-medium ${
                isGstBill
                  ? 'bg-orange-500 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="GST Bill (Optional for B2B or GST registered customers)"
            >
              GST Bill (Optional)
            </button>
          </div>
        </div>
      </div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Product Search & Line Items (~65% width) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Product Search Bar + Clear All Button */}
          <div className="flex items-center gap-2.5">
            <div ref={searchContainerRef} className="relative flex-1">
              <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  id="input-product-search"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (!isSearchFocused) setIsSearchFocused(true);
                  }}
                  onFocus={() => setIsSearchFocused(true)}
                  placeholder="Search product by name, brand, or SKU... (Ctrl+F)"
                  className="w-full pl-10 pr-10 py-2.5 bg-white rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all shadow-xs font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    id="btn-clear-search-query"
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </form>

              {/* Product Search Results Dropdown */}
              {isSearchFocused && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl z-30 overflow-hidden flex flex-col max-h-80 animate-fade-in">
                  {searchResults.length > 0 ? (
                    <>
                      {/* Header with single close button */}
                      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs shrink-0 font-medium">
                        <span className="font-semibold text-slate-700">Product Matches ({searchResults.length})</span>
                        <button
                          type="button"
                          id="btn-close-search-results"
                          onClick={() => setIsSearchFocused(false)}
                          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
                          title="Close"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Product List */}
                      <div className="overflow-y-auto divide-y divide-slate-100">
                        {searchResults.map((prod) => (
                          <div
                            key={prod.productId}
                            className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-orange-50/50 transition-colors text-xs"
                          >
                            <div className="min-w-0 pr-3">
                              <p className="font-bold text-slate-900 truncate">{prod.name}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {prod.category} • Stock: {prod.stockQty} {prod.unit}
                                {prod.skuCode ? ` • SKU: ${prod.skuCode}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="font-bold text-slate-900 font-mono">{formatINR(prod.sellingPrice)}</span>
                              <button
                                type="button"
                                onClick={() => handleAddToCart(prod)}
                                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-semibold text-xs rounded-lg transition-all cursor-pointer shadow-xs flex items-center gap-1"
                                title="Add product to cart"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    searchQuery.trim() ? (
                      <div className="px-4 py-3 flex items-center justify-between text-xs text-slate-500">
                        <span>No products found matching "{searchQuery}"</span>
                        <button
                          type="button"
                          onClick={() => setIsSearchFocused(false)}
                          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
                          title="Close"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : null
                  )}
                </div>
              )}
            </div>

            {/* Clear All Button right near search bar */}
            <button
              type="button"
              id="btn-clear-cart"
              onClick={handleClearCart}
              disabled={cartItems.length === 0}
              className={`px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all shrink-0 shadow-xs ${
                cartItems.length > 0
                  ? 'bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-600 border-slate-200 hover:border-rose-200 cursor-pointer active:scale-[0.98]'
                  : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
              }`}
              title="Clear all products from invoice and start new customer bill"
            >
              <Trash2 className={`w-4 h-4 ${cartItems.length > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
              <span>Clear All</span>
            </button>
          </div>

          {/* Simple Recently Added Products Row */}
          {recentProducts.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-thin text-xs">
              <span className="text-slate-400 shrink-0 font-medium text-[11px]">Quick Add:</span>
              <div className="flex items-center gap-1.5 flex-nowrap">
                {recentProducts.map((prod) => (
                  <button
                    key={prod.productId}
                    type="button"
                    id={`btn-recent-prod-${prod.productId}`}
                    onClick={() => handleAddToCart(prod)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-orange-50/60 border border-slate-200 hover:border-orange-300 rounded-xl text-slate-700 hover:text-orange-950 transition-all cursor-pointer shrink-0 shadow-2xs text-xs active:scale-[0.98]"
                    title={`Add ${prod.name} (${formatINR(prod.sellingPrice)})`}
                  >
                    <span className="font-medium truncate max-w-[140px]">{prod.name}</span>
                    <span className="font-bold text-slate-900 font-mono">{formatINR(prod.sellingPrice)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Line Items Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden min-h-[360px] flex flex-col">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <ShoppingCart className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-bold text-slate-900">
                  Line Items ({cartItems.length})
                </h2>
                {selectedProductIds.length > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-100 text-orange-800">
                    {selectedProductIds.length} selected
                  </span>
                )}
              </div>
              {cartItems.length > 0 && selectedProductIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    id="btn-delete-selected"
                    onClick={handleDeleteSelectedProducts}
                    className="text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 font-semibold px-3 py-1.5 rounded-xl border border-rose-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Delete selected products from this bill"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>Delete Selected ({selectedProductIds.length})</span>
                  </button>
                </div>
              )}
            </div>

            {/* Line Items Content */}
            <div className="flex-1 flex flex-col">
              {cartItems.length === 0 ? (
                /* Empty Cart State */
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mb-3 shadow-2xs">
                    <ShoppingCart className="w-7 h-7 stroke-[1.5]" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">Cart is empty</h3>
                </div>
              ) : (
                /* Cart Table with editable price for trade discounts and multi-select checkboxes */
                <div className="overflow-x-auto divide-y divide-slate-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/70 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-100">
                      <tr>
                        <th className="py-3 px-3 text-center w-10">
                          <input
                            type="checkbox"
                            id="select-all-products"
                            checked={selectedProductIds.length === cartItems.length && cartItems.length > 0}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded text-orange-500 border-slate-300 focus:ring-orange-500 cursor-pointer"
                            title="Select / deselect all products"
                          />
                        </th>
                        <th className="py-3 px-3">Item & Specification</th>
                        <th className="py-3 px-3 text-right">Unit Rate (₹)</th>
                        <th className="py-3 px-4 text-center">Qty</th>
                        {isGstBill && <th className="py-3 px-3 text-right">GST %</th>}
                        <th className="py-3 px-4 text-right">Total</th>
                        <th className="py-3 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cartItems.map((item) => {
                        const isSelected = selectedProductIds.includes(item.productId);
                        return (
                          <tr
                            key={item.productId}
                            className={`transition-colors ${isSelected ? 'bg-orange-50/40' : 'hover:bg-slate-50/60'}`}
                          >
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                id={`select-product-${item.productId}`}
                                checked={isSelected}
                                onChange={() => toggleSelectProduct(item.productId)}
                                className="w-4 h-4 rounded text-orange-500 border-slate-300 focus:ring-orange-500 cursor-pointer"
                                title={`Select ${item.productNameSnapshot}`}
                              />
                            </td>
                            <td className="py-3 px-3">
                              <p className="font-bold text-slate-900">{item.productNameSnapshot}</p>
                              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                                Unit: {item.unit} {item.hsnCode ? `• HSN: ${item.hsnCode}` : ''}
                              </p>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <input
                                type="number"
                                min="0"
                                value={item.unitPrice}
                                onChange={(e) =>
                                  handleUpdatePrice(item.productId, Number(e.target.value) || 0)
                                }
                                className="w-20 px-2 py-1 text-right font-mono font-bold text-slate-900 border border-slate-200 hover:border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 rounded-lg bg-white shadow-2xs"
                                title="Click to override rate for electrician/contractor"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQty(item.productId, -1)}
                                  className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold flex items-center justify-center transition-all cursor-pointer shadow-2xs active:scale-95"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-8 text-center font-bold text-slate-900 font-mono text-xs">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQty(item.productId, 1)}
                                  className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold flex items-center justify-center transition-all cursor-pointer shadow-2xs active:scale-95"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            {isGstBill && (
                              <td className="py-3 px-3 text-right text-slate-600 font-mono text-[11px] font-semibold">
                                {item.gstRate}%
                              </td>
                            )}
                            <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                              {formatINR(item.lineTotal)}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.productId)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Remove item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Checkout Panel (~35% width) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-5">
          {/* Customer Details Form */}
          <div className="space-y-3 p-4 bg-slate-50/70 rounded-xl border border-slate-200/70">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span>Customer Details</span>
                <span className="text-slate-400 font-normal text-[11px] lowercase">(optional)</span>
              </label>
              {selectedCustomerId !== 'new' && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomerId('new');
                    setCustomerName('');
                    setCustomerPhone('');
                    setCustomerAddress('');
                    setCustomerGstin('');
                    setCustomerCategory('walk-in');
                  }}
                  className="text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors cursor-pointer"
                >
                  + New Customer
                </button>
              )}
            </div>

            {/* Quick Pick from Existing Customers */}
            <div>
              <select
                id="select-customer"
                value={selectedCustomerId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedCustomerId(val);
                  if (val === 'new') {
                    setCustomerName('');
                    setCustomerPhone('');
                    setCustomerAddress('');
                    setCustomerGstin('');
                    setCustomerCategory('walk-in');
                  } else if (val === 'walk-in') {
                    setCustomerName('');
                    setCustomerPhone('');
                    setCustomerAddress('');
                    setCustomerGstin('');
                    setCustomerCategory('walk-in');
                  } else {
                    const found = customers.find((c) => c.customerId === val);
                    if (found) {
                      setCustomerName(found.name);
                      setCustomerPhone(found.phone || '');
                      setCustomerAddress(found.siteAddress || found.address || '');
                      setCustomerGstin(found.gstin || '');
                      setCustomerCategory((found.customerType as any) || 'walk-in');
                    }
                  }
                }}
                className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 font-medium"
              >
                <option value="walk-in">⚡ Walk-in Customer (Retail)</option>
                <option value="new">+ Enter New Customer</option>
                {customers
                  .filter((c) => c.customerId !== 'cust-1')
                  .map((c) => (
                    <option key={c.customerId} value={c.customerId}>
                      {c.name} {c.phone ? `(${c.phone})` : `(${c.customerType})`}
                    </option>
                  ))}
              </select>
            </div>

            {/* Customer Name and Mobile Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Walk-in Customer"
                  className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Mobile
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="10-digit mobile"
                  className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 font-medium"
                />
              </div>
            </div>

            {/* Site Address */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Site Address
              </label>
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="e.g. Site #14, Royal Garden Apts"
                className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-orange-500 font-medium"
              />
            </div>

            {/* GST Number & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  GSTIN
                </label>
                <input
                  type="text"
                  value={customerGstin}
                  onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                  placeholder="33AAAAA0000A1Z5"
                  className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-xs font-mono uppercase text-slate-900 focus:outline-none focus:border-orange-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Category
                </label>
                <select
                  value={customerCategory}
                  onChange={(e) => setCustomerCategory(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-orange-500 capitalize font-medium"
                >
                  <option value="walk-in">Walk-in / Retail</option>
                  <option value="electrician">Electrician</option>
                  <option value="contractor">Contractor</option>
                  <option value="wholesale">Wholesale</option>
                  <option value="retail">Retail / Home</option>
                </select>
              </div>
            </div>

            {/* Customer Trade info / Khata Due Badge */}
            {currentCustomer && currentCustomer.customerId !== 'cust-1' && (
              <div className="bg-orange-50/80 p-2.5 rounded-lg border border-orange-200 flex items-center justify-between text-xs">
                <span className="text-orange-950 font-medium">
                  Previous Due:
                </span>
                <span className="font-mono text-orange-950 font-bold">
                  {formatINR(currentCustomer.creditBalance || 0)}
                </span>
              </div>
            )}
          </div>

          {/* Payment Method 2x2 Grid */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Payment Method</label>
            <div className="grid grid-cols-2 gap-2">
              {/* Cash */}
              <button
                type="button"
                id="btn-pay-cash"
                onClick={() => setPaymentMethod('cash')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  paymentMethod === 'cash'
                    ? 'bg-orange-500 text-white font-bold border-orange-500 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>Cash</span>
              </button>

              {/* UPI */}
              <button
                type="button"
                id="btn-pay-upi"
                onClick={() => setPaymentMethod('upi')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  paymentMethod === 'upi'
                    ? 'bg-orange-500 text-white font-bold border-orange-500 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>UPI</span>
              </button>

              {/* Card */}
              <button
                type="button"
                id="btn-pay-card"
                onClick={() => setPaymentMethod('card')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  paymentMethod === 'card'
                    ? 'bg-orange-500 text-white font-bold border-orange-500 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Card</span>
              </button>

              {/* Credit (Due) */}
              <button
                type="button"
                id="btn-pay-credit"
                onClick={() => setPaymentMethod('credit')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  paymentMethod === 'credit'
                    ? 'bg-orange-500 text-white font-bold border-orange-500 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Credit (Due)</span>
              </button>
            </div>
          </div>

          {/* If Cash: Tendered and Change Return Calculator */}
          {paymentMethod === 'cash' && cartItems.length > 0 && (
            <div className="bg-orange-50/60 border border-orange-200/80 rounded-xl p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-orange-950">Cash Tendered (₹)</span>
                {changeDue > 0 && (
                  <span className="font-bold text-emerald-700 font-mono">
                    Change: {formatINR(changeDue)}
                  </span>
                )}
              </div>
              <input
                type="number"
                value={cashTendered}
                onChange={(e) => setCashTendered(e.target.value)}
                placeholder={`e.g. ${grandTotal}`}
                className="w-full px-3 py-2 bg-white border border-orange-300 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 font-bold"
              />
            </div>
          )}

          {/* If Credit selected: Due Date Input */}
          {paymentMethod === 'credit' && (
            <div className="bg-orange-50/60 border border-orange-200/80 p-3 rounded-xl space-y-2 text-xs text-orange-950">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-orange-950 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-orange-600" />
                  <span>Payment Due Date *</span>
                </label>
                <span className="font-mono font-bold text-orange-950">{formatINR(grandTotal)}</span>
              </div>

              <input
                type="date"
                required
                value={paymentDueDate}
                onChange={(e) => setPaymentDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-orange-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 font-bold"
              />

              {/* Quick Date Presets */}
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="text-[11px] text-orange-800 font-medium">Quick set:</span>
                {[7, 15, 30].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + days);
                      setPaymentDueDate(d.toISOString().split('T')[0]);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-orange-100 text-orange-900 border border-orange-200 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer shadow-2xs"
                  >
                    +{days}d
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Discount Section: ₹ Amount by default, with % Percentage as an option */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-700 font-semibold uppercase text-[11px] tracking-wider">Discount</span>
                {/* Segmented Mode Switcher */}
                <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    id="btn-discount-mode-amount"
                    onClick={() => handleDiscountTypeChange('amount')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                      discountType === 'amount'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Enter discount in direct ₹ Amount (default)"
                  >
                    ₹ Amount
                  </button>
                  <button
                    type="button"
                    id="btn-discount-mode-percentage"
                    onClick={() => handleDiscountTypeChange('percentage')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                      discountType === 'percentage'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Enter discount as % Percentage of subtotal"
                  >
                    % Percent
                  </button>
                </div>
              </div>

              {/* Live off indication */}
              <span className="font-mono text-[11px] font-semibold text-emerald-600">
                {discountAmount > 0 ? (
                  discountType === 'amount' ? (
                    <span>-{formatINR(discountAmount)} ({effectiveDiscountPercent}%)</span>
                  ) : (
                    <span>-{effectiveDiscountPercent}% ({formatINR(discountAmount)})</span>
                  )
                ) : (
                  <span className="text-slate-400">₹0 off</span>
                )}
              </span>
            </div>

            {/* Input Field based on Mode */}
            {discountType === 'amount' ? (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                  ₹
                </span>
                <input
                  id="input-discount-amount"
                  type="number"
                  min="0"
                  max={subtotal > 0 ? subtotal : undefined}
                  step="any"
                  value={discountAmountInput}
                  onChange={(e) => setDiscountAmountInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-10 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-orange-500 font-mono font-bold shadow-2xs"
                />
                {discountAmountInput !== '' && parseFloat(discountAmountInput) > 0 && (
                  <button
                    type="button"
                    onClick={() => setDiscountAmountInput('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                    title="Clear discount"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                <input
                  id="input-discount-percent"
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  value={discountPercentInput}
                  onChange={(e) => setDiscountPercentInput(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 pr-10 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-orange-500 font-mono font-bold shadow-2xs"
                />
                <span className="absolute right-7 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                  %
                </span>
                {discountPercentInput !== '' && parseFloat(discountPercentInput) > 0 && (
                  <button
                    type="button"
                    onClick={() => setDiscountPercentInput('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                    title="Clear discount"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Quick preset chips */}
            <div className="flex items-center gap-1.5 pt-0.5">
              <span className="text-[11px] text-slate-400 font-medium mr-0.5">Presets:</span>
              {discountType === 'amount' ? (
                <>
                  {[20, 50, 100, 200, 500].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setDiscountAmountInput(String(amt))}
                      className={`px-2.5 py-1 text-xs font-mono rounded-lg border transition-all cursor-pointer ${
                        parseFloat(discountAmountInput) === amt
                          ? 'bg-slate-900 text-white font-bold border-slate-900'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      ₹{amt}
                    </button>
                  ))}
                  {discountAmountInput !== '' && (
                    <button
                      type="button"
                      onClick={() => setDiscountAmountInput('')}
                      className="px-2 py-1 text-xs text-rose-600 hover:text-rose-800 font-semibold ml-auto cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </>
              ) : (
                <>
                  {[2, 5, 10, 15, 20].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setDiscountPercentInput(String(pct))}
                      className={`px-2.5 py-1 text-xs font-mono rounded-lg border transition-all cursor-pointer ${
                        parseFloat(discountPercentInput) === pct
                          ? 'bg-slate-900 text-white font-bold border-slate-900'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                  {discountPercentInput !== '' && (
                    <button
                      type="button"
                      onClick={() => setDiscountPercentInput('')}
                      className="px-2 py-1 text-xs text-rose-600 hover:text-rose-800 font-semibold ml-auto cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Tax Breakdown Lines */}
          <div className="space-y-1.5 pt-2 text-xs text-slate-600 font-medium">
            <div className="flex items-center justify-between">
              <span>Taxable Amount</span>
              <span className="font-mono font-bold text-slate-900">{formatINR(taxableAmount)}</span>
            </div>
            {isGstBill ? (
              <>
                <div className="flex items-center justify-between">
                  <span>CGST (9%)</span>
                  <span className="font-mono font-bold text-slate-900">{formatINR(cgstAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>SGST (9%)</span>
                  <span className="font-mono font-bold text-slate-900">{formatINR(sgstAmount)}</span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Tax:</span>
                <span>Exempt / Cash Memo</span>
              </div>
            )}
          </div>

          {/* Grand Total Divider */}
          <div className="border-t border-slate-100 pt-3 flex items-baseline justify-between">
            <span className="text-sm font-bold text-slate-900">Grand Total</span>
            <span className="text-2xl font-bold text-slate-950 font-mono">
              {formatINR(grandTotal)}
            </span>
          </div>

          {/* Active Printer Notice */}
          <div className="flex items-center justify-between text-xs bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/70 text-slate-600 font-medium">
            <span className="flex items-center gap-1.5">
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Printer:</span>
            </span>
            <span className="font-semibold text-slate-800">
              {settings.defaultPrinterType === 'thermal'
                ? `Thermal (${settings.thermalPaperWidth || '80mm'})`
                : 'Ink Printer (A4)'}
            </span>
          </div>

          {/* Complete Bill & Print Bill Actions */}
          <div className="pt-2 space-y-2.5">
            <button
              type="button"
              id="btn-complete-bill"
              disabled={cartItems.length === 0}
              onClick={handleCompleteSale}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
                cartItems.length > 0
                  ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white cursor-pointer hover:shadow-lg'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
              }`}
              title="Complete bill & record sale in history (F9)"
            >
              <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
              <span>Complete Bill</span>
            </button>

            <button
              type="button"
              id="btn-print-bill"
              disabled={cartItems.length === 0}
              onClick={handlePrintBill}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
                cartItems.length > 0
                  ? 'bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white cursor-pointer hover:shadow-lg'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
              }`}
              title="Print bill invoice (Ctrl + P)"
            >
              <Printer className="w-4 h-4 text-white shrink-0" />
              <span>Print Bill</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
