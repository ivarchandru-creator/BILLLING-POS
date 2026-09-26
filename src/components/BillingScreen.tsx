import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
  Pause,
  Play,
  Layers,
  AlertCircle,
  ArrowRight,
  Keyboard,
  HelpCircle,
} from 'lucide-react';
import { Product, InvoiceItem, Invoice, PaymentMethod, ShopSettings, Customer, HeldInvoice, BillPaperSize } from '../types';
import { formatINR, generateInvoiceNumber, getCurrentDateTimeFormatted } from '../utils/formatters';
import {
  loadDraftBilling,
  saveDraftBilling,
  clearDraftBilling,
  loadRecentBillingProductIds,
  saveRecentBillingProductIds,
  loadHeldInvoices,
  saveHeldInvoices,
} from '../utils/storage';

interface BillingScreenProps {
  products: Product[];
  invoices: Invoice[];
  settings: ShopSettings;
  customers?: Customer[];
  onSaveInvoice: (invoice: Invoice) => void;
  onPreviewInvoice: (invoice: Invoice, onConfirm?: () => void) => void;
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
  const [activeSearchIndex, setActiveSearchIndex] = useState<number>(0);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState<boolean>(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState<boolean>(false);
  const [activeCustomerSearchIndex, setActiveCustomerSearchIndex] = useState<number>(0);
  const customerSearchDropdownRef = useRef<HTMLDivElement>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);
  const handlePrintBillRef = useRef<() => void>(() => {});

  // Fast Keyboard Navigation & Layout Scrolling Refs
  const billingContainerRef = useRef<HTMLDivElement>(null);
  const customerDetailsSectionRef = useRef<HTMLDivElement>(null);
  const paymentSectionRef = useRef<HTMLDivElement>(null);
  const sizeAndPrintSectionRef = useRef<HTMLDivElement>(null);
  const printBillBtnRef = useRef<HTMLButtonElement>(null);

  const customerSearchInputRef = useRef<HTMLInputElement>(null);
  const customerPhoneInputRef = useRef<HTMLInputElement>(null);
  const customerNameInputRef = useRef<HTMLInputElement>(null);
  const customerAddressInputRef = useRef<HTMLInputElement>(null);
  const customerGstinInputRef = useRef<HTMLInputElement>(null);
  const cashTenderedInputRef = useRef<HTMLInputElement>(null);
  const paymentDueDateInputRef = useRef<HTMLInputElement>(null);
  const discountAmountInputRef = useRef<HTMLInputElement>(null);
  const discountPercentInputRef = useRef<HTMLInputElement>(null);
  const cartQtyInputsRef = useRef<Map<string, HTMLInputElement>>(new Map());
  const cartPriceInputsRef = useRef<Map<string, HTMLInputElement>>(new Map());

