import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  Printer,
  TrendingUp,
  Wallet,
  Download,
  X,
  FileText,
  Tag,
  DollarSign,
  Percent,
} from 'lucide-react';
import { Invoice, ShopSettings, Product, InvoiceItem } from '../types';
import {
  formatINR,
  getInvoiceDiscount,
  getPaymentMethodBadge,
  formatShopAddress,
  formatShopContactLine,
  getShopLogoUrl,
} from '../utils/formatters';
import { downloadAnalyticsReportPdf } from '../utils/pdfGenerator';

interface ReportsViewProps {
  invoices: Invoice[];
  settings: ShopSettings;
  products?: Product[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({ invoices, settings, products = [] }) => {
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().substring(0, 7)
  );
  const [selectedYear, setSelectedYear] = useState<string>(
    String(new Date().getFullYear())
  );
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // Fast Product Cost / Purchase Price Lookup Map
  const productCostMap = useMemo(() => {
    const map = new Map<string, number>();
    (products || []).forEach((p) => {
      const cost = Number(p.purchasePrice) || 0;
      map.set(p.productId, cost);
      if (p.name) {
        map.set(p.name.toLowerCase().trim(), cost);
      }
    });
    return map;
  }, [products]);

  // Helper to determine cost/purchase price per unit for an item
  const getItemCostPrice = (item: InvoiceItem): number => {
    if (typeof item.purchasePrice === 'number' && item.purchasePrice >= 0) {
      return item.purchasePrice;
    }
    if (typeof item.costPrice === 'number' && item.costPrice >= 0) {
      return item.costPrice;
    }
    if (item.productId && productCostMap.has(item.productId)) {
      return productCostMap.get(item.productId) || 0;
    }
    if (item.productNameSnapshot) {
      const key = item.productNameSnapshot.toLowerCase().trim();
      if (productCostMap.has(key)) {
        return productCostMap.get(key) || 0;
      }
    }
    return 0;
  };

  // Filter invoices based on period
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const invDate = inv.dateTime.split(' ')[0]; // YYYY-MM-DD
      if (reportPeriod === 'daily') {
        return invDate === selectedDate;
      }
      if (reportPeriod === 'monthly') {
        return invDate.startsWith(selectedMonth);
      }
      if (reportPeriod === 'yearly') {
        return invDate.startsWith(selectedYear);
      }
      return true;
    });
  }, [invoices, reportPeriod, selectedDate, selectedMonth, selectedYear]);

  // Aggregate Metrics
  const totalRevenue = useMemo(
    () => filteredInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0),
    [filteredInvoices]
  );
  const totalBills = filteredInvoices.length;

  // Discount & Gross Metrics
  const totalDiscount = useMemo(
    () => filteredInvoices.reduce((sum, inv) => sum + getInvoiceDiscount(inv), 0),
    [filteredInvoices]
  );
  const totalGross = useMemo(
    () =>
      filteredInvoices.reduce(
        (sum, inv) => sum + (inv.subtotal || (inv.grandTotal - (inv.gstAmount || 0))),
        0
      ),
    [filteredInvoices]
  );
  const discountedBillsCount = useMemo(
    () => filteredInvoices.filter((inv) => getInvoiceDiscount(inv) > 0).length,
    [filteredInvoices]
  );
  const discountPercentOfGross = useMemo(
    () => (totalGross > 0 ? ((totalDiscount / totalGross) * 100).toFixed(1) : '0.0'),
    [totalDiscount, totalGross]
  );

  const totalGst = useMemo(
    () => filteredInvoices.reduce((sum, inv) => sum + inv.gstAmount, 0),
    [filteredInvoices]
  );
  const totalUnitsSold = useMemo(
    () =>
      filteredInvoices.reduce(
        (sum, inv) =>
          sum + inv.items.reduce((iSum, it) => iSum + it.quantity, 0),
        0
      ),
    [filteredInvoices]
  );
  const avgBillValue = totalBills > 0 ? totalRevenue / totalBills : 0;

  // Cost of Goods Sold (COGS) & Profit Calculations based on Cost Price vs Selling Price
  const totalCostOfGoods = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => {
      const invCogs = inv.items.reduce((iSum, it) => {
        const unitCost = getItemCostPrice(it);
        return iSum + unitCost * it.quantity;
      }, 0);
      return sum + invCogs;
    }, 0);
  }, [filteredInvoices, productCostMap]);

  // Net pre-tax taxable sales (Gross Subtotal minus discounts given)
  const netTaxableSales = useMemo(() => {
    return Math.max(0, totalGross - totalDiscount);
  }, [totalGross, totalDiscount]);

  // Total Gross Profit = Net pre-tax sales - Total Cost of Goods Sold
  const totalProfit = useMemo(() => {
    return netTaxableSales - totalCostOfGoods;
  }, [netTaxableSales, totalCostOfGoods]);

  const profitMarginPercent = useMemo(() => {
    if (netTaxableSales <= 0) return 0;
    return Number(((totalProfit / netTaxableSales) * 100).toFixed(1));
  }, [totalProfit, netTaxableSales]);

  // Chronological time-ordered breakdown data with Profit
  const timeOrderBreakdown = useMemo(() => {
    if (reportPeriod === 'daily') {
      return [...filteredInvoices]
        .sort((a, b) => a.dateTime.localeCompare(b.dateTime))
        .map((inv) => {
          const timeStr = inv.dateTime.split(' ')[1] || '';
          const gross = inv.subtotal || (inv.grandTotal - (inv.gstAmount || 0));
          const discount = getInvoiceDiscount(inv);
          const taxable = Math.max(0, gross - discount);
          const cogs = inv.items.reduce(
            (s, it) => s + getItemCostPrice(it) * it.quantity,
            0
          );
          const profit = taxable - cogs;
          const margin = taxable > 0 ? Number(((profit / taxable) * 100).toFixed(1)) : 0;

          return {
            id: inv.invoiceId || inv.id || inv.invoiceNumber,
            timeStr,
            invoiceNumber: inv.invoiceNumber,
            customerName: inv.customerName || 'Walk-in Customer',
            customerPhone: inv.customerPhone,
            paymentMethod: inv.paymentMethod,
            itemsCount: inv.items.reduce((s, it) => s + it.quantity, 0),
            gross,
            discount,
            cogs,
            profit,
            margin,
            gst: inv.gstAmount || 0,
            net: inv.grandTotal,
          };
        });
    }

    if (reportPeriod === 'monthly') {
      const map: Record<
        string,
        {
          date: string;
          bills: number;
          gross: number;
          discount: number;
          cogs: number;
          profit: number;
          gst: number;
          net: number;
        }
      > = {};

      filteredInvoices.forEach((inv) => {
        const day = inv.dateTime.split(' ')[0];
        if (!map[day]) {
          map[day] = {
            date: day,
            bills: 0,
            gross: 0,
            discount: 0,
            cogs: 0,
            profit: 0,
            gst: 0,
            net: 0,
          };
        }
        const gross = inv.subtotal || (inv.grandTotal - (inv.gstAmount || 0));
        const discount = getInvoiceDiscount(inv);
        const taxable = Math.max(0, gross - discount);
        const cogs = inv.items.reduce(
          (s, it) => s + getItemCostPrice(it) * it.quantity,
          0
        );
        const profit = taxable - cogs;

        map[day].bills += 1;
        map[day].gross += gross;
        map[day].discount += discount;
        map[day].cogs += cogs;
        map[day].profit += profit;
        map[day].gst += inv.gstAmount || 0;
        map[day].net += inv.grandTotal;
      });

      return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
    }

    if (reportPeriod === 'yearly') {
      const map: Record<
        string,
        {
          month: string;
          bills: number;
          gross: number;
          discount: number;
          cogs: number;
          profit: number;
          gst: number;
          net: number;
        }
      > = {};

      filteredInvoices.forEach((inv) => {
        const m = inv.dateTime.substring(0, 7);
        if (!map[m]) {
          map[m] = {
            month: m,
            bills: 0,
            gross: 0,
            discount: 0,
            cogs: 0,
            profit: 0,
            gst: 0,
            net: 0,
          };
        }
        const gross = inv.subtotal || (inv.grandTotal - (inv.gstAmount || 0));
        const discount = getInvoiceDiscount(inv);
        const taxable = Math.max(0, gross - discount);
        const cogs = inv.items.reduce(
          (s, it) => s + getItemCostPrice(it) * it.quantity,
          0
        );
        const profit = taxable - cogs;

        map[m].bills += 1;
        map[m].gross += gross;
        map[m].discount += discount;
        map[m].cogs += cogs;
        map[m].profit += profit;
        map[m].gst += inv.gstAmount || 0;
        map[m].net += inv.grandTotal;
      });

      return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
    }

    return [];
  }, [filteredInvoices, reportPeriod, productCostMap]);

  const formatDayDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-');
      const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
      return dateObj.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        weekday: 'short',
      });
    } catch {
      return dateStr;
    }
  };

  const formatMonthName = (monthStr: string) => {
    try {
      const [y, m] = monthStr.split('-');
      const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
      return dateObj.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    } catch {
      return monthStr;
    }
  };

  // Payment Breakdown
  const paymentBreakdown = useMemo(() => {
    const map: Record<string, number> = { cash: 0, upi: 0, card: 0, credit: 0 };
    filteredInvoices.forEach((inv) => {
      map[inv.paymentMethod] = (map[inv.paymentMethod] || 0) + inv.grandTotal;
    });
    return map;
  }, [filteredInvoices]);

  // Top Selling Items with Profit
  const topItems = useMemo(() => {
    const itemMap: Record<
      string,
      {
        name: string;
        qty: number;
        total: number;
        cost: number;
        profit: number;
        margin: number;
        unit: string;
      }
    > = {};

    filteredInvoices.forEach((inv) => {
      inv.items.forEach((it) => {
        const unitCost = getItemCostPrice(it);
        const itemCogs = unitCost * it.quantity;
        const itemRev = it.lineTotal;
        const itemProfit = itemRev - itemCogs;

        if (!itemMap[it.productNameSnapshot]) {
          itemMap[it.productNameSnapshot] = {
            name: it.productNameSnapshot,
            qty: 0,
            total: 0,
            cost: 0,
            profit: 0,
            margin: 0,
            unit: it.unit,
          };
        }
        itemMap[it.productNameSnapshot].qty += it.quantity;
        itemMap[it.productNameSnapshot].total += itemRev;
        itemMap[it.productNameSnapshot].cost += itemCogs;
        itemMap[it.productNameSnapshot].profit += itemProfit;
      });
    });

    return Object.values(itemMap)
      .map((item) => ({
        ...item,
        margin:
          item.total > 0
            ? Number(((item.profit / item.total) * 100).toFixed(1))
            : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [filteredInvoices, productCostMap]);

  const selectedPeriodLabel = useMemo(() => {
    if (reportPeriod === 'daily') return `Date: ${selectedDate}`;
    if (reportPeriod === 'monthly') return `Month: ${selectedMonth}`;
    return `Year: ${selectedYear}`;
  }, [reportPeriod, selectedDate, selectedMonth, selectedYear]);

  const handleDownloadPdf = () => {
    downloadAnalyticsReportPdf(
      {
        period: reportPeriod,
        selectedPeriodLabel,
        totalRevenue,
        totalProfit,
        totalCost: totalCostOfGoods,
        profitMargin: profitMarginPercent,
        totalBills,
        totalDiscount,
        totalGst,
        totalUnitsSold,
        avgBillValue,
        paymentBreakdown,
        topItems,
        invoices: filteredInvoices,
      },
      settings
    );
  };

  return (
    <div className="w-full h-full p-6 sm:p-8 overflow-y-auto space-y-6 bg-slate-50/50">
      <div className={`space-y-6 ${showPrintModal ? 'no-print' : ''}`}>
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Reports & Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Turnover, GST collections, and sales breakdown.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            id="btn-download-reports-pdf"
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors"
            title="Download executive analytics report as standard A4 PDF document"
          >
            <Download className="w-3.5 h-3.5 text-orange-500" />
            <span>Download A4 PDF</span>
          </button>

          <button
            type="button"
            id="btn-print-reports-summary"
            onClick={() => setShowPrintModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-orange-500 hover:bg-orange-600 text-black text-xs font-bold rounded-lg shadow-xs transition-colors"
            title="Print Executive Sales & GST Analytics Report"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Period Selection */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex bg-zinc-100 p-1 rounded-lg text-xs font-semibold w-full sm:w-auto">
          {[
            { id: 'daily', label: 'Daily' },
            { id: 'monthly', label: 'Monthly' },
            { id: 'yearly', label: 'Yearly' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setReportPeriod(tab.id as any)}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-md transition-colors ${
                reportPeriod === tab.id
                  ? 'bg-white text-black shadow-xs'
                  : 'text-zinc-600 hover:text-black'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Date / Month / Year Picker */}
        <div className="flex items-center gap-2 text-xs w-full sm:w-auto">
          <Calendar className="w-4 h-4 text-zinc-400" />
          {reportPeriod === 'daily' && (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg font-medium text-zinc-900 text-xs focus:outline-none focus:border-orange-500"
            />
          )}
          {reportPeriod === 'monthly' && (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg font-medium text-zinc-900 text-xs focus:outline-none focus:border-orange-500"
            />
          )}
          {reportPeriod === 'yearly' && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg font-medium text-zinc-900 text-xs focus:outline-none focus:border-orange-500"
            >
              <option value="2026">Year 2026</option>
              <option value="2025">Year 2025</option>
              <option value="2024">Year 2024</option>
            </select>
          )}
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Card 1: Total Revenue */}
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
                Total Revenue
              </span>
              <span className="p-1 rounded bg-amber-50 text-amber-600">
                <BarChart3 className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-2xl font-bold text-zinc-950 font-mono mt-1">
              {formatINR(totalRevenue)}
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
            <span>Pre-Tax Sales:</span>
            <span className="font-mono font-medium text-zinc-700">{formatINR(netTaxableSales)}</span>
          </div>
        </div>

        {/* Card 2: Gross Profit (Directly near Revenue card) */}
        <div className="bg-white p-5 rounded-xl border-2 border-emerald-500/40 bg-gradient-to-b from-emerald-50/50 via-white to-white shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                Gross Profit
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                  totalProfit >= 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
                title="Profit Margin % on pre-tax sales"
              >
                {profitMarginPercent >= 0 ? `+${profitMarginPercent}%` : `${profitMarginPercent}%`} Margin
              </span>
            </div>
            <div className="text-2xl font-bold text-emerald-700 font-mono mt-1">
              {formatINR(totalProfit)}
            </div>
          </div>
          <div
            className="mt-2.5 pt-2 border-t border-emerald-100/80 flex items-center justify-between text-[11px] text-zinc-500"
            title="Calculated from (Selling Price - Cost Price) across sold items minus bill discounts"
          >
            <span className="truncate">Cost Price (COGS):</span>
            <span className="font-mono font-medium text-zinc-700 ml-1 shrink-0">{formatINR(totalCostOfGoods)}</span>
          </div>
        </div>

        {/* Card 3: Bills Issued */}
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
              Bills Issued
            </span>
            <div className="text-2xl font-bold text-zinc-950 font-mono mt-1">
              {totalBills}
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
            <span>Avg Ticket:</span>
            <span className="font-mono font-medium text-zinc-700">{formatINR(avgBillValue)}</span>
          </div>
        </div>

        {/* Card 4: Total Discount */}
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
                Total Discount
              </span>
              <Tag className="w-3.5 h-3.5 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-orange-600 font-mono mt-1">
              {formatINR(totalDiscount)}
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
            <span>Concessions:</span>
            <span className="font-mono font-medium text-orange-700">{discountedBillsCount} bills</span>
          </div>
        </div>

        {/* Card 5: GST Collected */}
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
              GST Collected
            </span>
            <div className="text-2xl font-bold text-zinc-900 font-mono mt-1">
              {formatINR(totalGst)}
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
            <span>Tax Type:</span>
            <span className="font-medium text-zinc-700">CGST + SGST</span>
          </div>
        </div>

        {/* Card 6: Quantity Sold */}
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
              Quantity Sold
            </span>
            <div className="text-2xl font-bold text-zinc-950 font-mono mt-1">
              {totalUnitsSold} <span className="text-sm font-normal text-zinc-500">items</span>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
            <span>Active SKUs:</span>
            <span className="font-mono font-medium text-zinc-700">{topItems.length} top</span>
          </div>
        </div>
      </div>

      {/* Payment Modes & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Payment Modes */}
        <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-zinc-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-orange-500" />
            Payment Mode Breakdown
          </h3>

          <div className="space-y-3 pt-1">
            {[
              { label: 'Cash', key: 'cash', amount: paymentBreakdown.cash, color: 'bg-zinc-950' },
              { label: 'UPI', key: 'upi', amount: paymentBreakdown.upi, color: 'bg-orange-500' },
              { label: 'Card Swipe', key: 'card', amount: paymentBreakdown.card, color: 'bg-zinc-700' },
              { label: 'Credit / Due', key: 'credit', amount: paymentBreakdown.credit, color: 'bg-zinc-400' },
            ].map((p) => {
              const pct = totalRevenue > 0 ? (p.amount / totalRevenue) * 100 : 0;
              return (
                <div key={p.key} className="space-y-1.5 text-xs">
                  <div className="flex justify-between font-medium text-zinc-700">
                    <span>{p.label}</span>
                    <span className="font-mono text-zinc-950 font-semibold">
                      {formatINR(p.amount)} ({pct.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${p.color} transition-all duration-300`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Selling Items */}
        <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-zinc-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-500" />
              Top Selling Electrical Items
            </h3>
            <span className="text-[11px] text-zinc-500 font-medium">
              Profit based on cost vs selling price
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-zinc-400 font-semibold">
                  <th className="pb-2.5">#</th>
                  <th className="pb-2.5">Product Name</th>
                  <th className="pb-2.5 text-center">Units</th>
                  <th className="pb-2.5 text-right">Revenue</th>
                  <th className="pb-2.5 text-right text-emerald-700">Gross Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {topItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-zinc-400">
                      No sales data available for this duration.
                    </td>
                  </tr>
                ) : (
                  topItems.map((item, index) => (
                    <tr key={item.name || `top-item-${index}`} className="hover:bg-zinc-50">
                      <td className="py-2.5 text-zinc-400 font-mono">{index + 1}</td>
                      <td className="py-2.5 font-semibold text-zinc-900">{item.name}</td>
                      <td className="py-2.5 text-center font-mono text-zinc-600">
                        {item.qty} {item.unit}
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-zinc-950">
                        {formatINR(item.total)}
                      </td>
                      <td className="py-2.5 text-right font-mono">
                        <span className="font-bold text-emerald-700">{formatINR(item.profit)}</span>
                        <span className="text-[10px] text-emerald-600 block font-medium">({item.margin}%)</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Time-Ordered Sales & Discount Concessions Table */}
      <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-zinc-100 pb-3.5">
          <div>
            <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-500" />
              {reportPeriod === 'daily'
                ? `Daily Time-Ordered Sales & Discount Log (${selectedDate})`
                : reportPeriod === 'monthly'
                ? `Day-by-Day Sales & Discount Breakdown (${selectedMonth})`
                : `Month-by-Month Sales & Discount Breakdown (${selectedYear})`}
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              {reportPeriod === 'daily'
                ? 'Chronological transaction sequence with discount amounts granted and output tax for this date.'
                : reportPeriod === 'monthly'
                ? 'Daily progression of gross turnover, total discount conceded, and net collection throughout the month.'
                : 'Annual progression detailing monthly gross revenue, total discount conceded, and net collection.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-zinc-600 bg-orange-50 border border-orange-200/80 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-orange-600" />
              <span>Period Discounts Conceded:</span>
              <strong className="text-orange-700 font-mono font-bold">{formatINR(totalDiscount)}</strong>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          {reportPeriod === 'daily' ? (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-zinc-400 font-semibold">
                  <th className="pb-2.5">Time / Invoice #</th>
                  <th className="pb-2.5">Customer</th>
                  <th className="pb-2.5">Payment</th>
                  <th className="pb-2.5 text-center">Items</th>
                  <th className="pb-2.5 text-right">Gross Amount</th>
                  <th className="pb-2.5 text-right text-orange-600">Discount Conceded</th>
                  <th className="pb-2.5 text-right text-emerald-700">Gross Profit</th>
                  <th className="pb-2.5 text-right">GST (Tax)</th>
                  <th className="pb-2.5 text-right">Grand Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {timeOrderBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-zinc-400">
                      No invoices recorded for {selectedDate}.
                    </td>
                  </tr>
                ) : (
                  (timeOrderBreakdown as any[]).map((row) => {
                    const badge = getPaymentMethodBadge(row.paymentMethod);
                    return (
                      <tr key={row.id} className="hover:bg-zinc-50">
                        <td className="py-2.5">
                          <div className="font-semibold text-zinc-900 font-mono">{row.timeStr || '--:--'}</div>
                          <div className="text-[11px] text-zinc-500 font-mono">{row.invoiceNumber}</div>
                        </td>
                        <td className="py-2.5">
                          <div className="font-medium text-zinc-900">{row.customerName}</div>
                          {row.customerPhone && (
                            <div className="text-[11px] text-zinc-400">{row.customerPhone}</div>
                          )}
                        </td>
                        <td className="py-2.5">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.bg}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-2.5 text-center font-mono text-zinc-600">
                          {row.itemsCount}
                        </td>
                        <td className="py-2.5 text-right font-mono text-zinc-700">
                          {formatINR(row.gross)}
                        </td>
                        <td className="py-2.5 text-right font-mono font-semibold">
                          {row.discount > 0 ? (
                            <span className="text-orange-600">-{formatINR(row.discount)}</span>
                          ) : (
                            <span className="text-zinc-400">₹0.00</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right font-mono">
                          <span className="font-bold text-emerald-700">{formatINR(row.profit)}</span>
                          <span className="text-[10px] text-emerald-600 block font-normal">({row.margin}%)</span>
                        </td>
                        <td className="py-2.5 text-right font-mono text-zinc-600">
                          {formatINR(row.gst)}
                        </td>
                        <td className="py-2.5 text-right font-mono font-bold text-zinc-950">
                          {formatINR(row.net)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {timeOrderBreakdown.length > 0 && (
                <tfoot className="border-t-2 border-zinc-200 bg-zinc-50/70 font-semibold text-zinc-900">
                  <tr>
                    <td colSpan={3} className="py-3 px-1 text-left font-bold">
                      Day Total ({timeOrderBreakdown.length} {timeOrderBreakdown.length === 1 ? 'Bill' : 'Bills'})
                    </td>
                    <td className="py-3 text-center font-mono">{totalUnitsSold}</td>
                    <td className="py-3 text-right font-mono">{formatINR(totalGross)}</td>
                    <td className="py-3 text-right font-mono text-orange-600 font-bold">
                      -{formatINR(totalDiscount)}
                    </td>
                    <td className="py-3 text-right font-mono text-emerald-700 font-bold">
                      {formatINR(totalProfit)}
                    </td>
                    <td className="py-3 text-right font-mono">{formatINR(totalGst)}</td>
                    <td className="py-3 text-right font-mono font-bold text-zinc-950">
                      {formatINR(totalRevenue)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-zinc-400 font-semibold">
                  <th className="pb-2.5">
                    {reportPeriod === 'monthly' ? 'Date' : 'Month'}
                  </th>
                  <th className="pb-2.5 text-center">Bills Count</th>
                  <th className="pb-2.5 text-right">Gross Subtotal</th>
                  <th className="pb-2.5 text-right text-orange-600">Total Discount</th>
                  <th className="pb-2.5 text-right text-emerald-700">Gross Profit</th>
                  <th className="pb-2.5 text-right">GST Collected</th>
                  <th className="pb-2.5 text-right">Net Revenue</th>
                  <th className="pb-2.5 text-right">Avg Ticket</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {timeOrderBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-zinc-400">
                      No sales records found for this {reportPeriod === 'monthly' ? 'month' : 'year'}.
                    </td>
                  </tr>
                ) : (
                  (timeOrderBreakdown as any[]).map((row, idx) => {
                    const label =
                      reportPeriod === 'monthly'
                        ? formatDayDate(row.date)
                        : formatMonthName(row.month);
                    const avg = row.bills > 0 ? row.net / row.bills : 0;
                    return (
                      <tr key={row.date || row.month || `period-row-${idx}`} className="hover:bg-zinc-50">
                        <td className="py-2.5 font-semibold text-zinc-900">{label}</td>
                        <td className="py-2.5 text-center font-mono text-zinc-700">
                          {row.bills} {row.bills === 1 ? 'bill' : 'bills'}
                        </td>
                        <td className="py-2.5 text-right font-mono text-zinc-700">
                          {formatINR(row.gross)}
                        </td>
                        <td className="py-2.5 text-right font-mono font-semibold">
                          {row.discount > 0 ? (
                            <span className="text-orange-600">-{formatINR(row.discount)}</span>
                          ) : (
                            <span className="text-zinc-400">₹0.00</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right font-mono font-bold text-emerald-700">
                          {formatINR(row.profit)}
                        </td>
                        <td className="py-2.5 text-right font-mono text-zinc-600">
                          {formatINR(row.gst)}
                        </td>
                        <td className="py-2.5 text-right font-mono font-bold text-zinc-950">
                          {formatINR(row.net)}
                        </td>
                        <td className="py-2.5 text-right font-mono text-zinc-600">
                          {formatINR(avg)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {timeOrderBreakdown.length > 0 && (
                <tfoot className="border-t-2 border-zinc-200 bg-zinc-50/70 font-semibold text-zinc-900">
                  <tr>
                    <td className="py-3 px-1 text-left font-bold">
                      {reportPeriod === 'monthly'
                        ? `Month Total (${timeOrderBreakdown.length} active days)`
                        : `Year Total (${timeOrderBreakdown.length} active months)`}
                    </td>
                    <td className="py-3 text-center font-mono">{totalBills} bills</td>
                    <td className="py-3 text-right font-mono">{formatINR(totalGross)}</td>
                    <td className="py-3 text-right font-mono text-orange-600 font-bold">
                      -{formatINR(totalDiscount)}
                    </td>
                    <td className="py-3 text-right font-mono text-emerald-700 font-bold">
                      {formatINR(totalProfit)}
                    </td>
                    <td className="py-3 text-right font-mono">{formatINR(totalGst)}</td>
                    <td className="py-3 text-right font-mono font-bold text-zinc-950">
                      {formatINR(totalRevenue)}
                    </td>
                    <td className="py-3 text-right font-mono text-zinc-700">
                      {formatINR(avgBillValue)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
      </div>

      {/* Print Analytics Report Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 overflow-y-auto print-modal-backdrop">
          <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-300 print-modal-sheet">
            {/* Modal Header Toolbar (Hidden in Print) */}
            <div className="no-print flex items-center justify-between px-5 py-3 bg-slate-900 text-white border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-500 text-white rounded">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Business Report Print Preview</h2>
                  <p className="text-[11px] text-slate-400">
                    {selectedPeriodLabel} • Executive A4 Sales & Tax Analytics
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
                  title="Download standard A4 PDF"
                >
                  <Download className="w-3.5 h-3.5 text-orange-400" />
                  <span>Download A4 PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-black rounded-lg text-xs font-bold transition-colors shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Now</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors ml-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Report Content */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-white print-container print-document print-a4-sheet">
              {/* Header */}
              <div className="border-b border-slate-300 pb-4 mb-5">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-start gap-3.5">
                    <img
                      id="img-report-print-logo"
                      src={getShopLogoUrl(settings)}
                      alt="Store Logo"
                      className="w-12 h-18 shrink-0 object-contain"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h1 className="text-xl font-bold text-slate-900 uppercase tracking-tight">
                        {settings.shopName || 'Store'}
                      </h1>
                      {settings.tagline && <p className="text-xs text-slate-500">{settings.tagline}</p>}
                      {formatShopAddress(settings) && (
                        <p className="text-xs text-slate-600 mt-1">
                          {formatShopAddress(settings)}
                        </p>
                      )}
                      {formatShopContactLine(settings) && (
                        <p className="text-xs text-slate-600">
                          {formatShopContactLine(settings)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="inline-block px-3 py-1 bg-orange-100 text-orange-900 font-bold text-xs rounded uppercase tracking-wider mb-1">
                      Business Analytics Report
                    </span>
                    <p className="text-xs font-bold text-slate-800 uppercase mt-1">
                      {selectedPeriodLabel}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Generated: {new Date().toLocaleDateString('en-IN')}
                    </p>
                  </div>
                </div>
              </div>

              {/* 6 Summary Cards */}
              <div className="grid grid-cols-6 gap-2 mb-6 print-summary-grid-6 print-avoid-break">
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <span className="text-[10px] uppercase font-bold text-amber-800 block">Total Revenue</span>
                  <span className="text-base font-bold text-amber-950 font-mono mt-0.5 block">
                    {formatINR(totalRevenue)}
                  </span>
                  <span className="text-[10px] text-amber-700 font-mono block">Pre-tax: {formatINR(netTaxableSales)}</span>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-300">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">Gross Profit</span>
                  <span className="text-base font-bold text-emerald-950 font-mono mt-0.5 block">
                    {formatINR(totalProfit)}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-mono block">Margin: {profitMarginPercent}%</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Invoices</span>
                  <span className="text-base font-bold text-slate-900 font-mono mt-0.5 block">
                    {totalBills} Bills
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono block">Avg: {formatINR(avgBillValue)}</span>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <span className="text-[10px] uppercase font-bold text-orange-800 block">Total Discount</span>
                  <span className="text-base font-bold text-orange-950 font-mono mt-0.5 block">
                    -{formatINR(totalDiscount)}
                  </span>
                  <span className="text-[10px] text-orange-700 font-mono block">{discountedBillsCount} bills</span>
                </div>
                <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                  <span className="text-[10px] uppercase font-bold text-indigo-800 block">GST Collected</span>
                  <span className="text-base font-bold text-indigo-950 font-mono mt-0.5 block">
                    {formatINR(totalGst)}
                  </span>
                  <span className="text-[10px] text-indigo-700 block">Output Tax</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Units Sold</span>
                  <span className="text-base font-bold text-slate-900 font-mono mt-0.5 block">
                    {totalUnitsSold} Units
                  </span>
                  <span className="text-[10px] text-slate-500 block">Dispensed</span>
                </div>
              </div>

              {/* Payment Method Breakdown */}
              <div className="mb-6 print-avoid-break">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Payment Collection Breakdown
                </h3>
                <table className="w-full text-left text-xs border border-slate-300 print-table">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                    <tr>
                      <th className="py-2 px-3 border-r border-slate-200 text-left">Payment Channel</th>
                      <th className="py-2 px-3 border-r border-slate-200 text-right">Collected Amount</th>
                      <th className="py-2 px-3 text-center w-24">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    <tr>
                      <td className="py-2 px-3 border-r border-slate-200 font-medium text-left">Cash</td>
                      <td className="py-2 px-3 border-r border-slate-200 text-right font-mono font-bold">
                        {formatINR(paymentBreakdown.cash || 0)}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-slate-600">
                        {totalRevenue > 0 ? Math.round(((paymentBreakdown.cash || 0) / totalRevenue) * 100) : 0}%
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 border-r border-slate-200 font-medium text-left">UPI</td>
                      <td className="py-2 px-3 border-r border-slate-200 text-right font-mono font-bold">
                        {formatINR(paymentBreakdown.upi || 0)}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-slate-600">
                        {totalRevenue > 0 ? Math.round(((paymentBreakdown.upi || 0) / totalRevenue) * 100) : 0}%
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 border-r border-slate-200 font-medium text-left">Card / POS</td>
                      <td className="py-2 px-3 border-r border-slate-200 text-right font-mono font-bold">
                        {formatINR(paymentBreakdown.card || 0)}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-slate-600">
                        {totalRevenue > 0 ? Math.round(((paymentBreakdown.card || 0) / totalRevenue) * 100) : 0}%
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 border-r border-slate-200 font-medium text-left">Credit Book</td>
                      <td className="py-2 px-3 border-r border-slate-200 text-right font-mono font-bold text-amber-700">
                        {formatINR(paymentBreakdown.credit || 0)}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-slate-600">
                        {totalRevenue > 0 ? Math.round(((paymentBreakdown.credit || 0) / totalRevenue) * 100) : 0}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Top Products Table */}
              <div className="mb-6 print-avoid-break">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Top Selling Electrical Products
                </h3>
                <table className="w-full text-left text-xs border border-slate-300 print-table">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                    <tr>
                      <th className="py-2 px-3 border-r border-slate-200 text-center w-12">#</th>
                      <th className="py-2 px-3 border-r border-slate-200 text-left">Product Name</th>
                      <th className="py-2 px-3 border-r border-slate-200 text-center w-24">Units Sold</th>
                      <th className="py-2 px-3 text-right w-28 border-r border-slate-200">Revenue</th>
                      <th className="py-2 px-3 text-right w-32 text-emerald-800">Gross Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {topItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-400">
                          No product sales recorded in this period.
                        </td>
                      </tr>
                    ) : (
                      topItems.map((item, idx) => (
                        <tr key={item.name || `print-top-item-${idx}`}>
                          <td className="py-2 px-3 border-r border-slate-200 text-center text-slate-500 font-mono">{idx + 1}</td>
                          <td className="py-2 px-3 border-r border-slate-200 font-semibold text-slate-900 text-left">{item.name}</td>
                          <td className="py-2 px-3 border-r border-slate-200 text-center font-mono">{item.qty} {item.unit}</td>
                          <td className="py-2 px-3 border-r border-slate-200 text-right font-mono font-bold text-slate-900">{formatINR(item.total)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800">
                            {formatINR(item.profit)} <span className="text-[10px] font-normal text-emerald-700">({item.margin}%)</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Time-Ordered Sales & Discount Concessions Table in Print Preview */}
              <div className="mb-6 print-avoid-break">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  {reportPeriod === 'daily'
                    ? 'Time-Ordered Transaction & Discount Log'
                    : reportPeriod === 'monthly'
                    ? 'Day-by-Day Sales & Discount Breakdown'
                    : 'Month-by-Month Sales & Discount Breakdown'}
                </h3>
                <table className="w-full text-left text-xs border border-slate-300 print-table">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                    <tr>
                      <th className="py-2 px-3 border-r border-slate-200 text-left">
                        {reportPeriod === 'daily' ? 'Time / Bill #' : reportPeriod === 'monthly' ? 'Date' : 'Month'}
                      </th>
                      {reportPeriod === 'daily' && (
                        <th className="py-2 px-3 border-r border-slate-200 text-left">Customer</th>
                      )}
                      <th className="py-2 px-3 border-r border-slate-200 text-center">
                        {reportPeriod === 'daily' ? 'Payment' : 'Bills'}
                      </th>
                      <th className="py-2 px-3 border-r border-slate-200 text-right">Gross Subtotal</th>
                      <th className="py-2 px-3 border-r border-slate-200 text-right text-orange-800">Discount Conceded</th>
                      <th className="py-2 px-3 border-r border-slate-200 text-right text-emerald-800">Gross Profit</th>
                      <th className="py-2 px-3 border-r border-slate-200 text-right">GST</th>
                      <th className="py-2 px-3 text-right">Net Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {timeOrderBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={reportPeriod === 'daily' ? 8 : 7} className="py-4 text-center text-slate-400">
                          No transactions recorded during this period.
                        </td>
                      </tr>
                    ) : (
                      (timeOrderBreakdown as any[]).map((row, idx) => (
                        <tr key={row.id || row.date || row.month || `print-row-${idx}`}>
                          <td className="py-1.5 px-3 border-r border-slate-200 font-medium text-left">
                            {reportPeriod === 'daily'
                              ? `${row.timeStr || ''} (${row.invoiceNumber})`
                              : reportPeriod === 'monthly'
                              ? formatDayDate(row.date)
                              : formatMonthName(row.month)}
                          </td>
                          {reportPeriod === 'daily' && (
                            <td className="py-1.5 px-3 border-r border-slate-200 text-left">{row.customerName}</td>
                          )}
                          <td className="py-1.5 px-3 border-r border-slate-200 text-center font-mono">
                            {reportPeriod === 'daily' ? row.paymentMethod.toUpperCase() : row.bills}
                          </td>
                          <td className="py-1.5 px-3 border-r border-slate-200 text-right font-mono">
                            {formatINR(row.gross)}
                          </td>
                          <td className="py-1.5 px-3 border-r border-slate-200 text-right font-mono font-semibold text-orange-700">
                            {row.discount > 0 ? `-${formatINR(row.discount)}` : '₹0.00'}
                          </td>
                          <td className="py-1.5 px-3 border-r border-slate-200 text-right font-mono font-bold text-emerald-800">
                            {formatINR(row.profit)}
                          </td>
                          <td className="py-1.5 px-3 border-r border-slate-200 text-right font-mono">
                            {formatINR(row.gst)}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">
                            {formatINR(row.net)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {timeOrderBreakdown.length > 0 && (
                    <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                      <tr>
                        <td
                          colSpan={reportPeriod === 'daily' ? 2 : 1}
                          className="py-2 px-3 border-r border-slate-200 text-left"
                        >
                          Period Total ({totalBills} Bills)
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-center font-mono">
                          {totalBills}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-right font-mono">
                          {formatINR(totalGross)}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-right font-mono text-orange-700">
                          -{formatINR(totalDiscount)}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-right font-mono text-emerald-800 font-bold">
                          {formatINR(totalProfit)}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-right font-mono">
                          {formatINR(totalGst)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {formatINR(totalRevenue)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Footer */}
              <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400 print-signatory-footer">
                <span>Official Retail Store Performance & Sales Audit</span>
                <span>Manager / Store In-charge Signature ___________________</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
