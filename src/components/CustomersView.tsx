import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { Customer, Invoice, ShopSettings } from '../types';
import { formatINR } from '../utils/formatters';
import { downloadCustomerLedgerPdf } from '../utils/pdfGenerator';

interface CustomersViewProps {
  customers: Customer[];
  invoices?: Invoice[];
  settings?: ShopSettings;
  onSaveCustomer: (customer: Customer) => void;
  onSelectCustomerToBill?: (customer: Customer) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  invoices = [],
  settings = { shopName: '' } as ShopSettings,
  onSaveCustomer,
  onSelectCustomerToBill,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

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
    setIsAddModalOpen(false);
  };

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

      return true;
    });
  }, [customers, searchQuery, typeFilter]);

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
      </div>

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
                      <button
                        type="button"
                        onClick={() => setSelectedCustomer(cust)}
                        className="text-orange-500 hover:text-orange-600 font-medium text-xs"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-orange-500" />
                <h3 className="font-bold text-sm text-slate-900">Add Customer / Contractor</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
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

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs shadow-xs"
                >
                  Save Customer
                </button>
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
              <div className="pt-3 border-t border-slate-100 bg-amber-50/60 p-3 rounded-lg border border-amber-200/80 space-y-2">
                <p className="font-bold text-slate-900 text-xs">Record Credit Payment / Settle Due</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const updated = {
                        ...selectedCustomer,
                        creditBalance: 0,
                      };
                      onSaveCustomer(updated);
                      setSelectedCustomer(updated);
                    }}
                    className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-2xs"
                  >
                    Clear Full Balance ({formatINR(selectedCustomer.creditBalance)})
                  </button>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
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
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                title="Download standard A4 Statement of Account (210 x 297 mm)"
              >
                <Download className="w-3.5 h-3.5 text-orange-400" />
                <span>Download A4 Statement</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
