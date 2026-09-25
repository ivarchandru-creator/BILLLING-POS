import React, { useState, useMemo } from 'react';
import {
  Truck,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Building2,
  X,
  FileText,
  IndianRupee,
  CreditCard,
  History,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Download,
  Edit2,
  Trash2,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import {
  Supplier,
  Product,
  StockTransaction,
  SupplierTransaction,
  ShopSettings,
  SupplierPaymentMode,
} from '../types';
import { formatINR, getCurrentDateTimeFormatted } from '../utils/formatters';
import { downloadSupplierLedgerPdf } from '../utils/pdfGenerator';

interface SuppliersViewProps {
  suppliers: Supplier[];
  products: Product[];
  stockTransactions: StockTransaction[];
  supplierTransactions?: SupplierTransaction[];
  settings?: ShopSettings;
  onSaveSupplier: (supplier: Supplier) => void;
  onDeleteSupplier?: (supplierId: string) => void;
  onSaveSupplierTransaction?: (tx: SupplierTransaction, updatedSupplier?: Supplier) => void;
}

type SupplierFilter = 'all' | 'with_due' | 'settled' | 'gst' | 'unregistered';

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  suppliers,
  products,
  stockTransactions,
  supplierTransactions = [],
  settings,
  onSaveSupplier,
  onDeleteSupplier,
  onSaveSupplierTransaction,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<SupplierFilter>('all');

  // Modals
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);

  const [selectedSupplierDetails, setSelectedSupplierDetails] = useState<Supplier | null>(null);
  const [payModalSupplier, setPayModalSupplier] = useState<Supplier | null>(null);
  const [deleteConfirmSupplier, setDeleteConfirmSupplier] = useState<Supplier | null>(null);

  // Form State (Add/Edit)
  const [formCompany, setFormCompany] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formGstin, setFormGstin] = useState('');
  const [formBalance, setFormBalance] = useState('0');
  const [formNotes, setFormNotes] = useState('');

  // Payment Modal State
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState<SupplierPaymentMode>('UPI');
  const [payRefNo, setPayRefNo] = useState('');
  const [payDate, setPayDate] = useState(getCurrentDateTimeFormatted());
  const [payNotes, setPayNotes] = useState('');

  // Details Modal Sub-Tabs
  const [detailsTab, setDetailsTab] = useState<'ledger' | 'add_bill' | 'adjust'>('ledger');
  const [billAmount, setBillAmount] = useState('');
  const [billRefNo, setBillRefNo] = useState('');
  const [billNotes, setBillNotes] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  // Open Add Supplier Modal
  const openNewSupplierModal = () => {
    setEditingSupplierId(null);
    setFormCompany('');
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormGstin('');
    setFormBalance('0');
    setFormNotes('');
    setIsAddEditModalOpen(true);
  };

  // Open Edit Supplier Modal
  const openEditSupplierModal = (sup: Supplier) => {
    setEditingSupplierId(sup.supplierId);
    setFormCompany(sup.companyName);
    setFormName(sup.name);
    setFormPhone(sup.phone);
    setFormEmail(sup.email || '');
    setFormAddress(sup.address || '');
    setFormGstin(sup.gstin || '');
    setFormBalance(String(sup.balance ?? 0));
    setFormNotes(sup.notes || '');
    setIsAddEditModalOpen(true);
  };

  // Handle Save Supplier (Add or Edit)
  const handleSaveSupplierForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCompany.trim() || !formPhone.trim()) return;

    const parsedBalance = Number(formBalance) || 0;

    if (editingSupplierId) {
      const existing = suppliers.find((s) => s.supplierId === editingSupplierId);
      if (!existing) return;

      const updatedSupplier: Supplier = {
        ...existing,
        companyName: formCompany.trim(),
        name: formName.trim() || formCompany.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim() || undefined,
        address: formAddress.trim() || undefined,
        gstin: formGstin.trim() ? formGstin.trim().toUpperCase() : undefined, // Optional GSTIN
        balance: parsedBalance,
        notes: formNotes.trim() || undefined,
      };

      onSaveSupplier(updatedSupplier);

      // Keep details view in sync if open
      if (selectedSupplierDetails?.supplierId === editingSupplierId) {
        setSelectedSupplierDetails(updatedSupplier);
      }
    } else {
      const newSupplierId = `sup-${Date.now()}`;
      const newSupplier: Supplier = {
        supplierId: newSupplierId,
        companyName: formCompany.trim(),
        name: formName.trim() || formCompany.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim() || undefined,
        address: formAddress.trim() || undefined,
        gstin: formGstin.trim() ? formGstin.trim().toUpperCase() : undefined, // Optional GSTIN
        activeStatus: true,
        balance: parsedBalance,
        notes: formNotes.trim() || undefined,
      };

      onSaveSupplier(newSupplier);

      // If opening balance was set > 0, log an initial transaction
      if (parsedBalance !== 0 && onSaveSupplierTransaction) {
        const initTx: SupplierTransaction = {
          id: `stx-${Date.now()}`,
          supplierId: newSupplierId,
          date: getCurrentDateTimeFormatted(),
          type: 'opening_balance',
          amount: parsedBalance,
          referenceNo: 'OPENING-BAL',
          notes: 'Initial opening balance owed to supplier',
          balanceAfter: parsedBalance,
        };
        onSaveSupplierTransaction(initTx);
      }
    }

    setIsAddEditModalOpen(false);
  };

  // Open Quick Pay Modal
  const openPayModal = (sup: Supplier) => {
    setPayModalSupplier(sup);
    setPayAmount(String(sup.balance && sup.balance > 0 ? sup.balance : ''));
    setPayMode('UPI');
    setPayRefNo('');
    setPayDate(getCurrentDateTimeFormatted());
    setPayNotes('');
  };

  // Handle Record Payment
  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalSupplier) return;

    const amountNum = parseFloat(payAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const currentBalance = payModalSupplier.balance || 0;
    const newBalance = Number((currentBalance - amountNum).toFixed(2));

    const updatedSupplier: Supplier = {
      ...payModalSupplier,
      balance: newBalance,
    };

    const newTx: SupplierTransaction = {
      id: `stx-${Date.now()}`,
      supplierId: payModalSupplier.supplierId,
      date: payDate || getCurrentDateTimeFormatted(),
      type: 'payment',
      amount: amountNum,
      paymentMode: payMode,
      referenceNo: payRefNo.trim() || undefined,
      notes: payNotes.trim() || undefined,
      balanceAfter: newBalance,
    };

    if (onSaveSupplierTransaction) {
      onSaveSupplierTransaction(newTx, updatedSupplier);
    } else {
      onSaveSupplier(updatedSupplier);
    }

    if (selectedSupplierDetails?.supplierId === payModalSupplier.supplierId) {
      setSelectedSupplierDetails(updatedSupplier);
    }

    setPayModalSupplier(null);
  };

  // Handle Add Purchase Bill from Details Modal
  const handleAddPurchaseBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierDetails) return;

    const amountNum = parseFloat(billAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const currentBalance = selectedSupplierDetails.balance || 0;
    const newBalance = Number((currentBalance + amountNum).toFixed(2));

    const updatedSupplier: Supplier = {
      ...selectedSupplierDetails,
      balance: newBalance,
    };

    const newTx: SupplierTransaction = {
      id: `stx-${Date.now()}`,
      supplierId: selectedSupplierDetails.supplierId,
      date: getCurrentDateTimeFormatted(),
      type: 'purchase_bill',
      amount: amountNum,
      referenceNo: billRefNo.trim() || undefined,
      notes: billNotes.trim() || 'Purchased goods / consignment invoice',
      balanceAfter: newBalance,
    };

    if (onSaveSupplierTransaction) {
      onSaveSupplierTransaction(newTx, updatedSupplier);
    } else {
      onSaveSupplier(updatedSupplier);
    }

    setSelectedSupplierDetails(updatedSupplier);
    setBillAmount('');
    setBillRefNo('');
    setBillNotes('');
    setDetailsTab('ledger');
  };

  // Handle Direct Balance Adjustment from Details Modal
  const handleAdjustBalance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierDetails) return;

    const newBalance = parseFloat(adjustAmount);
    if (isNaN(newBalance)) return;

    const currentBalance = selectedSupplierDetails.balance || 0;
    const diff = newBalance - currentBalance;

    const updatedSupplier: Supplier = {
      ...selectedSupplierDetails,
      balance: newBalance,
    };

    const newTx: SupplierTransaction = {
      id: `stx-${Date.now()}`,
      supplierId: selectedSupplierDetails.supplierId,
      date: getCurrentDateTimeFormatted(),
      type: 'adjustment',
      amount: Math.abs(diff),
      referenceNo: 'RECONCILIATION',
      notes: adjustReason.trim() || 'Manual account reconciliation / correction',
      balanceAfter: newBalance,
    };

    if (onSaveSupplierTransaction) {
      onSaveSupplierTransaction(newTx, updatedSupplier);
    } else {
      onSaveSupplier(updatedSupplier);
    }

    setSelectedSupplierDetails(updatedSupplier);
    setAdjustAmount('');
    setAdjustReason('');
    setDetailsTab('ledger');
  };

  // Filter suppliers by search query & category chip
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.companyName.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        (s.gstin && s.gstin.toLowerCase().includes(q)) ||
        (s.address && s.address.toLowerCase().includes(q)) ||
        (s.notes && s.notes.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      const balance = s.balance || 0;
      if (filterType === 'with_due' && balance <= 0) return false;
      if (filterType === 'settled' && balance !== 0) return false;
      if (filterType === 'gst' && !s.gstin) return false;
      if (filterType === 'unregistered' && s.gstin) return false;

      return true;
    });
  }, [suppliers, searchQuery, filterType]);

  // Overall Statistics
  const totalBalanceToPay = useMemo(() => {
    return suppliers.reduce((acc, s) => acc + (s.balance && s.balance > 0 ? s.balance : 0), 0);
  }, [suppliers]);

  const suppliersWithDue = useMemo(() => {
    return suppliers.filter((s) => (s.balance || 0) > 0).length;
  }, [suppliers]);

  const gstRegisteredCount = useMemo(() => {
    return suppliers.filter((s) => Boolean(s.gstin)).length;
  }, [suppliers]);

  // Transactions for selected supplier in details modal
  const selectedSupplierTxList = useMemo(() => {
    if (!selectedSupplierDetails) return [];
    return supplierTransactions
      .filter((tx) => tx.supplierId === selectedSupplierDetails.supplierId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedSupplierDetails, supplierTransactions]);

  return (
    <div className="w-full h-full p-6 sm:p-8 overflow-y-auto space-y-6 bg-slate-50/50">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Suppliers & Vendors
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200">
              {suppliers.length} Total
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Wholesale distributors and payables.
          </p>
        </div>

        <button
          type="button"
          id="btn-add-supplier"
          onClick={openNewSupplierModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Supplier</span>
        </button>
      </div>

      {/* 2. Top Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Suppliers */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Suppliers</span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-slate-900 font-mono">{suppliers.length}</span>
          </div>
        </div>

        {/* Metric 2: Total Balance to Pay (Payables) */}
        <div className="bg-white rounded-xl p-4 border border-rose-200/90 shadow-2xs bg-gradient-to-br from-white to-rose-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-700">Total Balance to Pay</span>
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-rose-700 font-mono">
              {formatINR(totalBalanceToPay)}
            </span>
          </div>
        </div>

        {/* Metric 3: Settled Suppliers */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Cleared / Settled</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-emerald-700 font-mono">
              {suppliers.length - suppliersWithDue}
            </span>
          </div>
        </div>

        {/* Metric 4: GST Status */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">GST Registered</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-blue-700 font-mono">{gstRegisteredCount}</span>
          </div>
        </div>
      </div>

      {/* 3. Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by vendor name, contact person, phone, GSTIN, or products supplied..."
            className="w-full pl-11 pr-10 py-2.5 bg-white rounded-xl border border-slate-200/90 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 text-xs">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              filterType === 'all'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({suppliers.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('with_due')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              filterType === 'with_due'
                ? 'bg-rose-500 text-white shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-rose-600'
            }`}
          >
            With Dues ({suppliersWithDue})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('settled')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              filterType === 'settled'
                ? 'bg-emerald-600 text-white shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-emerald-600'
            }`}
          >
            Settled ({suppliers.length - suppliersWithDue})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('gst')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              filterType === 'gst'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            GST Registered
          </button>
          <button
            type="button"
            onClick={() => setFilterType('unregistered')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              filterType === 'unregistered'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Non-GST (Optional)
          </button>
        </div>
      </div>

      {/* 4. Suppliers Table Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 text-[10.5px] uppercase font-bold text-slate-500 border-b border-slate-200 tracking-wider">
              <tr>
                <th className="py-3.5 px-5">Vendor / Company</th>
                <th className="py-3.5 px-4">Contact & Phone</th>
                <th className="py-3.5 px-4">GSTIN (Optional)</th>
                <th className="py-3.5 px-4">Address / Godown</th>
                <th className="py-3.5 px-4 text-right">Balance to Pay</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
                      <Truck className="w-6 h-6 stroke-[1.5]" />
                    </div>
                    <p className="text-sm text-slate-700 font-semibold">No suppliers found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchQuery
                        ? 'Try changing your search query or filter chip.'
                        : 'Click "Add New Supplier" to create your first vendor.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((sup) => {
                  const balance = sup.balance ?? 0;
                  const hasDue = balance > 0;
                  const isSettled = balance === 0;

                  return (
                    <tr key={sup.supplierId} className="hover:bg-slate-50/70 transition-colors">
                      {/* Company Name */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200/60 flex items-center justify-center text-orange-600 font-bold text-xs shrink-0">
                            {sup.companyName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">{sup.companyName}</p>
                            <p className="text-[11px] text-slate-500">Contact: {sup.name}</p>
                            {sup.notes && (
                              <p className="text-[10px] text-slate-400 truncate max-w-xs" title={sup.notes}>
                                {sup.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Phone & Contact */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <p className="font-mono text-slate-800 font-medium flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{sup.phone}</span>
                          </p>
                          {sup.email && (
                            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                              <Mail className="w-3 h-3 text-slate-300" />
                              <span className="truncate max-w-[140px]">{sup.email}</span>
                            </p>
                          )}
                        </div>
                      </td>

                      {/* GSTIN (Optional) */}
                      <td className="py-3.5 px-4">
                        {sup.gstin ? (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 border border-blue-200/60 text-blue-700 font-mono text-[11px]">
                            <ShieldCheck className="w-3 h-3 text-blue-500 shrink-0" />
                            <span>{sup.gstin}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 italic">
                            Unregistered / None
                          </span>
                        )}
                      </td>

                      {/* Address */}
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate text-[11.5px]">
                        {sup.address || '—'}
                      </td>

                      {/* Balance to Pay */}
                      <td className="py-3.5 px-4 text-right">
                        {hasDue ? (
                          <div className="inline-block text-right">
                            <div className="font-mono font-bold text-rose-700 text-sm bg-rose-50/80 px-2.5 py-0.5 rounded border border-rose-200/70 inline-block">
                              {formatINR(balance)}
                            </div>
                            <div className="text-[10px] text-rose-600 font-medium mt-0.5">
                              Pending Payment
                            </div>
                          </div>
                        ) : isSettled ? (
                          <div className="inline-block text-right">
                            <div className="font-mono font-semibold text-emerald-700 text-xs bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 inline-block">
                              ₹0.00
                            </div>
                            <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
                              Fully Settled
                            </div>
                          </div>
                        ) : (
                          <div className="inline-block text-right">
                            <div className="font-mono font-semibold text-sky-700 text-xs bg-sky-50 px-2 py-0.5 rounded border border-sky-200/60 inline-block">
                              {formatINR(Math.abs(balance))}
                            </div>
                            <div className="text-[10px] text-sky-600 font-medium mt-0.5">
                              Advance Paid
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Pay Button */}
                          <button
                            type="button"
                            onClick={() => openPayModal(sup)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-[11px] shadow-2xs transition-colors cursor-pointer"
                            title="Record a payment made to this supplier"
                          >
                            <CreditCard className="w-3 h-3" />
                            <span>Pay Due</span>
                          </button>

                          {/* Details & Ledger */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSupplierDetails(sup);
                              setDetailsTab('ledger');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition-colors cursor-pointer"
                            title="View complete transaction history and ledger"
                          >
                            Ledger
                          </button>

                          {/* Edit Supplier */}
                          <button
                            type="button"
                            onClick={() => openEditSupplierModal(sup)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit supplier information"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Supplier */}
                          {onDeleteSupplier && (
                            <button
                              type="button"
                              id={`btn-delete-supplier-${sup.supplierId}`}
                              onClick={() => setDeleteConfirmSupplier(sup)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title={`Delete supplier ${sup.companyName}`}
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

      {/* 5. Add / Edit Supplier Modal */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4 border border-slate-200 animate-scale-up my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    {editingSupplierId ? 'Edit Supplier / Distributor' : 'Add New Supplier / Distributor'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddEditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplierForm} className="space-y-4 text-xs">
              {/* Row 1: Company Name & Contact Person */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Company / Distributor Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formCompany}
                    onChange={(e) => setFormCompany(e.target.value)}
                    placeholder="e.g. Polycab Wires Agency"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Contact Person Name
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Row 2: Phone & GSTIN (Explicitly Optional) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="e.g. 98421 99881"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 font-semibold">
                      GSTIN Number <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      Not mandatory
                    </span>
                  </div>
                  <input
                    type="text"
                    value={formGstin}
                    onChange={(e) => setFormGstin(e.target.value)}
                    placeholder="e.g. 33AAAAA0000A1Z5 (Optional)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono uppercase focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Row 3: Email & Balance to Pay */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="e.g. distributor@gmail.com"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                {/* Balance to Pay */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    {editingSupplierId ? 'Current Balance to Pay (₹)' : 'Opening Balance to Pay (₹)'}{' '}
                    <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 font-medium">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      value={formBalance}
                      onChange={(e) => setFormBalance(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-xs font-mono font-semibold focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                </div>
              </div>

              {/* Office / Godown Address */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Office / Godown Address <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="e.g. 45, Wholesale Market, Goods Shed Road, Coimbatore"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>

              {/* Notes / Brands Supplied */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Brands Supplied / Dealership Notes <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Authorized stockist for Polycab wires, GM switches, and Legrand MCBs"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div className="flex items-center justify-between gap-2.5 pt-4 border-t border-slate-100">
                <div>
                  {editingSupplierId && onDeleteSupplier && (
                    <button
                      type="button"
                      onClick={() => {
                        const sup = suppliers.find((s) => s.supplierId === editingSupplierId);
                        setIsAddEditModalOpen(false);
                        setEditingSupplierId(null);
                        if (sup) setDeleteConfirmSupplier(sup);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Supplier</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddEditModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer"
                  >
                    {editingSupplierId ? 'Update Supplier' : 'Save Supplier'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Quick Record Payment Modal */}
      {payModalSupplier && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Record Payment to Supplier</h3>
                  <p className="text-[11px] text-slate-500">{payModalSupplier.companyName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPayModalSupplier(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Balance Counter */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium">Current Balance to Pay:</span>
                <p className="text-xl font-bold font-mono text-rose-700 mt-0.5">
                  {formatINR(payModalSupplier.balance || 0)}
                </p>
              </div>
              {(payModalSupplier.balance || 0) > 0 && (
                <button
                  type="button"
                  onClick={() => setPayAmount(String(payModalSupplier.balance))}
                  className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 text-[11px] font-semibold rounded-lg border border-rose-200 transition-colors"
                >
                  Pay Full Due
                </button>
              )}
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
              {/* Amount */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Payment Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-medium">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="Enter amount paid"
                    className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  />
                </div>
                {/* Live Remaining Balance Calculation */}
                {payAmount && !isNaN(parseFloat(payAmount)) && (
                  <p className="text-[11px] text-slate-600 mt-1 font-mono">
                    New Balance after payment:{' '}
                    <span className="font-bold text-slate-900">
                      {formatINR(Math.max(0, (payModalSupplier.balance || 0) - parseFloat(payAmount)))}
                    </span>
                  </p>
                )}
              </div>

              {/* Payment Mode */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Payment Method</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['UPI', 'CASH', 'BANK_TRANSFER', 'CHEQUE'] as SupplierPaymentMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPayMode(mode)}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-all text-center ${
                        payMode === mode
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {mode === 'BANK_TRANSFER' ? 'NEFT/IMPS' : mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reference Number */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Reference / UTR / Cheque No. <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={payRefNo}
                  onChange={(e) => setPayRefNo(e.target.value)}
                  placeholder="e.g. UTR-99882194 or Cheque #10294"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:border-emerald-600"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Remarks / Notes <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="e.g. Advance payment for September order"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPayModalSupplier(null)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer"
                >
                  Confirm & Deduct Balance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Comprehensive Supplier Details & Transaction Ledger Modal */}
      {selectedSupplierDetails && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-5 border border-slate-200 animate-scale-up my-8">
            {/* Top Modal Bar */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-base">
                  {selectedSupplierDetails.companyName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    {selectedSupplierDetails.companyName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Attn: {selectedSupplierDetails.name} • Ph: {selectedSupplierDetails.phone}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSupplierDetails(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Supplier Info & Payable Balance Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {/* Card 1: Balance to Pay */}
              <div className="sm:col-span-1 bg-gradient-to-br from-rose-50 to-white p-3.5 rounded-xl border border-rose-200/80">
                <span className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider">
                  Balance to Pay
                </span>
                <p className="text-2xl font-bold font-mono text-rose-700 mt-1">
                  {formatINR(selectedSupplierDetails.balance || 0)}
                </p>
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => openPayModal(selectedSupplierDetails)}
                    className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-[11px] shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Pay Supplier</span>
                  </button>
                </div>
              </div>

              {/* Card 2 & 3: Supplier Profile */}
              <div className="sm:col-span-2 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5 text-slate-600">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-400 text-[10.5px]">GSTIN Status:</span>
                    <p className="font-mono font-medium text-slate-800 text-[11.5px]">
                      {selectedSupplierDetails.gstin ? (
                        <span className="text-blue-700">{selectedSupplierDetails.gstin}</span>
                      ) : (
                        <span className="text-slate-500 italic">Unregistered / None (Optional)</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10.5px]">Email:</span>
                    <p className="text-slate-800 text-[11.5px] truncate">
                      {selectedSupplierDetails.email || '—'}
                    </p>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 text-[10.5px]">Address:</span>
                  <p className="text-slate-800 text-[11.5px]">
                    {selectedSupplierDetails.address || '—'}
                  </p>
                </div>

                {selectedSupplierDetails.notes && (
                  <div>
                    <span className="text-slate-400 text-[10.5px]">Supplied Brands:</span>
                    <p className="text-slate-700 text-[11px] italic">
                      {selectedSupplierDetails.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Sub-Navigation Tabs inside Details Modal */}
            <div className="border-b border-slate-200 flex items-center justify-between">
              <div className="flex gap-4 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setDetailsTab('ledger')}
                  className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
                    detailsTab === 'ledger'
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Transaction Ledger ({selectedSupplierTxList.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDetailsTab('add_bill')}
                  className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
                    detailsTab === 'add_bill'
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Purchase Bill</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDetailsTab('adjust');
                    setAdjustAmount(String(selectedSupplierDetails.balance || 0));
                  }}
                  className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
                    detailsTab === 'adjust'
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Adjust Balance</span>
                </button>
              </div>

              {/* Download A4 Statement */}
              {settings && (
                <button
                  type="button"
                  onClick={() =>
                    downloadSupplierLedgerPdf(
                      selectedSupplierDetails,
                      selectedSupplierTxList,
                      settings
                    )
                  }
                  className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-orange-600 mb-1 cursor-pointer"
                  title="Download standard A4 Supplier Statement (210 x 297 mm)"
                >
                  <Download className="w-3.5 h-3.5 text-orange-500" />
                  <span>Download A4 Statement</span>
                </button>
              )}
            </div>

            {/* TAB 1: Ledger Table */}
            {detailsTab === 'ledger' && (
              <div className="space-y-3">
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Reference / Mode</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3 text-right">Balance After</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedSupplierTxList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                            No ledger transactions logged for this vendor yet.
                          </td>
                        </tr>
                      ) : (
                        selectedSupplierTxList.map((tx) => {
                          const isPayment = tx.type === 'payment';
                          const isBill = tx.type === 'purchase_bill';
                          return (
                            <tr key={tx.id} className="hover:bg-slate-50/60">
                              <td className="py-2 px-3 text-[11px] text-slate-600 whitespace-nowrap">
                                {tx.date}
                              </td>
                              <td className="py-2 px-3">
                                {isPayment ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                    <ArrowDownLeft className="w-3 h-3" />
                                    Payment
                                  </span>
                                ) : isBill ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                                    <ArrowUpRight className="w-3 h-3" />
                                    Purchase Bill
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                                    {tx.type === 'opening_balance' ? 'Opening Bal' : 'Adjustment'}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-[11px] text-slate-600">
                                <span className="font-mono">{tx.referenceNo || '—'}</span>
                                {tx.paymentMode && (
                                  <span className="ml-1 text-[10px] text-slate-400">
                                    ({tx.paymentMode.replace('_', ' ')})
                                  </span>
                                )}
                              </td>
                              <td className={`py-2 px-3 text-right font-mono font-semibold ${
                                isPayment ? 'text-emerald-700' : 'text-rose-700'
                              }`}>
                                {isPayment ? `- ${formatINR(tx.amount)}` : `+ ${formatINR(tx.amount)}`}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-800 font-medium">
                                {formatINR(tx.balanceAfter)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: Add Purchase Bill */}
            {detailsTab === 'add_bill' && (
              <form onSubmit={handleAddPurchaseBill} className="space-y-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-900 text-xs">
                  Record New Purchase Bill (Increases Balance Owed)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Purchase Invoice / Bill Number
                    </label>
                    <input
                      type="text"
                      value={billRefNo}
                      onChange={(e) => setBillRefNo(e.target.value)}
                      placeholder="e.g. INV-998821"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-mono focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Bill Amount (₹) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      value={billAmount}
                      onChange={(e) => setBillAmount(e.target.value)}
                      placeholder="e.g. 24500"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-mono font-bold focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Items / Consignment Details
                  </label>
                  <input
                    type="text"
                    value={billNotes}
                    onChange={(e) => setBillNotes(e.target.value)}
                    placeholder="e.g. Finolex copper wires 50 coils received"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDetailsTab('ledger')}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs rounded-lg shadow-2xs"
                  >
                    Add to Balance
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: Adjust Balance Directly */}
            {detailsTab === 'adjust' && (
              <form onSubmit={handleAdjustBalance} className="space-y-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-900 text-xs">
                  Direct Balance Adjustment / Reconciliation
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      New Outstanding Balance (₹) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={adjustAmount}
                      onChange={(e) => setAdjustAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-mono font-bold focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Reason for Adjustment
                    </label>
                    <input
                      type="text"
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      placeholder="e.g. Cash discount / debit note applied"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDetailsTab('ledger')}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-lg shadow-2xs"
                  >
                    Save New Balance
                  </button>
                </div>
              </form>
            )}

            {/* Bottom Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    openEditSupplierModal(selectedSupplierDetails);
                    setSelectedSupplierDetails(null);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Vendor Info</span>
                </button>
                {onDeleteSupplier && (
                  <button
                    type="button"
                    onClick={() => {
                      const sup = selectedSupplierDetails;
                      setSelectedSupplierDetails(null);
                      setDeleteConfirmSupplier(sup);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Supplier</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedSupplierDetails(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Delete Confirmation Modal */}
      {deleteConfirmSupplier && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Delete Supplier?</h3>
                <p className="text-[11px] text-slate-500">Remove vendor from directory</p>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <p>
                Are you sure you want to remove <strong className="text-slate-900">{deleteConfirmSupplier.companyName}</strong>?
              </p>
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                <span>Contact: <strong className="text-slate-700">{deleteConfirmSupplier.name || '—'}</strong></span>
                <span>Ph: <strong className="text-slate-700">{deleteConfirmSupplier.phone || '—'}</strong></span>
              </div>
              {(deleteConfirmSupplier.balance || 0) > 0 && (
                <div className="flex items-start gap-2 p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] font-medium">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>
                    Warning: This supplier currently has an outstanding balance of <strong>{formatINR(deleteConfirmSupplier.balance || 0)}</strong>.
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmSupplier(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteSupplier) {
                    onDeleteSupplier(deleteConfirmSupplier.supplierId);
                  }
                  setDeleteConfirmSupplier(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-2xs cursor-pointer"
              >
                Delete Supplier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
