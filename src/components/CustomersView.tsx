import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  MapPin,
  X,
  CreditCard,
  Building,
  CheckCircle2,
  Download,
  Trash2,
  Edit2,
  AlertTriangle,
} from 'lucide-react';
import { Customer, Invoice, ShopSettings } from '../types';
import { formatINR } from '../utils/formatters';
import { downloadCustomerLedgerPdf } from '../utils/pdfGenerator';

interface CustomersViewProps {
  customers: Customer[];
  invoices?: Invoice[];
  settings?: ShopSettings;
  initialCreditFilter?: boolean;
  onSaveCustomer: (customer: Customer) => void;
  onDeleteCustomer?: (customerId: string) => void;
  onSelectCustomerToBill?: (customer: Customer) => void;
  onMarkCreditPaid?: (invoiceId: string) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  invoices = [],
  settings = { shopName: '' } as ShopSettings,
  initialCreditFilter = false,
  onSaveCustomer,
  onDeleteCustomer,
  onSelectCustomerToBill,
  onMarkCreditPaid,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showCreditOnly, setShowCreditOnly] = useState<boolean>(Boolean(initialCreditFilter));
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [deleteConfirmCustomer, setDeleteConfirmCustomer] = useState<Customer | null>(null);

  // Custom Credit Due Payment Modal State
  const [payingCustomer, setPayingCustomer] = useState<Customer | null>(null);
  const [customPayAmount, setCustomPayAmount] = useState<string>('');
  const [customPromiseDate, setCustomPromiseDate] = useState<string>('');
  const [payMethod, setPayMethod] = useState<'cash' | 'upi' | 'card' | 'bank'>('cash');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const getFutureDateStr = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const openRecordPaymentModal = (cust: Customer) => {
    setPayingCustomer(cust);
    setCustomPayAmount('');
    setCustomPromiseDate(cust.expectedPaymentDate || '');
    setPayMethod('cash');
  };

  useEffect(() => {
    if (initialCreditFilter !== undefined) {
      setShowCreditOnly(Boolean(initialCreditFilter));
    }
  }, [initialCreditFilter]);

  // Form State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formSiteAddress, setFormSiteAddress] = useState('');
  const [formGstin, setFormGstin] = useState('');
  const [formType, setFormType] = useState<'walk-in' | 'electrician' | 'contractor' | 'wholesale'>('electrician');
  const [formCredit, setFormCredit] = useState('0');
  const [formDueDate, setFormDueDate] = useState('');

  const openNewCustomerModal = () => {
    setEditingCustomerId(null);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormSiteAddress('');
    setFormGstin('');
    setFormType('electrician');
    setFormCredit('0');
    setFormDueDate('');
    setIsAddModalOpen(true);
  };

  const openEditCustomerModal = (cust: Customer) => {
    setEditingCustomerId(cust.customerId);
    setFormName(cust.name);
    setFormPhone(cust.phone === '—' ? '' : cust.phone || '');
    setFormEmail(cust.email || '');
    setFormAddress(cust.address || '');
    setFormSiteAddress(cust.siteAddress || '');
    setFormGstin(cust.gstin || '');
    setFormType(cust.customerType || 'walk-in');
    setFormCredit(String(cust.creditBalance || 0));
    setFormDueDate(cust.expectedPaymentDate || '');
    setIsAddModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    if (editingCustomerId) {
      const existing = customers.find((c) => c.customerId === editingCustomerId);
      const updatedCust: Customer = {
        customerId: editingCustomerId,
        name: formName.trim(),
        phone: formPhone.trim() || '—',
        email: formEmail.trim() || undefined,
        address: formAddress.trim() || undefined,
        siteAddress: formSiteAddress.trim() || formAddress.trim() || undefined,
        gstin: formGstin.trim() || undefined,
        customerType: formType,
        creditBalance: Number(formCredit) || 0,
        expectedPaymentDate: formDueDate || undefined,
        totalSpent: existing ? existing.totalSpent : 0,
      };
      onSaveCustomer(updatedCust);
      if (selectedCustomer?.customerId === editingCustomerId) {
        setSelectedCustomer(updatedCust);
      }
    } else {
      const newCust: Customer = {
        customerId: `cust-${Date.now()}`,
        name: formName.trim(),
        phone: formPhone.trim() || '—',
        email: formEmail.trim() || undefined,
        address: formAddress.trim() || undefined,
        siteAddress: formSiteAddress.trim() || formAddress.trim() || undefined,
        gstin: formGstin.trim() || undefined,
        customerType: formType,
        creditBalance: Number(formCredit) || 0,
        expectedPaymentDate: formDueDate || undefined,
        totalSpent: 0,
      };
      onSaveCustomer(newCust);
    }

    setIsAddModalOpen(false);
    setEditingCustomerId(null);
  };

  const handleConfirmCreditPayment = () => {
    if (!payingCustomer) return;
    const payNum = parseFloat(customPayAmount) || 0;
    if (payNum <= 0) {
      showToast('Please enter a valid payment amount greater than ₹0.');
      return;
    }
    const currentDue = payingCustomer.creditBalance || 0;
    if (payNum > currentDue) {
      showToast(`Payment amount cannot exceed current due (${formatINR(currentDue)}).`);
      return;
    }

    const newBalance = Math.max(0, currentDue - payNum);
    const updatedCust: Customer = {
      ...payingCustomer,
      creditBalance: newBalance,
      expectedPaymentDate: newBalance === 0 ? undefined : (customPromiseDate.trim() || payingCustomer.expectedPaymentDate),
    };

    onSaveCustomer(updatedCust);

    // If full balance paid, mark credit invoices as paid
    if (newBalance === 0 && onMarkCreditPaid && invoices.length > 0) {
      invoices
        .filter(
          (inv) =>
            (inv.customerId === payingCustomer.customerId ||
              (inv.customerPhone && payingCustomer.phone && inv.customerPhone.replace(/\D/g, '') === payingCustomer.phone.replace(/\D/g, '')) ||
              inv.customerName?.toLowerCase() === payingCustomer.name.toLowerCase()) &&
            inv.paymentMethod === 'credit' &&
            !inv.creditPaid
        )
        .forEach((inv) => {
          onMarkCreditPaid(inv.invoiceId);
        });
    }

    if (selectedCustomer?.customerId === payingCustomer.customerId) {
      setSelectedCustomer(updatedCust);
    }

    if (newBalance === 0) {
      showToast(`Full payment of ${formatINR(payNum)} recorded for ${payingCustomer.name}! Due settled.`);
    } else {
      showToast(`Payment of ${formatINR(payNum)} recorded for ${payingCustomer.name}! Remaining pending due: ${formatINR(newBalance)}.`);
    }

    setPayingCustomer(null);
  };

  const creditPendingCount = useMemo(() => {
    return customers.filter((c) => (c.creditBalance || 0) > 0).length;
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q));

      if (!matchesQuery) return false;

      if (typeFilter !== 'all' && c.customerType !== typeFilter) {
        return false;
      }

      if (showCreditOnly && !((c.creditBalance || 0) > 0)) {
        return false;
      }

      return true;
    });
  }, [customers, searchQuery, typeFilter, showCreditOnly]);

  const getTypeBadge = (type?: string) => {
    switch (type) {
      case 'contractor':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
            Contractor
          </span>
        );
      case 'electrician':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
            Electrician
          </span>
        );
      case 'wholesale':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/60">
            Wholesale
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
            Walk-in Retail
          </span>
        );
    }
  };

  return (
    <div className="w-full h-full p-6 sm:p-8 overflow-y-auto space-y-6 bg-slate-50/50">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Customers & Contractors
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Customer profiles and credit accounts.
          </p>
        </div>

        <button
          type="button"
          id="btn-add-customer"
          onClick={openNewCustomerModal}
          className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Customer</span>
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name, phone number, or area..."
            className="w-full pl-11 pr-4 py-2.5 bg-white rounded-xl border border-slate-200/90 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all shadow-2xs"
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

        <div className="w-full sm:w-48">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200/90 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-orange-500 font-medium shadow-2xs"
          >
            <option value="all">All Types</option>
            <option value="walk-in">Retail Walk-in</option>
            <option value="electrician">Electricians</option>
            <option value="contractor">Contractors</option>
            <option value="wholesale">Wholesale / Builder</option>
          </select>
        </div>

        {/* Credit Pending Quick Filter Toggle */}
        <button
          type="button"
          id="btn-filter-credit-pending-toggle"
          onClick={() => setShowCreditOnly(!showCreditOnly)}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-2xs whitespace-nowrap cursor-pointer ${
            showCreditOnly
              ? 'bg-amber-500 text-slate-950 font-bold border border-amber-600 ring-2 ring-amber-400/30'
              : 'bg-white text-slate-700 border border-slate-200/90 hover:bg-slate-50'
          }`}
          title="Toggle customers with credit pending balance"
        >
          <CreditCard className={`w-4 h-4 ${showCreditOnly ? 'text-slate-950' : 'text-amber-600'}`} />
          <span>Credit Pending ({creditPendingCount})</span>
        </button>
      </div>

      {/* Active Filter Banner if Credit Pending Filter is On */}
      {showCreditOnly && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50/90 border border-amber-200 rounded-xl text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span>
              Showing <strong>{filteredCustomers.length}</strong> customer{filteredCustomers.length === 1 ? '' : 's'} with pending credit balance.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowCreditOnly(false)}
            className="text-[11px] font-semibold text-amber-900 hover:text-amber-950 underline cursor-pointer ml-3 shrink-0"
          >
            Show All Customers
          </button>
        </div>
      )}

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-[10.5px] uppercase font-bold text-slate-400 border-b border-slate-100 tracking-wider">
              <tr>
                <th className="py-3 px-5">Customer Name</th>
                <th className="py-3 px-4">Contact Phone</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Address / Area</th>
                <th className="py-3 px-4 text-right">Credit Balance</th>
                <th className="py-3 px-4 text-right">Total Spent</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mx-auto mb-3">
                      <Users className="w-6 h-6 stroke-[1.5]" />
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      No customers found matching your criteria.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => (
                  <tr key={cust.customerId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-5">
                      <p className="font-semibold text-slate-900">{cust.name}</p>
                      {cust.gstin && (
                        <p className="text-[10.5px] text-slate-400 font-mono">GSTIN: {cust.gstin}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700">
                      {cust.phone || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      {getTypeBadge(cust.customerType)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-xs">
                      <p className="truncate">{cust.siteAddress || cust.address || '—'}</p>
                      {cust.siteAddress && cust.address && cust.siteAddress !== cust.address && (
                        <p className="text-[10px] text-slate-400 truncate">Billing: {cust.address}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className={`font-mono font-medium ${
                        cust.creditBalance > 0 ? 'text-amber-700' : 'text-slate-600'
                      }`}>
                        {formatINR(cust.creditBalance || 0)}
                      </span>
                      {cust.creditBalance > 0 && cust.expectedPaymentDate && (
                        <div className="mt-0.5">
                          <span className={`inline-block text-[10px] px-1.5 py-0.2 rounded font-mono ${
                            new Date(cust.expectedPaymentDate).getTime() < new Date().setHours(0, 0, 0, 0)
                              ? 'bg-rose-100 text-rose-700 font-bold'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            Due: {cust.expectedPaymentDate}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      {formatINR(cust.totalSpent || 0)}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {cust.creditBalance > 0 && (
                          <button
                            type="button"
                            onClick={() => openRecordPaymentModal(cust)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 font-bold text-xs rounded transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                            title={`Record custom credit payment for ${cust.name}`}
                          >
                            <CreditCard className="w-3 h-3 text-emerald-600" />
                            <span>Pay Due</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedCustomer(cust)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded transition-colors cursor-pointer"
                          title="View customer ledger statement & details"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditCustomerModal(cust)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Edit customer details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {onDeleteCustomer && (
                          <button
                            type="button"
                            id={`btn-delete-customer-${cust.customerId}`}
                            onClick={() => setDeleteConfirmCustomer(cust)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title={`Delete customer ${cust.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-orange-500" />
                <h3 className="font-bold text-sm text-slate-900">
                  {editingCustomerId ? 'Edit Customer / Contractor' : 'Add Customer / Contractor'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingCustomerId(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Full Name / Shop Name *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Senthil Electrician"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Mobile Phone Number</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="e.g. 98421 12345"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Customer Category</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-orange-500"
                  >
                    <option value="walk-in">Retail Walk-in</option>
                    <option value="electrician">Electrician</option>
                    <option value="contractor">Electrical Contractor</option>
                    <option value="wholesale">Wholesale / Builder</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Opening Credit Due (₹)</label>
                  <input
                    type="number"
                    value={formCredit}
                    onChange={(e) => setFormCredit(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {Number(formCredit) > 0 && (
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Promised Payment Due Date</label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:border-orange-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Billing / Shop Address</label>
                  <input
                    type="text"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="e.g. 42, Cross Cut Road"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Site Address (Optional)</label>
                  <input
                    type="text"
                    value={formSiteAddress}
                    onChange={(e) => setFormSiteAddress(e.target.value)}
                    placeholder="e.g. Site #12, RS Puram project"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">GSTIN Number (Optional)</label>
                <input
                  type="text"
                  value={formGstin}
                  onChange={(e) => setFormGstin(e.target.value)}
                  placeholder="e.g. 33AAAAA0000A1Z5"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono uppercase focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                <div>
                  {editingCustomerId && onDeleteCustomer && (
                    <button
                      type="button"
                      onClick={() => {
                        const cust = customers.find((c) => c.customerId === editingCustomerId);
                        setIsAddModalOpen(false);
                        setEditingCustomerId(null);
                        if (cust) setDeleteConfirmCustomer(cust);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Customer</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddModalOpen(false);
                      setEditingCustomerId(null);
                    }}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs shadow-xs cursor-pointer"
                  >
                    {editingCustomerId ? 'Update Customer' : 'Save Customer'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                {selectedCustomer.name}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <p>
                <strong className="text-slate-900">Type:</strong>{' '}
                <span className="capitalize">{selectedCustomer.customerType || 'Walk-in'}</span>
              </p>
              <p>
                <strong className="text-slate-900">Phone:</strong> {selectedCustomer.phone || '—'}
              </p>
              <p>
                <strong className="text-slate-900">Address:</strong> {selectedCustomer.address || '—'}
              </p>
              {selectedCustomer.siteAddress && selectedCustomer.siteAddress !== selectedCustomer.address && (
                <p>
                  <strong className="text-slate-900">Site Address:</strong> {selectedCustomer.siteAddress}
                </p>
              )}
              {selectedCustomer.gstin && (
                <p>
                  <strong className="text-slate-900">GSTIN:</strong> {selectedCustomer.gstin}
                </p>
              )}
              {selectedCustomer.expectedPaymentDate && (
                <p>
                  <strong className="text-slate-900">Promised Due Date:</strong>{' '}
                  <span className={`font-mono font-medium ${
                    selectedCustomer.creditBalance > 0 &&
                    new Date(selectedCustomer.expectedPaymentDate).getTime() < new Date().setHours(0, 0, 0, 0)
                      ? 'text-rose-600 font-bold'
                      : 'text-slate-800'
                  }`}>
                    {selectedCustomer.expectedPaymentDate}
                    {selectedCustomer.creditBalance > 0 &&
                      new Date(selectedCustomer.expectedPaymentDate).getTime() < new Date().setHours(0, 0, 0, 0) &&
                      ' (Overdue)'}
                  </span>
                </p>
              )}
              <div className="pt-2 border-t border-slate-100 flex justify-between">
                <span>Credit Due:</span>
                <span className="font-bold text-amber-700">{formatINR(selectedCustomer.creditBalance || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Spent:</span>
                <span className="font-bold text-slate-900">{formatINR(selectedCustomer.totalSpent || 0)}</span>
              </div>
            </div>

            {/* Quick Record Payment / Settle Due */}
            {selectedCustomer.creditBalance > 0 && (
              <div className="pt-3 border-t border-slate-100 bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/90 space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-amber-700" />
                    <span>Record Credit Payment / Settle Due</span>
                  </p>
                  <span className="text-[11px] font-mono font-bold text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded border border-amber-200">
                    Due: {formatINR(selectedCustomer.creditBalance)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Accept full payment or enter any custom amount (e.g. ₹100 of ₹200) with remaining balance tracked.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => openRecordPaymentModal(selectedCustomer)}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Record Payment (Enter Custom Amount)</span>
                  </button>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const c = selectedCustomer;
                    setSelectedCustomer(null);
                    openEditCustomerModal(c);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                {onDeleteCustomer && (
                  <button
                    type="button"
                    onClick={() => {
                      const c = selectedCustomer;
                      setSelectedCustomer(null);
                      setDeleteConfirmCustomer(c);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="btn-download-customer-statement"
                  onClick={() => {
                    const custInvoices = invoices.filter(
                      (inv) =>
                        inv.customerId === selectedCustomer.customerId ||
                        inv.customerPhone === selectedCustomer.phone
                    );
                    downloadCustomerLedgerPdf(selectedCustomer, custInvoices, settings);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                  title="Download standard A4 Statement of Account (210 x 297 mm)"
                >
                  <Download className="w-3.5 h-3.5 text-orange-400" />
                  <span>Download Statement</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Customer Confirmation Modal */}
      {deleteConfirmCustomer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-scale-up">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Delete Customer?</h3>
                <p className="text-xs text-slate-500">Remove customer record from database</p>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <p>
                Are you sure you want to delete <strong className="text-slate-900">{deleteConfirmCustomer.name}</strong>?
              </p>
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                <span>Phone: <strong className="text-slate-700">{deleteConfirmCustomer.phone || '—'}</strong></span>
                <span>Type: <strong className="text-slate-700 capitalize">{deleteConfirmCustomer.customerType}</strong></span>
              </div>
              {(deleteConfirmCustomer.creditBalance || 0) > 0 && (
                <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] font-medium">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Warning: This customer currently has an outstanding credit balance of <strong>{formatINR(deleteConfirmCustomer.creditBalance)}</strong>.
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmCustomer(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteCustomer) {
                    onDeleteCustomer(deleteConfirmCustomer.customerId);
                  }
                  setDeleteConfirmCustomer(null);
                }}
                className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer"
              >
                Delete Customer
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Record Credit Due Payment Modal (Custom Amount & Partial Payment) */}
      {payingCustomer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Record Credit Payment</h3>
                  <p className="text-xs text-slate-500">
                    {payingCustomer.name} {payingCustomer.phone && `• ${payingCustomer.phone}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPayingCustomer(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Due Overview Card */}
            <div className="bg-amber-50/80 border border-amber-200/80 p-3.5 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-amber-900 uppercase tracking-wider">
                  Outstanding Credit Due
                </p>
                <p className="text-xl font-black font-mono text-amber-900 mt-0.5">
                  {formatINR(payingCustomer.creditBalance || 0)}
                </p>
              </div>
              {payingCustomer.expectedPaymentDate && (
                <div className="text-right">
                  <span className="text-[10px] text-amber-700 block">Promised Due Date</span>
                  <span className="text-xs font-mono font-bold text-amber-900">
                    {payingCustomer.expectedPaymentDate}
                  </span>
                </div>
              )}
            </div>

            {/* Custom Payment Amount Input Field */}
            <div className="space-y-2">
              <label className="block text-slate-700 font-bold text-xs">
                Payment Amount Received (₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                  ₹
                </span>
                <input
                  type="number"
                  min="1"
                  max={payingCustomer.creditBalance || 0}
                  step="any"
                  autoFocus
                  value={customPayAmount}
                  onChange={(e) => setCustomPayAmount(e.target.value)}
                  placeholder="Enter amount e.g. 100"
                  className="w-full pl-8 pr-3 py-2.5 border-2 border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Quick Amount Suggestion Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-slate-500 font-medium">Quick options:</span>
                <button
                  type="button"
                  onClick={() => setCustomPayAmount(String(payingCustomer.creditBalance || 0))}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Full Due ({formatINR(payingCustomer.creditBalance || 0)})
                </button>
                {(payingCustomer.creditBalance || 0) > 10 && (
                  <button
                    type="button"
                    onClick={() => setCustomPayAmount(String(Math.round((payingCustomer.creditBalance || 0) / 2)))}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    50% Half ({formatINR(Math.round((payingCustomer.creditBalance || 0) / 2))})
                  </button>
                )}
                {(payingCustomer.creditBalance || 0) > 100 && (
                  <button
                    type="button"
                    onClick={() => setCustomPayAmount('100')}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    ₹100
                  </button>
                )}
                {(payingCustomer.creditBalance || 0) > 200 && (
                  <button
                    type="button"
                    onClick={() => setCustomPayAmount('200')}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    ₹200
                  </button>
                )}
                {(payingCustomer.creditBalance || 0) > 500 && (
                  <button
                    type="button"
                    onClick={() => setCustomPayAmount('500')}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    ₹500
                  </button>
                )}
              </div>
            </div>

            {/* Live Calculation Preview Breakdown */}
            {(() => {
              const currentDue = payingCustomer.creditBalance || 0;
              const payNum = parseFloat(customPayAmount) || 0;
              const remainingDue = Math.max(0, currentDue - payNum);
              const isOver = payNum > currentDue;

              return (
                <div className="space-y-3">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                    <div className="flex justify-between text-slate-600">
                      <span>Total Current Due:</span>
                      <span className="font-mono font-semibold text-slate-900">{formatINR(currentDue)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>Amount Received Now:</span>
                      <span className="font-mono font-bold">- {formatINR(payNum)}</span>
                    </div>
                    <div className="pt-1.5 border-t border-slate-200 flex justify-between items-center">
                      <span className="font-bold text-slate-900">Remaining Pending Due:</span>
                      <span className={`font-mono text-sm font-black ${
                        isOver ? 'text-rose-600' : remainingDue === 0 ? 'text-emerald-600' : 'text-amber-800'
                      }`}>
                        {formatINR(remainingDue)}
                      </span>
                    </div>
                  </div>

                  {isOver && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
                      Payment amount cannot exceed the total credit due ({formatINR(currentDue)}).
                    </div>
                  )}

                  {/* If remaining due > 0, allow setting new promised due date */}
                  {!isOver && remainingDue > 0 && payNum > 0 && (
                    <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-2">
                      <label className="block text-slate-800 font-bold text-xs">
                        When will the pending {formatINR(remainingDue)} be paid? <span className="text-slate-500 font-normal">(Promised Date)</span>
                      </label>
                      <input
                        type="date"
                        value={customPromiseDate}
                        onChange={(e) => setCustomPromiseDate(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:border-orange-500"
                      />
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className="text-[10px] text-slate-500">Quick set:</span>
                        <button
                          type="button"
                          onClick={() => setCustomPromiseDate(getFutureDateStr(7))}
                          className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-medium transition-colors cursor-pointer"
                        >
                          +7 Days
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomPromiseDate(getFutureDateStr(15))}
                          className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-medium transition-colors cursor-pointer"
                        >
                          +15 Days
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomPromiseDate(getFutureDateStr(30))}
                          className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-medium transition-colors cursor-pointer"
                        >
                          +1 Month
                        </button>
                      </div>
                    </div>
                  )}

                  {!isOver && remainingDue === 0 && payNum > 0 && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Full balance will be settled! Customer account will have ₹0 due.</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Payment Method Selector */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-slate-700 font-semibold text-xs">
                Payment Method Received Through
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['cash', 'upi', 'card', 'bank'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPayMethod(m)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold capitalize border transition-colors cursor-pointer text-center ${
                      payMethod === m
                        ? 'bg-orange-500 text-white border-orange-500 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {m === 'bank' ? 'Bank Transfer' : m}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPayingCustomer(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  !customPayAmount ||
                  (parseFloat(customPayAmount) || 0) <= 0 ||
                  (parseFloat(customPayAmount) || 0) > (payingCustomer.creditBalance || 0)
                }
                onClick={handleConfirmCreditPayment}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  Confirm Payment of {formatINR(parseFloat(customPayAmount) || 0)}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {toastMsg && (
        <div className="fixed top-16 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5 animate-fade-in font-medium text-xs sm:text-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
};