  // Auto-scroll functions for smooth zero-mouse POS billing
  const scrollToTop = () => {
    if (billingContainerRef.current) {
      billingContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const scrollToCustomerDetails = () => {
    if (billingContainerRef.current) {
      billingContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    customerDetailsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToBottom = () => {
    if (billingContainerRef.current) {
      billingContainerRef.current.scrollTo({
        top: billingContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
    sizeAndPrintSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    printBillBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  // Dedicated auto-scroll down to Cash Tendered option and checkout controls
  const scrollDownToCashTendered = useCallback(() => {
    const doScroll = () => {
      const cashInput =
        cashTenderedInputRef.current ||
        (document.getElementById('input-cash-tendered') as HTMLInputElement | null);

      if (cashInput) {
        cashInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (paymentSectionRef.current) {
        paymentSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      if (billingContainerRef.current) {
        billingContainerRef.current.scrollTo({
          top: billingContainerRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }
    };

    doScroll();
    setTimeout(doScroll, 40);
  }, []);

  // Restore draft state from localStorage if available
  const initialDraft = useMemo(() => loadDraftBilling(), []);

  // Cart / Line Items (preserved across sections & browser reloads)
  const [cartItems, setCartItems] = useState<InvoiceItem[]>(() => initialDraft?.cartItems || []);
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});
  const [focusedCartProductId, setFocusedCartProductId] = useState<string | null>(null);

  // GST Mode: Cash Memo (Default) vs GST Tax Invoice (Optional)
  const [isGstBill, setIsGstBill] = useState(() => initialDraft?.isGstBill ?? (settings.defaultGstOn ?? false));

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

  // Bill Paper Size / Format: A4 vs A5
  const [billPaperSize, setBillPaperSize] = useState<'a4' | 'a5'>(() => {
    if (initialDraft?.billPaperSize === 'a5') return 'a5';
    return 'a4';
  });

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

  // Held Invoices (Simple 1-click parking for serving urgent customers)
  const [heldInvoices, setHeldInvoices] = useState<HeldInvoice[]>(() => loadHeldInvoices());
  const handleHoldAndNewBillRef = useRef<() => void>(() => {});

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

  // Focus and select the discount input for instant editing
  const focusAndSelectDiscountInput = useCallback(() => {
    setTimeout(() => {
      const el =
        discountType === 'amount'
          ? discountAmountInputRef.current || (document.getElementById('input-discount-amount') as HTMLInputElement | null)
          : discountPercentInputRef.current || (document.getElementById('input-discount-percent') as HTMLInputElement | null);
      if (el) {
        try {
          el.focus({ preventScroll: true });
        } catch {
          el.focus();
        }
        el.select();
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 40);
  }, [discountType]);

  // Smoothly activate Cash payment mode, scroll down automatically, and focus Cash Tendered
  const focusCashTendered = useCallback(() => {
    setPaymentMethod('cash');
    scrollDownToCashTendered();
    setTimeout(() => {
      scrollDownToCashTendered();
      const el =
        cashTenderedInputRef.current ||
        (document.getElementById('input-cash-tendered') as HTMLInputElement | null);
      if (el) {
        try {
          el.focus({ preventScroll: true });
        } catch {
          el.focus();
        }
        el.select();
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  }, [scrollDownToCashTendered]);

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
        discountType,
        discountAmount: discountType === 'amount' ? (parseFloat(discountAmountInput) || 0) : discountAmount,
        discountPercent: effectiveDiscountPercent,
        cashTendered,
        activeInvoiceId: activeInvoiceSession?.invoiceId,
        activeInvoiceNumber: activeInvoiceSession?.invoiceNumber,
        billPaperSize,
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
    discountType,
    discountAmountInput,
    discountPercentInput,
    discountAmount,
    effectiveDiscountPercent,
    cashTendered,
    activeInvoiceSession,
    billPaperSize,
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

  // Autofocus product search on initial load
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Global POS Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      const isAlt = e.altKey;
      const key = e.key.toLowerCase();
      const code = e.code;
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput = targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select';

      // 1. F1: Toggle Keyboard Shortcuts Cheat Sheet Guide
      if (e.key === 'F1') {
        e.preventDefault();
        setShowShortcutsHelp((prev) => !prev);
        return;
      }

      // 2. Print Bill: ONLY Ctrl+Enter / Cmd+Enter
      if (isCmdOrCtrl && (e.key === 'Enter' || code === 'Enter' || code === 'NumpadEnter')) {
        e.preventDefault();
        if (cartItems.length > 0) {
          handlePrintBillRef.current?.();
        } else {
          showToast('Cart is empty. Search products first.');
          scrollToTop();
          searchInputRef.current?.focus();
        }
        return;
      }

      // If user presses F12, guide them to Ctrl+Enter
      if (e.key === 'F12') {
        e.preventDefault();
        showToast('Press Ctrl+Enter to Print Bill.');
        return;
      }

      // 3. Customer Details: F4, Ctrl+K, Cmd+K, Alt+K, Alt+C
      if (
        e.key === 'F4' ||
        (isCmdOrCtrl && (key === 'k' || code === 'KeyK')) ||
        (isAlt && (key === 'k' || code === 'KeyK' || key === 'c' || code === 'KeyC'))
      ) {
        e.preventDefault();
        scrollToCustomerDetails();
        customerSearchInputRef.current?.focus();
        customerSearchInputRef.current?.select();
        showToast('Customer Search (Type or press Enter to continue)');
        return;
      }

      // 4. Focus Product Search: F2, Ctrl+F, Cmd+F, or '/' (when not editing an input)
      if (
        e.key === 'F2' ||
        (isCmdOrCtrl && (key === 'f' || code === 'KeyF')) ||
        (!isInput && e.key === '/')
      ) {
        e.preventDefault();
        scrollToTop();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        setIsSearchFocused(true);
        return;
      }

      // 5. Jump to Cart Line Items: F3, Alt+I
      if (e.key === 'F3' || (isAlt && (key === 'i' || code === 'KeyI'))) {
        e.preventDefault();
        scrollToTop();
        if (cartItems.length > 0) {
          const firstId = cartItems[0].productId;
          const el =
            cartQtyInputsRef.current.get(firstId) ||
            (document.getElementById(`input-cart-qty-${firstId}`) as HTMLInputElement | null);
          el?.focus();
          el?.select();
          showToast('Cart Line Items: Type quantity, hit Enter to return to search.');
        } else {
          showToast('Cart is currently empty.');
          searchInputRef.current?.focus();
        }
        return;
      }

      // 6. Hold & New Bill: F6, Ctrl+H, Cmd+H
      if (e.key === 'F6' || (isCmdOrCtrl && (key === 'h' || code === 'KeyH'))) {
        e.preventDefault();
        handleHoldAndNewBillRef.current?.();
        return;
      }

      // 7. Payment Modes:
      // Cash: F7, Alt+1
      if (e.key === 'F7' || (isAlt && (e.key === '1' || code === 'Digit1'))) {
        e.preventDefault();
        focusCashTendered();
        showToast('Payment mode: Cash (Cash Tendered selected)');
        return;
      }

      // UPI: F8, Alt+2
      if (e.key === 'F8' || (isAlt && (e.key === '2' || code === 'Digit2'))) {
        e.preventDefault();
        setPaymentMethod('upi');
        showToast('Payment mode: UPI');
        scrollToBottom();
        return;
      }

      // Card: F9, Alt+3
      if (e.key === 'F9' || (isAlt && (e.key === '3' || code === 'Digit3'))) {
        e.preventDefault();
        setPaymentMethod('card');
        showToast('Payment mode: Card');
        scrollToBottom();
        return;
      }

      // Credit: F10
      if (e.key === 'F10') {
        e.preventDefault();
        setPaymentMethod('credit');
        const trimmedName = customerName.trim();
        const isGenericWalkIn = !trimmedName || trimmedName === 'Walk-in Customer (General)' || trimmedName === 'Walk-in Customer';
        const cleanPhone = customerPhone.trim().replace(/\D/g, '');
        const isMissingPhone = !customerPhone.trim() || cleanPhone.length < 10;

        if (isGenericWalkIn || isMissingPhone) {
          scrollToCustomerDetails();
          if (isGenericWalkIn) {
            customerSearchInputRef.current?.focus();
            customerSearchInputRef.current?.select();
          } else {
            customerPhoneInputRef.current?.focus();
            customerPhoneInputRef.current?.select();
          }
          showToast('Customer Name & Mobile Number required for Credit bills');
        } else {
          showToast('Payment mode: Credit (Due)');
          scrollToBottom();
          setTimeout(() => {
            paymentDueDateInputRef.current?.focus();
          }, 50);
        }
        return;
      }

      // 8. Discount: Alt+D, Ctrl+D, Cmd+D
      if ((isAlt || isCmdOrCtrl) && (key === 'd' || code === 'KeyD')) {
        e.preventDefault();
        focusAndSelectDiscountInput();
        showToast('Discount: Type discount and press Enter');
        return;
      }

      // 9. Paper size: Alt+A / Alt+4 for A4, Alt+5 for A5
      if (isAlt && (key === 'a' || code === 'KeyA' || e.key === '4' || code === 'Digit4')) {
        e.preventDefault();
        setBillPaperSize('a4');
        showToast('Paper size: A4');
        scrollToBottom();
        return;
      }
      if (isAlt && (e.key === '5' || code === 'Digit5')) {
        e.preventDefault();
        setBillPaperSize('a5');
        showToast('Paper size: A5');
        scrollToBottom();
        return;
      }

      // 10. Clear Cart: Alt+X
      if (isAlt && (key === 'x' || code === 'KeyX')) {
        e.preventDefault();
        handleClearCart();
        return;
      }

      // 11. Escape: Close help modal, close search dropdown, return to search input
      if (e.key === 'Escape') {
        if (showShortcutsHelp) {
          e.preventDefault();
          setShowShortcutsHelp(false);
          scrollToTop();
          searchInputRef.current?.focus();
          return;
        }
        setIsSearchFocused(false);
        scrollToTop();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartItems.length, discountType, showShortcutsHelp]);

  // Filtered Products for Search Autocomplete
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    // If user typed shorthand like "wire 5" or "switch*10", extract query part
    const cleanQuery = searchQuery.replace(/(?:[*xX\s])\s*(\d+(?:\.\d+)?)\s*$/, '').trim().toLowerCase();
    const query = cleanQuery || searchQuery.toLowerCase();

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

  // Add Product directly to Cart and focus quantity input in the cart table for immediate keyboard adjustment
  const handleAddToCart = (
    product: Product,
    customQty = 1,
    customPrice?: number,
    shouldFocusQty = true
  ) => {
    addRecentProduct(product.productId);
    const price = customPrice !== undefined && customPrice >= 0 ? customPrice : product.sellingPrice;
    setCartItems((prev) => {
      const match = prev.find((item) => item.productId === product.productId);
      if (match) {
        const newQty = match.quantity + customQty;
        return prev.map((item) =>
          item.productId === product.productId
            ? {
                ...item,
                quantity: newQty,
                unitPrice: price,
                lineTotal: newQty * price,
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
          unitPrice: price,
          purchasePrice: product.purchasePrice,
          costPrice: product.purchasePrice,
          lineTotal: customQty * price,
          gstRate: isGstBill ? product.gstRate : 0,
          unit: product.unit,
          hsnCode: product.hsnCode,
        },
      ];
    });

    setSearchQuery('');
    setIsSearchFocused(false);
    setActiveSearchIndex(0);

    if (shouldFocusQty) {
      setFocusedCartProductId(product.productId);
      setQtyDrafts((prev) => ({ ...prev, [product.productId]: String(customQty) }));
      setTimeout(() => {
        const el =
          cartQtyInputsRef.current.get(product.productId) ||
          (document.getElementById(`input-cart-qty-${product.productId}`) as HTMLInputElement | null);
        if (el) {
          el.focus();
          el.select();
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
      showToast(`Added ${product.name}. Type quantity directly (Enter to confirm, ↓ next item).`);
    } else {
      showToast(`Added ${customQty} × ${product.name}`);
    }
  };

  // Keyboard Selection from Search: handles shorthand quantity (e.g. "switch 5" or "wire*10")
  const handleSelectProduct = (product: Product) => {
    let initialQty = 1;
    const match = searchQuery.match(/(?:[*xX\s])\s*(\d+(?:\.\d+)?)\s*$/);
    if (match && match[1]) {
      const parsed = parseFloat(match[1]);
      if (!isNaN(parsed) && parsed > 0) initialQty = parsed;
    }
    handleAddToCart(product, initialQty, product.sellingPrice, true);
  };

  // Product Search submit event: Enter on search bar
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      // Empty search bar: move directly to Customer Details!
      customerPhoneInputRef.current?.focus();
      customerPhoneInputRef.current?.select();
      showToast('Customer Details (Enter mobile or press Enter for Cash Tendered)');
      return;
    }
    if (searchResults.length > 0 && searchResults[activeSearchIndex]) {
      handleSelectProduct(searchResults[activeSearchIndex]);
    } else {
      showToast(`No product found matching: ${searchQuery}`);
    }
  };

  // Set Quantity directly from keyboard input
  const handleSetQty = (productId: string, newQty: number) => {
    if (isNaN(newQty) || newQty <= 0) return;
    setCartItems((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity: newQty,
              lineTotal: newQty * item.unitPrice,
            }
          : item
      )
    );
  };

  // Handle Cart Quantity Input Keydown
  const handleCartQtyKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    productId: string,
    index: number
  ) => {
    const isCmdOrCtrl = e.ctrlKey || e.metaKey;
    if (isCmdOrCtrl && e.key === 'Enter') {
      e.preventDefault();
      const raw = qtyDrafts[productId];
      if (raw !== undefined) {
        const parsed = parseFloat(raw);
        const safeQty = !isNaN(parsed) && parsed > 0 ? parsed : 1;
        handleSetQty(productId, safeQty);
        setQtyDrafts((prev) => {
          const copy = { ...prev };
          delete copy[productId];
          return copy;
        });
      }
      if (cartItems.length > 0) handlePrintBill();
      else showToast('Cart is empty. Search products first.');
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      // Commit draft if any
      const raw = qtyDrafts[productId];
      if (raw !== undefined) {
        const parsed = parseFloat(raw);
        const safeQty = !isNaN(parsed) && parsed > 0 ? parsed : 1;
        handleSetQty(productId, safeQty);
        setQtyDrafts((prev) => {
          const copy = { ...prev };
          delete copy[productId];
          return copy;
        });
      }
      setFocusedCartProductId(null);
      // Pressing Enter confirms quantity and immediately jumps back to search for next product!
      scrollToTop();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
      setIsSearchFocused(true);
      showToast('Quantity saved! Search next product or press Enter for Customer Details.');
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      const raw = qtyDrafts[productId];
      if (raw !== undefined) {
        const parsed = parseFloat(raw);
        const safeQty = !isNaN(parsed) && parsed > 0 ? parsed : 1;
        handleSetQty(productId, safeQty);
        setQtyDrafts((prev) => {
          const copy = { ...prev };
          delete copy[productId];
          return copy;
        });
      }
      setFocusedCartProductId(null);
      scrollToTop();
      searchInputRef.current?.focus();
      setIsSearchFocused(false);
      return;
    }

    // Down Arrow in cart quantity: moves to next product row in cart!
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const raw = qtyDrafts[productId];
      if (raw !== undefined) {
        const parsed = parseFloat(raw);
        const safeQty = !isNaN(parsed) && parsed > 0 ? parsed : 1;
        handleSetQty(productId, safeQty);
        setQtyDrafts((prev) => {
          const copy = { ...prev };
          delete copy[productId];
          return copy;
        });
      }

      if (cartItems.length > 1) {
        const nextIndex = (index + 1) % cartItems.length;
        const nextProd = cartItems[nextIndex];
        setFocusedCartProductId(nextProd.productId);
        const nextId = nextProd.productId;
        const el =
          cartQtyInputsRef.current.get(nextId) ||
          (document.getElementById(`input-cart-qty-${nextId}`) as HTMLInputElement | null);
        el?.focus();
        el?.select();
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        showToast(`Selected ${nextProd.productNameSnapshot}: Type quantity (${nextIndex + 1}/${cartItems.length})`);
      } else {
        showToast('Type quantity, press Enter to confirm and return to search.');
      }
      return;
    }

    // Up Arrow in cart quantity: moves to previous product row or back to search bar!
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const raw = qtyDrafts[productId];
      if (raw !== undefined) {
        const parsed = parseFloat(raw);
        const safeQty = !isNaN(parsed) && parsed > 0 ? parsed : 1;
        handleSetQty(productId, safeQty);
        setQtyDrafts((prev) => {
          const copy = { ...prev };
          delete copy[productId];
          return copy;
        });
      }

      if (index > 0) {
        const prevProd = cartItems[index - 1];
        setFocusedCartProductId(prevProd.productId);
        const prevId = prevProd.productId;
        const el =
          cartQtyInputsRef.current.get(prevId) ||
          (document.getElementById(`input-cart-qty-${prevId}`) as HTMLInputElement | null);
        el?.focus();
        el?.select();
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        showToast(`Selected ${prevProd.productNameSnapshot}: Type quantity (${index}/${cartItems.length})`);
      } else {
        // At the top product in cart: ArrowUp returns focus to the search bar!
        setFocusedCartProductId(null);
        scrollToTop();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        showToast('Returned to Product Search bar.');
      }
      return;
    }

    if (
      (e.key === 'Delete' || e.key === 'Backspace') &&
      (e.altKey || e.ctrlKey)
    ) {
      e.preventDefault();
      handleRemoveItem(productId);
      scrollToTop();
      searchInputRef.current?.focus();
      showToast('Item removed from cart.');
      return;
    }
  };

  // Adjust Quantity (+1 / -1 buttons)
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
    setQtyDrafts((prev) => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
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
    setQtyDrafts((prev) => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
    if (focusedCartProductId === productId) {
      setFocusedCartProductId(null);
    }
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
  // Calculates tax item-by-item according to each product's separate GST rate (0%, 5%, 12%, 18%, 28%)
  const { taxableAmount, cgstAmount, sgstAmount, totalGst, grandTotal } = useMemo(() => {
    if (!isGstBill || cartItems.length === 0) {
      const roundedTotal = Math.round(discountedSubtotal);
      return {
        taxableAmount: roundedTotal,
        cgstAmount: 0,
        sgstAmount: 0,
        totalGst: 0,
        grandTotal: roundedTotal,
      };
    }

    // Accurate calculation based on each product's individual entered GST rate
    const discountRatio = subtotal > 0 ? discountedSubtotal / subtotal : 1;
    let totalTaxable = 0;
    let totalTax = 0;

    cartItems.forEach((item) => {
      const effectiveLineTotal = item.lineTotal * discountRatio;
      const rate = typeof item.gstRate === 'number' ? item.gstRate : 0;
      if (rate > 0) {
        const itemTaxable = effectiveLineTotal / (1 + rate / 100);
        const itemTax = effectiveLineTotal - itemTaxable;
        totalTaxable += itemTaxable;
        totalTax += itemTax;
      } else {
        totalTaxable += effectiveLineTotal;
      }
    });

    const roundedTax = Math.round(totalTax * 100) / 100;
    const cgst = Math.round((roundedTax / 2) * 100) / 100;
    const sgst = Math.round((roundedTax - cgst) * 100) / 100;
    const taxable = Math.round(totalTaxable * 100) / 100;

    return {
      taxableAmount: taxable,
      cgstAmount: cgst,
      sgstAmount: sgst,
      totalGst: roundedTax,
      grandTotal: Math.round(discountedSubtotal),
    };
  }, [cartItems, discountedSubtotal, isGstBill, subtotal]);

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

  // 1-Click Hold & New Bill: Immediately saves current cart to held tabs and starts blank bill for next customer
  const handleHoldAndNewBill = () => {
    if (cartItems.length === 0) {
      showToast('Cannot hold an empty bill. Add products first.');
      searchInputRef.current?.focus();
      return;
    }

    const currentDisplayName = customerName.trim() || 'Walk-in Customer';

    const newHeld: HeldInvoice = {
      id: `held-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      heldAt: new Date().toISOString(),
      customerName: currentDisplayName,
      customerPhone: customerPhone.trim(),
      customerAddress: customerAddress.trim(),
      customerGstin: customerGstin.trim(),
      customerCategory,
      selectedCustomerId,
      cartItems: [...cartItems],
      paymentMethod,
      paymentDueDate,
      isGstBill,
      discountType,
      discountAmount: discountType === 'amount' ? (parseFloat(discountAmountInput) || 0) : discountAmount,
      discountPercent: effectiveDiscountPercent,
      discountAmountInput,
      discountPercentInput,
      cashTendered,
      activeInvoiceId: activeInvoiceSession?.invoiceId,
      activeInvoiceNumber: activeInvoiceSession?.invoiceNumber,
      subtotal,
      grandTotal,
    };

    const updatedHeld = [newHeld, ...heldInvoices];
    setHeldInvoices(updatedHeld);
    saveHeldInvoices(updatedHeld);

    // Reset current bill to a fresh blank invoice for the next customer
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

    showToast(`Bill (${newHeld.customerName}) held! Blank bill ready.`);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  handleHoldAndNewBillRef.current = handleHoldAndNewBill;

  // 1-Click Resume Held Bill: Switches back to a held customer bill
  const handleResumeHeldBill = (heldId: string) => {
    const target = heldInvoices.find((h) => h.id === heldId);
    if (!target) return;

    // If current on-screen bill has items, safely auto-hold it so switching is 100% loss-free
    let remainingHeld = heldInvoices.filter((h) => h.id !== heldId);
    if (cartItems.length > 0) {
      const currentDisplayName = customerName.trim() || 'Walk-in Customer';
      const autoHeldCurrent: HeldInvoice = {
        id: `held-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        heldAt: new Date().toISOString(),
        customerName: currentDisplayName,
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        customerGstin: customerGstin.trim(),
        customerCategory,
        selectedCustomerId,
        cartItems: [...cartItems],
        paymentMethod,
        paymentDueDate,
        isGstBill,
        discountType,
        discountAmount: discountType === 'amount' ? (parseFloat(discountAmountInput) || 0) : discountAmount,
        discountPercent: effectiveDiscountPercent,
        discountAmountInput,
        discountPercentInput,
        cashTendered,
        activeInvoiceId: activeInvoiceSession?.invoiceId,
        activeInvoiceNumber: activeInvoiceSession?.invoiceNumber,
        subtotal,
        grandTotal,
      };
      remainingHeld = [autoHeldCurrent, ...remainingHeld];
    }

    setHeldInvoices(remainingHeld);
    saveHeldInvoices(remainingHeld);

    // Restore the target held bill into the editor
    setCartItems(target.cartItems || []);
    setSelectedCustomerId(target.selectedCustomerId || 'walk-in');
    setCustomerName(
      target.customerName === 'Walk-in Customer (General)' || target.customerName === 'Walk-in Customer'
        ? ''
        : target.customerName
    );
    setCustomerPhone(target.customerPhone || '');
    setCustomerAddress(target.customerAddress || '');
    setCustomerGstin(target.customerGstin || '');
    setCustomerCategory(target.customerCategory || 'walk-in');
    setPaymentMethod(target.paymentMethod || 'cash');
    setPaymentDueDate(target.paymentDueDate || new Date().toISOString().split('T')[0]);
    setIsGstBill(target.isGstBill ?? false);
    setDiscountType(target.discountType || 'amount');
    setDiscountAmountInput(target.discountAmountInput || (target.discountAmount ? String(target.discountAmount) : ''));
    setDiscountPercentInput(target.discountPercentInput || (target.discountPercent ? String(target.discountPercent) : ''));
    setCashTendered(target.cashTendered || '');

    if (target.activeInvoiceId && target.activeInvoiceNumber) {
      setActiveInvoiceSession({
        invoiceId: target.activeInvoiceId,
        invoiceNumber: target.activeInvoiceNumber,
      });
    } else {
      setActiveInvoiceSession(null);
    }

    showToast(`Switched to Bill #${target.holdNumber} (${target.customerName})`);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  // Discard a held bill
  const handleDeleteHeldBill = (heldId: string) => {
    const target = heldInvoices.find((h) => h.id === heldId);
    if (!target) return;
    const updated = heldInvoices.filter((h) => h.id !== heldId);
    setHeldInvoices(updated);
    saveHeldInvoices(updated);
    showToast(`Held bill #${target.holdNumber} discarded.`);
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
      items: cartItems.map((it) => {
        const matched = products.find((p) => p.productId === it.productId);
        const cost = it.purchasePrice ?? it.costPrice ?? matched?.purchasePrice ?? 0;
        return {
          ...it,
          purchasePrice: cost,
          costPrice: cost,
        };
      }),
      subtotal,
      discountType,
      discountAmount,
      discountPercent: effectiveDiscountPercent,
      gstApplied: isGstBill,
      gstRate: isGstBill && taxableAmount > 0 ? Math.round((totalGst / taxableAmount) * 100) : 0,
      gstAmount: totalGst,
      cgstAmount,
      sgstAmount,
      grandTotal,
      paymentMethod,
      paymentDueDate: paymentMethod === 'credit' ? (paymentDueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) : undefined,
      creditPaid: paymentMethod === 'credit' ? false : true,
      creditPaidDate: paymentMethod === 'credit' ? undefined : getCurrentDateTimeFormatted(),
      printerType: 'ink',
      templateType: billPaperSize,
      createdBy: settings.ownerName || 'Tpk Chandru',
      status: 'completed',
    };
  };

  // Print Bill & Record Sale Flow:
  // 1st click on Print Bill (or Ctrl+Enter):
  // - Opens the printable bill preview popup modal.
  // - The cart & added products remain INTACT on the billing screen (NOT cleared yet).
  // 2nd click on the Print Bill button inside the popup modal:
  // - Prints the invoice.
  // - ONLY THEN: Saves the invoice in sales history & inventory, and refreshes the cart to empty!
  const handlePrintBill = () => {
    if (cartItems.length === 0) {
      showToast('Cart is empty. Please add products to print bill.');
      return;
    }

    // Credit Payment Validation: Customer Name & Mobile Number are mandatory for Credit (Due) bills
    if (paymentMethod === 'credit') {
      const trimmedName = customerName.trim();
      const isGenericWalkIn = !trimmedName || trimmedName === 'Walk-in Customer (General)' || trimmedName === 'Walk-in Customer';
      const cleanPhone = customerPhone.trim().replace(/\D/g, '');
      const isMissingPhone = !customerPhone.trim() || cleanPhone.length < 10;

      if (isGenericWalkIn || isMissingPhone) {
        showToast('Cannot print Credit bill: Customer Name and Mobile Number are required!');
        scrollToCustomerDetails();
        if (isGenericWalkIn) {
          customerSearchInputRef.current?.focus();
          customerSearchInputRef.current?.select();
        } else {
          customerPhoneInputRef.current?.focus();
          customerPhoneInputRef.current?.select();
        }
        return; // Strictly block printing
      }
    }

    const invoiceToSave = buildCurrentInvoice();

    // 1. Open printable invoice preview modal with onConfirm callback.
    // Notice: Cart is NOT cleared here! Products remain in the cart.
    onPreviewInvoice(invoiceToSave, () => {
      // 2. This callback runs ONLY when user clicks Print in the popup modal!
      onSaveInvoice(invoiceToSave);

      // Empty the cart and refresh for next bill
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
      setCustomerSearchQuery('');
      setIsCustomerSearchOpen(false);
      setPaymentMethod('cash');
      setPaymentDueDate('');
      setIsGstBill(settings.defaultGstOn ?? false);

      showToast(`Bill #${invoiceToSave.invoiceNumber} recorded & printed! Cart refreshed.`);
      scrollToTop();
      setTimeout(() => {
        scrollToTop();
        searchInputRef.current?.focus();
      }, 100);
    });

    showToast(`Bill #${invoiceToSave.invoiceNumber} preview opened. Click Print Bill in popup to print.`);
  };

  handlePrintBillRef.current = handlePrintBill;

  return (
    <div
      ref={billingContainerRef}
      className="w-full h-full p-4 sm:p-6 overflow-y-auto space-y-6 bg-slate-50 font-sans scroll-smooth"
    >
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
                      gstRate: matchedProd?.gstRate ?? item.gstRate ?? 0,
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

      {/* Bill Tabs: Active Bill + Held Bills + Quick 1-Click Hold */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {/* Active Bill Tab */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500 text-white font-semibold text-xs shadow-xs shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span>Active Bill</span>
          {cartItems.length > 0 && (
            <span className="bg-orange-600 px-1.5 py-0.5 rounded text-[11px] font-mono">
              {cartItems.length} itms • {formatINR(grandTotal)}
            </span>
          )}
        </div>

        {/* Held Bill Tabs */}
        {heldInvoices.map((held) => (
          <div
            key={held.id}
            className="flex items-center rounded-lg bg-amber-50 hover:bg-amber-100/90 border border-amber-300 text-amber-950 text-xs shrink-0 transition-colors shadow-2xs group"
          >
            <button
              type="button"
              onClick={() => handleResumeHeldBill(held.id)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 font-medium cursor-pointer"
              title={`Switch back to held bill for ${held.customerName}`}
            >
              <Pause className="w-3 h-3 text-amber-700 fill-current" />
              <span className="font-semibold text-amber-900">Hold:</span>
              <span className="max-w-[120px] truncate">{held.customerName}</span>
              <span className="font-mono text-amber-800 font-bold text-[11px]">
                ({formatINR(held.grandTotal)})
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleDeleteHeldBill(held.id)}
              className="p-1.5 text-amber-600 hover:text-rose-600 hover:bg-rose-50 rounded-r-lg transition-colors border-l border-amber-300 cursor-pointer"
              title="Discard this held bill"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {/* 1-Click Hold & New Bill Button */}
        <button
          type="button"
          id="btn-hold-and-new-bill"
          disabled={cartItems.length === 0}
          onClick={handleHoldAndNewBill}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
            cartItems.length > 0
              ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs cursor-pointer'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
          title="1-Click: Hold current bill and open fresh bill for next customer (F6)"
        >
          <Pause className="w-3 h-3 fill-current" />
          <span>Hold & New Bill (F6)</span>
        </button>
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
                    setActiveSearchIndex(0);
                    if (!isSearchFocused) setIsSearchFocused(true);
                  }}
                  onFocus={() => {
                    scrollToTop();
                    setIsSearchFocused(true);
                    if (activeSearchIndex >= searchResults.length) setActiveSearchIndex(0);
                  }}
                  onKeyDown={(e) => {
                    const isCmdOrCtrl = e.ctrlKey || e.metaKey;
                    if (isCmdOrCtrl && e.key === 'Enter') {
                      e.preventDefault();
                      if (cartItems.length > 0) handlePrintBill();
                      else showToast('Cart is empty. Search products first.');
                      return;
                    }

                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      if (searchResults.length > 0 && searchQuery.trim() !== '') {
                        setIsSearchFocused(true);
                        setActiveSearchIndex((prev) => (prev + 1) % searchResults.length);
                      } else if (cartItems.length > 0) {
                        // User selected search bar and presses Down Arrow:
                        // Select the product in the cart table to edit its quantity!
                        setIsSearchFocused(false);
                        const targetItem = cartItems.find((c) => c.productId === focusedCartProductId) || cartItems[0];
                        setFocusedCartProductId(targetItem.productId);
                        const targetId = targetItem.productId;
                        const el =
                          cartQtyInputsRef.current.get(targetId) ||
                          (document.getElementById(`input-cart-qty-${targetId}`) as HTMLInputElement | null);
                        if (el) {
                          el.focus();
                          el.select();
                          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                          showToast(`Selected ${targetItem.productNameSnapshot}: Type quantity (Enter to save, ↓ next product)`);
                        }
                      } else {
                        showToast('Cart is empty. Search and add products first.');
                      }
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      if (searchResults.length > 0 && searchQuery.trim() !== '') {
                        setIsSearchFocused(true);
                        setActiveSearchIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
                      }
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      if (searchResults.length > 0 && searchResults[activeSearchIndex]) {
                        handleSelectProduct(searchResults[activeSearchIndex]);
                      } else if (!searchQuery.trim()) {
                        // Empty search bar: move directly to Customer Details!
                        scrollToCustomerDetails();
                        customerPhoneInputRef.current?.focus();
                        customerPhoneInputRef.current?.select();
                        showToast('Customer Details (Enter mobile or name, or press Enter for Walk-in)');
                      } else {
                        showToast(`No product found matching: ${searchQuery}`);
                      }
                    } else if (e.key === 'Tab' && !e.shiftKey && !searchQuery.trim()) {
                      e.preventDefault();
                      scrollToCustomerDetails();
                      customerPhoneInputRef.current?.focus();
                      customerPhoneInputRef.current?.select();
                      showToast('Customer Details');
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      scrollToTop();
                      setIsSearchFocused(false);
                    }
                  }}
                  placeholder="Search product (Type name/SKU, or ↓ to select & edit cart item qty) • [F2 / Ctrl+F]"
                  className="w-full pl-10 pr-20 py-2.5 bg-white rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all shadow-xs font-medium"
                />
                <div className="absolute right-2.5 flex items-center gap-1">
                  {searchQuery && (
                    <button
                      type="button"
                      id="btn-clear-search-query"
                      onClick={() => {
                        setSearchQuery('');
                        setActiveSearchIndex(0);
                        searchInputRef.current?.focus();
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-500 border border-slate-200">
                    F2 / Ctrl+F
                  </span>
                </div>
              </form>

              {/* Product Search Results Dropdown */}
              {isSearchFocused && (
                <div
                  ref={searchDropdownRef}
                  className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl z-30 overflow-hidden flex flex-col max-h-80 animate-fade-in"
                >
                  {searchResults.length > 0 ? (
                    <>
                      {/* Header with keyboard instructions */}
                      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs shrink-0 font-medium">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-700">Matches ({searchResults.length})</span>
                          <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                            ↑↓ Navigate • ↵ Enter to set quantity
                          </span>
                        </div>
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

                      {/* Product List with Highlight for Active Row */}
                      <div className="overflow-y-auto divide-y divide-slate-100">
                        {searchResults.map((prod, idx) => {
                          const isHighlighted = idx === activeSearchIndex;
                          return (
                            <div
                              key={prod.productId}
                              onClick={() => handleSelectProduct(prod)}
                              className={`w-full px-4 py-2.5 flex items-center justify-between transition-colors text-xs cursor-pointer ${
                                isHighlighted
                                  ? 'bg-orange-50 text-slate-900 border-l-4 border-orange-500 font-medium'
                                  : 'hover:bg-slate-50/70 text-slate-800'
                              }`}
                            >
                              <div className="min-w-0 pr-3">
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-slate-900 truncate">{prod.name}</p>
                                  {isHighlighted && (
                                    <span className="bg-orange-500 text-white text-[10px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0">
                                      ↵ Enter to Add
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {prod.category} • Stock: {prod.stockQty} {prod.unit}
                                  {prod.skuCode ? ` • SKU: ${prod.skuCode}` : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="font-bold text-slate-900 font-mono">{formatINR(prod.sellingPrice)}</span>
                                <button
                                  type="button"
                                  tabIndex={-1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectProduct(prod);
                                  }}
                                  className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-semibold text-xs rounded-lg transition-all cursor-pointer shadow-xs flex items-center gap-1"
                                  title="Add product to cart and set quantity"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Add</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
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
              title="Clear all products from invoice and start new customer bill (Alt+X)"
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
                    onClick={() => handleAddToCart(prod, 1, prod.sellingPrice, true)}
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
                <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200" title="Jump to Cart Line Items (F3 / Alt+C)">
                  F3
                </span>
                {cartItems.length > 0 && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                    billPaperSize === 'a5'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-blue-100 text-blue-800 border-blue-200'
                  }`}>
                    {billPaperSize.toUpperCase()} Bill
                  </span>
                )}
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
                      {cartItems.map((item, index) => {
                        const isFocused = focusedCartProductId === item.productId;
                        const isSelected = selectedProductIds.includes(item.productId);
                        return (
                          <tr
                            key={item.productId}
                            className={`transition-colors ${
                              isFocused
                                ? 'bg-orange-100/70 ring-1 ring-orange-400'
                                : isSelected
                                ? 'bg-orange-50/40'
                                : 'hover:bg-slate-50/60'
                            }`}
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
                                id={`input-cart-price-${item.productId}`}
                                ref={(el) => {
                                  if (el) cartPriceInputsRef.current.set(item.productId, el);
                                  else cartPriceInputsRef.current.delete(item.productId);
                                }}
                                value={item.unitPrice}
                                onChange={(e) =>
                                  handleUpdatePrice(item.productId, Number(e.target.value) || 0)
                                }
                                onKeyDown={(e) => {
                                  const isCmdOrCtrl = e.ctrlKey || e.metaKey;
                                  if (isCmdOrCtrl && e.key === 'Enter') {
                                    e.preventDefault();
                                    if (cartItems.length > 0) handlePrintBill();
                                    return;
                                  }
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    scrollToTop();
                                    searchInputRef.current?.focus();
                                    searchInputRef.current?.select();
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    scrollToTop();
                                    searchInputRef.current?.focus();
                                  }
                                }}
                                className="w-20 px-2 py-1 text-right font-mono font-bold text-slate-900 border border-slate-200 hover:border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 rounded-lg bg-white shadow-2xs"
                                title="Click/Tab to override rate. Press Enter to return to search."
                              />
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  id={`input-cart-qty-${item.productId}`}
                                  ref={(el) => {
                                    if (el) cartQtyInputsRef.current.set(item.productId, el);
                                    else cartQtyInputsRef.current.delete(item.productId);
                                  }}
                                  value={qtyDrafts[item.productId] !== undefined ? qtyDrafts[item.productId] : String(item.quantity)}
                                  onFocus={(e) => {
                                    e.currentTarget.select();
                                    setFocusedCartProductId(item.productId);
                                  }}
                                  onBlur={() => {
                                    const raw = qtyDrafts[item.productId];
                                    if (raw !== undefined) {
                                      const parsed = parseFloat(raw);
                                      const safeQty = !isNaN(parsed) && parsed > 0 ? parsed : 1;
                                      handleSetQty(item.productId, safeQty);
                                      setQtyDrafts((prev) => {
                                        const copy = { ...prev };
                                        delete copy[item.productId];
                                        return copy;
                                      });
                                    }
                                    setFocusedCartProductId(null);
                                  }}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    // Allow manual typing: digits, decimal point, or completely empty
                                    if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                                      setQtyDrafts((prev) => ({ ...prev, [item.productId]: raw }));
                                      const val = parseFloat(raw);
                                      if (!isNaN(val) && val > 0) {
                                        handleSetQty(item.productId, val);
                                      }
                                    }
                                  }}
                                  onKeyDown={(e) => handleCartQtyKeyDown(e, item.productId, index)}
                                  className="w-20 px-2 py-1.5 text-center font-bold text-slate-900 font-mono text-sm border-2 border-slate-200 hover:border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 rounded-lg bg-white shadow-2xs transition-all"
                                  title="Type quantity directly (manual typing). Press Enter to confirm, ↓/↑ to navigate items"
                                  placeholder="1"
                                />
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
                                title="Remove item (or Alt+Del when on quantity input)"
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
          <div ref={customerDetailsSectionRef} className="space-y-3 p-4 bg-slate-50/70 rounded-xl border border-slate-200/70">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  scrollToCustomerDetails();
                  customerSearchInputRef.current?.focus();
                  customerSearchInputRef.current?.select();
                }}
                className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 hover:text-orange-600 transition-colors cursor-pointer text-left"
              >
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span>Customer Details</span>
                <span className="text-slate-400 font-normal text-[11px] lowercase">(optional)</span>
              </button>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded border border-orange-200">
                  F4
                </span>
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
                      setCustomerSearchQuery('');
                      setIsCustomerSearchOpen(false);
                      scrollToCustomerDetails();
                      customerSearchInputRef.current?.focus();
                      customerSearchInputRef.current?.select();
                    }}
                    className="text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors cursor-pointer"
                  >
                    + New
                  </button>
                )}
              </div>
            </div>

            {/* Customer Search & New Customer Flow */}
            <div className="space-y-1.5 relative">
              <label className="block text-[11px] font-semibold text-slate-600">
                Customer Search / New <span className="text-slate-400 font-normal">(F4)</span>
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  id="input-customer-quick-search"
                  ref={customerSearchInputRef}
                  value={customerSearchQuery}
                  onChange={(e) => {
                    const q = e.target.value;
                    setCustomerSearchQuery(q);
                    setIsCustomerSearchOpen(true);
                    setActiveCustomerSearchIndex(0);
                  }}
                  onFocus={(e) => {
                    e.target.select();
                    if (customerSearchQuery.trim().length > 0) {
                      setIsCustomerSearchOpen(true);
                    }
                  }}
                  onKeyDown={(e) => {
                    const filteredCusts = customers.filter((c) => {
                      if (c.customerId === 'cust-1') return false;
                      if (!customerSearchQuery.trim()) return false;
                      const q = customerSearchQuery.toLowerCase();
                      return c.name?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q);
                    });

                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      if (filteredCusts.length > 0) {
                        setIsCustomerSearchOpen(true);
                        setActiveCustomerSearchIndex((prev) => (prev + 1) % filteredCusts.length);
                      }
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      if (filteredCusts.length > 0) {
                        setIsCustomerSearchOpen(true);
                        setActiveCustomerSearchIndex((prev) => (prev - 1 + filteredCusts.length) % filteredCusts.length);
                      }
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      if (isCustomerSearchOpen && filteredCusts.length > 0) {
                        const selected = filteredCusts[activeCustomerSearchIndex] || filteredCusts[0];
                        if (selected) {
                          setSelectedCustomerId(selected.customerId);
                          setCustomerName(selected.name);
                          setCustomerPhone(selected.phone || '');
                          setCustomerAddress(selected.siteAddress || selected.address || '');
                          setCustomerGstin(selected.gstin || '');
                          setCustomerCategory((selected.customerType as any) || 'walk-in');
                          setCustomerSearchQuery(selected.name);
                          setIsCustomerSearchOpen(false);
                          showToast(`Selected customer: ${selected.name} • Continuing to details`);
                          customerPhoneInputRef.current?.focus();
                          customerPhoneInputRef.current?.select();
                        }
                      } else {
                        setIsCustomerSearchOpen(false);
                        customerPhoneInputRef.current?.focus();
                        customerPhoneInputRef.current?.select();
                        showToast('Proceeded to Mobile Number • Enter new customer details');
                      }
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setIsCustomerSearchOpen(false);
                      scrollToTop();
                      searchInputRef.current?.focus();
                    }
                  }}
                  placeholder="Type name or phone to search existing, or press Enter to continue..."
                  className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 font-medium"
                />
              </div>

              {/* Customer Search Dropdown Results */}
              {isCustomerSearchOpen && customerSearchQuery.trim().length > 0 && (
                <div
                  ref={customerSearchDropdownRef}
                  className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl z-30 overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-100"
                >
                  {customers
                    .filter((c) => {
                      if (c.customerId === 'cust-1') return false;
                      const q = customerSearchQuery.toLowerCase();
                      return c.name?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q);
                    })
                    .length > 0 ? (
                    customers
                      .filter((c) => {
                        if (c.customerId === 'cust-1') return false;
                        const q = customerSearchQuery.toLowerCase();
                        return c.name?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q);
                      })
                      .map((c, idx) => {
                        const isHighlighted = idx === activeCustomerSearchIndex;
                        return (
                          <div
                            key={c.customerId}
                            onClick={() => {
                              setSelectedCustomerId(c.customerId);
                              setCustomerName(c.name);
                              setCustomerPhone(c.phone || '');
                              setCustomerAddress(c.siteAddress || c.address || '');
                              setCustomerGstin(c.gstin || '');
                              setCustomerCategory((c.customerType as any) || 'walk-in');
                              setCustomerSearchQuery(c.name);
                              setIsCustomerSearchOpen(false);
                              showToast(`Selected customer: ${c.name} • Continuing to details`);
                              customerPhoneInputRef.current?.focus();
                              customerPhoneInputRef.current?.select();
                            }}
                            className={`px-3.5 py-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                              isHighlighted ? 'bg-orange-50 text-slate-900 font-medium border-l-4 border-orange-500' : 'hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <div>
                              <p className="font-bold text-slate-900">{c.name}</p>
                              <p className="text-[11px] text-slate-500">
                                {c.phone ? `Phone: ${c.phone}` : ''} {c.customerType ? `• ${c.customerType}` : ''}
                              </p>
                            </div>
                            {isHighlighted && (
                              <span className="text-[10px] font-mono bg-orange-500 text-white px-1.5 py-0.5 rounded font-bold">
                                ↵ Select
                              </span>
                            )}
                          </div>
                        );
                      })
                  ) : (
                    <div className="px-4 py-3 text-xs text-slate-500 text-center">
                      No matching customer found. Press Enter to add new.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Customer Name and Mobile Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Mobile Number
                </label>
                <input
                  ref={customerPhoneInputRef}
                  type="tel"
                  id="input-customer-phone"
                  value={customerPhone}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomerPhone(val);
                    // If exact 10 digits or match, check existing customer
                    const cleanPhone = val.trim().replace(/\D/g, '');
                    if (cleanPhone.length >= 10) {
                      const match = customers.find((c) => c.phone && c.phone.replace(/\D/g, '') === cleanPhone);
                      if (match) {
                        setSelectedCustomerId(match.customerId);
                        setCustomerName(match.name);
                        setCustomerAddress(match.siteAddress || match.address || '');
                        setCustomerGstin(match.gstin || '');
                        setCustomerCategory((match.customerType as any) || 'walk-in');
                        showToast(`Customer identified: ${match.name}`);
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      customerNameInputRef.current?.focus();
                      customerNameInputRef.current?.select();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      scrollToTop();
                      searchInputRef.current?.focus();
                    }
                  }}
                  placeholder="10-digit mobile"
                  className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Name <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  ref={customerNameInputRef}
                  type="text"
                  id="input-customer-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      customerAddressInputRef.current?.focus();
                      customerAddressInputRef.current?.select();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      scrollToTop();
                      searchInputRef.current?.focus();
                    }
                  }}
                  placeholder="Walk-in Customer"
                  className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 font-medium"
                />
              </div>
            </div>

            {/* Site Address */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Site Address
              </label>
              <input
                ref={customerAddressInputRef}
                type="text"
                id="input-customer-address"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    customerGstinInputRef.current?.focus();
                    customerGstinInputRef.current?.select();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    scrollToTop();
                    searchInputRef.current?.focus();
                  }
                }}
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
                  ref={customerGstinInputRef}
                  type="text"
                  id="input-customer-gstin"
                  value={customerGstin}
                  onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      focusAndSelectDiscountInput();
                      showToast('Proceeded to Discount input');
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      scrollToTop();
                      searchInputRef.current?.focus();
                    }
                  }}
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
          <div ref={paymentSectionRef} className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Payment Method</label>
              <span className="font-mono text-[10px] text-slate-400">F7-F10 / Alt+1-4</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {/* Cash */}
              <button
                type="button"
                id="btn-pay-cash"
                onClick={() => {
                  focusCashTendered();
                }}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
                  paymentMethod === 'cash'
                    ? 'bg-orange-500 text-white font-bold border-orange-500 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Banknote className="w-4 h-4" />
                  <span>Cash</span>
                </div>
                <span className={`text-[10px] font-mono px-1 rounded ${paymentMethod === 'cash' ? 'bg-orange-600 text-white' : 'text-slate-400 bg-slate-100'}`}>
                  F7
                </span>
              </button>

              {/* UPI */}
              <button
                type="button"
                id="btn-pay-upi"
                onClick={() => {
                  setPaymentMethod('upi');
                  scrollToBottom();
                }}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
                  paymentMethod === 'upi'
                    ? 'bg-orange-500 text-white font-bold border-orange-500 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4" />
                  <span>UPI</span>
                </div>
                <span className={`text-[10px] font-mono px-1 rounded ${paymentMethod === 'upi' ? 'bg-orange-600 text-white' : 'text-slate-400 bg-slate-100'}`}>
                  F8
                </span>
              </button>

              {/* Card */}
              <button
                type="button"
                id="btn-pay-card"
                onClick={() => {
                  setPaymentMethod('card');
                  scrollToBottom();
                }}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
                  paymentMethod === 'card'
                    ? 'bg-orange-500 text-white font-bold border-orange-500 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4" />
                  <span>Card</span>
                </div>
                <span className={`text-[10px] font-mono px-1 rounded ${paymentMethod === 'card' ? 'bg-orange-600 text-white' : 'text-slate-400 bg-slate-100'}`}>
                  F9
                </span>
              </button>

              {/* Credit (Due) */}
              <button
                type="button"
                id="btn-pay-credit"
                onClick={() => {
                  setPaymentMethod('credit');
                  const trimmedName = customerName.trim();
                  const isGenericWalkIn = !trimmedName || trimmedName === 'Walk-in Customer (General)' || trimmedName === 'Walk-in Customer';
                  const cleanPhone = customerPhone.trim().replace(/\D/g, '');
                  const isMissingPhone = !customerPhone.trim() || cleanPhone.length < 10;

                  if (isGenericWalkIn || isMissingPhone) {
                    scrollToCustomerDetails();
                    if (isGenericWalkIn) {
                      customerSearchInputRef.current?.focus();
                      customerSearchInputRef.current?.select();
                    } else {
                      customerPhoneInputRef.current?.focus();
                      customerPhoneInputRef.current?.select();
                    }
                    showToast('Customer Name & Mobile Number required for Credit bills');
                  } else {
                    scrollToBottom();
                    setTimeout(() => paymentDueDateInputRef.current?.focus(), 50);
                  }
                }}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
                  paymentMethod === 'credit'
                    ? 'bg-orange-500 text-white font-bold border-orange-500 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  <span>Credit (Due)</span>
                </div>
                <span className={`text-[10px] font-mono px-1 rounded ${paymentMethod === 'credit' ? 'bg-orange-600 text-white' : 'text-slate-400 bg-slate-100'}`}>
                  F10
                </span>
              </button>
            </div>
          </div>

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
                ref={paymentDueDateInputRef}
                type="date"
                required
                id="input-payment-due-date"
                value={paymentDueDate}
                onChange={(e) => setPaymentDueDate(e.target.value)}
                onKeyDown={(e) => {
                  const isCmdOrCtrl = e.ctrlKey || e.metaKey;
                  if (isCmdOrCtrl && (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter')) {
                    e.preventDefault();
                    if (cartItems.length > 0) handlePrintBill();
                    else showToast('Cart is empty. Search products first.');
                  } else if (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter') {
                    e.preventDefault();
                    focusAndSelectDiscountInput();
                    showToast('Due date saved • Discount selected');
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    scrollToTop();
                    searchInputRef.current?.focus();
                  }
                }}
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
                <span className="font-mono text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded border border-orange-200">
                  Alt+D
                </span>
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

            {/* Input Field based on Mode (Direct manual typing only) */}
            {discountType === 'amount' ? (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                  ₹
                </span>
                <input
                  ref={discountAmountInputRef}
                  id="input-discount-amount"
                  type="text"
                  inputMode="decimal"
                  value={discountAmountInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      setDiscountAmountInput(val);
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      return;
                    }
                    const isCmdOrCtrl = e.ctrlKey || e.metaKey;
                    if (isCmdOrCtrl && (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter')) {
                      e.preventDefault();
                      if (cartItems.length > 0) handlePrintBill();
                      else showToast('Cart is empty. Search products first.');
                      return;
                    }
                    if (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter') {
                      e.preventDefault();
                      showToast(parseFloat(discountAmountInput) > 0 ? `Discount ₹${discountAmountInput} applied • Back to product search` : 'Discount saved • Back to product search');
                      scrollToTop();
                      searchInputRef.current?.focus();
                      searchInputRef.current?.select();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      scrollToTop();
                      searchInputRef.current?.focus();
                    }
                  }}
                  placeholder="0.00"
                  className="w-full pl-7 pr-10 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-orange-500 font-mono font-bold shadow-2xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                  ref={discountPercentInputRef}
                  id="input-discount-percent"
                  type="text"
                  inputMode="decimal"
                  value={discountPercentInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      const num = parseFloat(val);
                      if (val === '' || (!isNaN(num) && num <= 100)) {
                        setDiscountPercentInput(val);
                      }
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      return;
                    }
                    const isCmdOrCtrl = e.ctrlKey || e.metaKey;
                    if (isCmdOrCtrl && (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter')) {
                      e.preventDefault();
                      if (cartItems.length > 0) handlePrintBill();
                      else showToast('Cart is empty. Search products first.');
                      return;
                    }
                    if (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter') {
                      e.preventDefault();
                      showToast(parseFloat(discountPercentInput) > 0 ? `Discount ${discountPercentInput}% applied • Back to product search` : 'Discount saved • Back to product search');
                      scrollToTop();
                      searchInputRef.current?.focus();
                      searchInputRef.current?.select();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      scrollToTop();
                      searchInputRef.current?.focus();
                    }
                  }}
                  placeholder="0"
                  className="w-full px-3 pr-10 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-orange-500 font-mono font-bold shadow-2xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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

            {/* Clear Discount button if discount is entered */}
            {((discountType === 'amount' && discountAmountInput !== '') ||
              (discountType === 'percentage' && discountPercentInput !== '')) && (
              <div className="flex items-center justify-end pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setDiscountAmountInput('');
                    setDiscountPercentInput('');
                  }}
                  className="px-2 py-0.5 text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                >
                  Clear Discount
                </button>
              </div>
            )}
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

          {/* Simple A4 & A5 Paper Size Selection */}
          <div ref={sizeAndPrintSectionRef} className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-700">Paper Format</span>
              <span className="text-[10px] text-slate-400">
                Print Size
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="btn-bill-size-a4"
                onClick={() => {
                  setBillPaperSize('a4');
                  scrollToBottom();
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-between gap-1.5 transition-all cursor-pointer border ${
                  billPaperSize === 'a4'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
                title="A4 Full Sheet Bill (Alt+4)"
              >
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>A4</span>
                </div>
                <span className="text-[10px] font-mono opacity-70">Alt+4</span>
              </button>
              <button
                type="button"
                id="btn-bill-size-a5"
                onClick={() => {
                  setBillPaperSize('a5');
                  scrollToBottom();
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-between gap-1.5 transition-all cursor-pointer border ${
                  billPaperSize === 'a5'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
                title="A5 Half Sheet Bill (Alt+5)"
              >
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>A5</span>
                </div>
                <span className="text-[10px] font-mono opacity-80">Alt+5</span>
              </button>
            </div>
          </div>

          {/* Print Bill & Hold Bill Actions */}
          <div className="pt-2 space-y-2.5">
            <button
              ref={printBillBtnRef}
              type="button"
              id="btn-print-bill"
              disabled={cartItems.length === 0}
              onClick={handlePrintBill}
              className={`w-full py-4 px-4 rounded-xl font-bold text-base flex items-center justify-center gap-2.5 transition-all shadow-md ${
                cartItems.length > 0
                  ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white cursor-pointer hover:shadow-lg'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
              }`}
              title="Print bill, record sale in history & clear for next invoice (Ctrl+Enter)"
            >
              <Printer className="w-5 h-5 text-white shrink-0" />
              <span>Print Bill</span>
              <span className="text-xs font-mono font-bold bg-emerald-800/80 px-2 py-0.5 rounded text-emerald-100 ml-1">
                Ctrl+↵
              </span>
            </button>

            {/* 1-Click Hold Bill & Start Blank Bill for Next Customer */}
            <button
              type="button"
              id="btn-sidebar-hold-bill"
              disabled={cartItems.length === 0}
              onClick={handleHoldAndNewBill}
              className={`w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all border shadow-2xs ${
                cartItems.length > 0
                  ? 'bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-slate-950 border-amber-600/40 cursor-pointer shadow-amber-500/20'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              }`}
              title="1-Click: Hold current bill and open fresh bill for next customer (F6)"
            >
              <Pause className="w-4 h-4 fill-current shrink-0" />
              <span>Hold & New Bill</span>
              <span className="text-[11px] font-mono font-bold bg-amber-600/60 px-1.5 py-0.5 rounded text-amber-950">
                F6
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* POS Keyboard Shortcuts Quick Reference Guide Modal (F1) */}
      {showShortcutsHelp && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-orange-400" />
                <h3 className="font-bold text-base text-white">Full Keyboard POS Speed Billing Guide</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcutsHelp(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs text-slate-700">
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-orange-950">
                <p className="font-bold text-xs flex items-center gap-1.5 mb-1">
                  ⚡ 100% Zero-Mouse POS Workflow:
                </p>
                <p className="text-[11px] leading-relaxed text-orange-900">
                  You can create entire bills, add products, adjust quantities, enter customer mobile, and print invoices without touching the cursor or mouse once!
                </p>
              </div>

              {/* Table of Shortcuts */}
              <div className="space-y-3">
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100/80 px-3 py-1.5 font-bold text-slate-900 uppercase text-[10px] tracking-wider border-b border-slate-200">
                    1. Product Search & Adding
                  </div>
                  <div className="divide-y divide-slate-100">
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span>Focus Product Search bar</span>
                      <kbd className="font-mono font-bold bg-slate-100 text-slate-900 px-2 py-0.5 rounded border border-slate-300">
                        F2 or Ctrl+F or /
                      </kbd>
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span>Jump from Search bar to edit Cart Item Quantity</span>
                      <kbd className="font-mono font-bold bg-orange-100 text-orange-800 px-2 py-0.5 rounded border border-orange-300">
                        ↓ Down Arrow (when search empty)
                      </kbd>
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span>Navigate search results list</span>
                      <kbd className="font-mono font-bold bg-slate-100 text-slate-900 px-2 py-0.5 rounded border border-slate-300">
                        ↑ Up / ↓ Down
                      </kbd>
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="font-semibold text-orange-950">Add highlighted product & jump to Quantity</span>
                      <kbd className="font-mono font-bold bg-orange-500 text-white px-2 py-0.5 rounded">
                        ↵ Enter
                      </kbd>
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span>Close search results dropdown</span>
                      <kbd className="font-mono font-bold bg-slate-100 text-slate-900 px-2 py-0.5 rounded border border-slate-300">
                        Escape
                      </kbd>
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100/80 px-3 py-1.5 font-bold text-slate-900 uppercase text-[10px] tracking-wider border-b border-slate-200">
                    2. Selecting & Adjusting Quantity
                  </div>
                  <div className="divide-y divide-slate-100">
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span>Manual Quantity Typing</span>
                      <kbd className="font-mono font-bold bg-slate-100 text-slate-900 px-2 py-0.5 rounded border border-slate-300">
                        Type numbers directly / Backspace
                      </kbd>
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="font-semibold text-orange-950">Confirm Quantity & jump back to Search next item</span>
                      <kbd className="font-mono font-bold bg-orange-500 text-white px-2 py-0.5 rounded">
                        ↵ Enter
                      </kbd>
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span>Switch between cart item quantity inputs</span>
                      <kbd className="font-mono font-bold bg-slate-100 text-slate-900 px-2 py-0.5 rounded border border-slate-300">
                        ↑ / ↓ Arrow keys
                      </kbd>
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span>Delete item while on quantity field</span>
                      <kbd className="font-mono font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-200">
                        Alt + Delete / Backspace
                      </kbd>
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span>Tab to Unit Price (Special Contractor Rate)</span>
                      <kbd className="font-mono font-bold bg-slate-100 text-slate-900 px-2 py-0.5 rounded border border-slate-300">
                        Tab
                      </kbd>
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100/80 px-3 py-1.5 font-bold text-slate-900 uppercase text-[10px] tracking-wider border-b border-slate-200">
                    3. Customer Details & Billing Info
                  </div>
                  <div className="divide-y divide-slate-100">
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span>Jump to Customer Details</span>
                      <kbd className="font-mono font-bold bg-slate-100 text-slate-900 px-2 py-0.5 rounded border border-slate-300">
                        F4 or Alt+K
                      </kbd>
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span>Advance through fields (Mobile → Name → Address → GSTIN → Payment)</span>
                      <kbd className="font-mono font-bold bg-slate-100 text-slate-900 px-2 py-0.5 rounded border border-slate-300">
                        ↵ Enter
                      </kbd>
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span>Return from customer fields back to product search</span>
                      <kbd className="font-mono font-bold bg-slate-100 text-slate-900 px-2 py-0.5 rounded border border-slate-300">
                        Escape
                      </kbd>
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100/80 px-3 py-1.5 font-bold text-slate-900 uppercase text-[10px] tracking-wider border-b border-slate-200">
                    4. Payment, Formats & Printing
                  </div>
                  <div className="divide-y divide-slate-100">
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span>Cash Payment & enter Cash Tendered</span>
                      <kbd className="font-mono font-bold bg-slate-100 text-slate-900 px-2 py-0.5 rounded border border-slate-300">
                        F7 or Alt+1
                      </kbd>
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span>UPI / QR Payment</span>
                      <kbd className="font-mono font-bold bg-slate-100 text-slate-900 px-2 py-0.5 rounded border border-slate-300">
                        F8 or Alt+2
                      </kbd>
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span>Card Payment</span>
                      <kbd className="font-mono font-bold bg-slate-100 text-slate-900 px-2 py-0.5 rounded border border-slate-300">
                        F9 or Alt+3
                      </kbd>
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span>Credit (Khata Due) & Due Date</span>
                      <kbd className="font-mono font-bold bg-slate-100 text-slate-900 px-2 py-0.5 rounded border border-slate-300">
                        F10
                      </kbd>
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span>Enter Discount amount/percent</span>
                      <kbd className="font-mono font-bold bg-slate-100 text-slate-900 px-2 py-0.5 rounded border border-slate-300">
                        Alt+D
                      </kbd>
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span>Select A4 / A5 Paper Size</span>
                      <kbd className="font-mono font-bold bg-slate-100 text-slate-900 px-2 py-0.5 rounded border border-slate-300">
                        Alt+4 / Alt+5
                      </kbd>
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="font-bold text-emerald-800">Print Bill & Finalize Invoice</span>
                      <kbd className="font-mono font-bold bg-emerald-600 text-white px-2 py-0.5 rounded">
                        Ctrl+Enter (or ⌘+Enter)
                      </kbd>
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="font-bold text-amber-800">1-Click Hold Bill & Start Blank Bill</span>
                      <kbd className="font-mono font-bold bg-amber-500 text-black px-2 py-0.5 rounded">
                        F6
                      </kbd>
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span>Clear Bill / Discard items</span>
                      <kbd className="font-mono font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded border border-rose-300">
                        Alt+X
                      </kbd>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowShortcutsHelp(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Got It (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingScreen;
