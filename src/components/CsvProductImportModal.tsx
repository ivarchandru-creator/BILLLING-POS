import React, { useState, useRef, useId } from 'react';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Search,
  Check,
  Package,
} from 'lucide-react';
import { Product, Supplier } from '../types';
import {
  parseProductCsv,
  downloadProductCsvTemplate,
  generateProductCsvTemplateContent,
  ParseResult,
} from '../utils/csvInventoryHelper';
import { formatINR } from '../utils/formatters';

interface CsvProductImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  existingProducts: Product[];
  onImportProducts: (
    productsToSave: Product[],
    options: {
      updateExisting: boolean;
      stockMode: 'set' | 'add';
    }
  ) => void;
}

export const CsvProductImportModal: React.FC<CsvProductImportModalProps> = ({
  isOpen,
  onClose,
  suppliers,
  existingProducts,
  onImportProducts,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'new' | 'matched'>('all');
  const [updateExisting, setUpdateExisting] = useState(true);
  const [stockMode, setStockMode] = useState<'set' | 'add'>('set');

  if (!isOpen) return null;

  const handleFileProcess = (file: File) => {
    setUploadError(null);
    const lowerName = file.name.toLowerCase();
    const isCsvOrText =
      lowerName.endsWith('.csv') ||
      lowerName.endsWith('.txt') ||
      lowerName.endsWith('.tsv') ||
      file.type.includes('csv') ||
      file.type.includes('text') ||
      file.type.includes('excel') ||
      !file.type;

    if (!isCsvOrText) {
      setUploadError(`"${file.name}" is not a recognized spreadsheet file. Please upload a .csv file.`);
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (text && text.trim().length > 0) {
          const result = parseProductCsv(text, suppliers, existingProducts);
          setParseResult(result);
          setFilterTab('all');
          setSearchQuery('');
        } else {
          setUploadError('The uploaded file is empty.');
        }
      } catch (err: any) {
        setUploadError(`Failed to parse file: ${err?.message || 'Unknown error'}`);
      }
    };
    reader.onerror = () => {
      setUploadError('Failed to read file from disk. Please try again.');
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleLoadSampleData = () => {
    setUploadError(null);
    const sampleCsv = generateProductCsvTemplateContent();
    setFileName('sample_electrical_products.csv');
    const result = parseProductCsv(sampleCsv, suppliers, existingProducts);
    setParseResult(result);
    setFilterTab('all');
    setSearchQuery('');
  };

  const handleReset = () => {
    setFileName(null);
    setParseResult(null);
    setUploadError(null);
    setSearchQuery('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Valid rows ready for import
  const validRows = parseResult?.rows.filter((r) => r.status !== 'error') || [];
  const newItemsCount = validRows.filter((r) => !r.isExistingMatch).length;
  const matchItemsCount = validRows.filter((r) => r.isExistingMatch).length;

  // Filter rows by tab & search query
  const filteredRows = validRows.filter((row) => {
    if (filterTab === 'new' && row.isExistingMatch) return false;
    if (filterTab === 'matched' && !row.isExistingMatch) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = row.product.name.toLowerCase().includes(q);
      const catMatch = row.product.category.toLowerCase().includes(q);
      const skuMatch = row.product.skuCode?.toLowerCase().includes(q);
      return nameMatch || catMatch || skuMatch;
    }
    return true;
  });

  const handleExecuteImport = () => {
    if (!parseResult || validRows.length === 0) return;

    const productsToImport = validRows.map((r) => r.product);

    onImportProducts(productsToImport, {
      updateExisting,
      stockMode,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Import Products
              </h2>
              <p className="text-xs text-slate-400">
                Bulk add or update inventory from Excel or CSV
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!parseResult && (
              <button
                type="button"
                id="btn-modal-download-template"
                onClick={downloadProductCsvTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
                title="Download sample format with example products"
              >
                <Download className="w-3.5 h-3.5 text-orange-400" />
                <span className="hidden sm:inline">Download Sample Format</span>
                <span className="sm:hidden">Template</span>
              </button>
            )}

            <button
              type="button"
              id="btn-close-csv-modal"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50/60">
          {!parseResult ? (
            /* STEP 1: Simple, Clean Upload Screen */
            <div className="space-y-5">
              {uploadError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadError(null)}
                    className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Upload Drop Zone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 flex flex-col items-center justify-center text-center transition-all cursor-pointer shadow-xs ${
                  dragActive
                    ? 'border-orange-500 bg-orange-50/60 scale-[0.99]'
                    : 'border-slate-300 bg-white hover:border-orange-400 hover:bg-orange-50/20'
                }`}
              >
                <input
                  ref={fileInputRef}
                  id={fileInputId}
                  type="file"
                  accept=".csv,text/csv,text/plain,.tsv,text/tab-separated-values,application/vnd.ms-excel"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileProcess(e.target.files[0]);
                    }
                  }}
                />

                <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-600 flex items-center justify-center mb-3">
                  <Upload className="w-7 h-7" />
                </div>

                <h3 className="text-base font-bold text-slate-900">
                  Select your CSV file to import
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Drag and drop here, or click to choose from your computer
                </p>

                <div className="mt-5 flex items-center flex-wrap justify-center gap-2.5">
                  <button
                    type="button"
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors pointer-events-none"
                  >
                    Browse Files
                  </button>
                  <span className="text-xs text-slate-400">or</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoadSampleData();
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-orange-50 text-orange-700 border border-orange-200 font-semibold text-xs rounded-xl transition-colors cursor-pointer shadow-2xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                    <span>Try with 9 Sample Electrical Items</span>
                  </button>
                </div>
              </div>

              {/* 3 Simple Steps Guide */}
              <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-3">
                  How it works:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                      1
                    </span>
                    <div>
                      <p className="font-bold text-slate-900">Prepare your file</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Include columns like Item Name, Price, and Stock.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                      2
                    </span>
                    <div>
                      <p className="font-bold text-slate-900">Upload here</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Works with files from Excel, Tally, or any billing software.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                      3
                    </span>
                    <div>
                      <p className="font-bold text-slate-900">Review & Confirm</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Verify your items and add them in 1-click.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* STEP 2: Clean, Straightforward Review & Confirm Screen */
            <div className="space-y-4">
              
              {/* Ready to Import Summary Banner */}
              <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-emerald-950">
                        {validRows.length} {validRows.length === 1 ? 'Product' : 'Products'} Ready to Import
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-emerald-800 mt-0.5">
                      <span className="font-medium text-emerald-900">
                        {newItemsCount} New {newItemsCount === 1 ? 'Item' : 'Items'}
                      </span>
                      {matchItemsCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="font-medium text-amber-800">
                            {matchItemsCount} Existing {matchItemsCount === 1 ? 'Item' : 'Items'} to Update
                          </span>
                        </>
                      )}
                      <span>•</span>
                      <span className="text-emerald-700 font-mono text-[11px] truncate max-w-[150px]">
                        {fileName}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-2xs"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Change File</span>
                </button>
              </div>

              {/* Compact Settings Strip */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-2 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateExisting}
                      onChange={(e) => setUpdateExisting(e.target.checked)}
                      className="w-4 h-4 rounded text-orange-500 border-slate-300 focus:ring-orange-500 cursor-pointer"
                    />
                    <span>Update existing products if product name or SKU matches</span>
                  </label>

                  {updateExisting && (
                    <div className="flex items-center gap-2 text-slate-600 sm:border-l sm:border-slate-200 sm:pl-3">
                      <span className="text-slate-500 text-[11px]">Stock count:</span>
                      <select
                        value={stockMode}
                        onChange={(e) => setStockMode(e.target.value as 'set' | 'add')}
                        className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-orange-500 cursor-pointer"
                      >
                        <option value="set">Set to file count (Recommended)</option>
                        <option value="add">Add to existing stock</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Search & Filter Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                {/* Filter Pills */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFilterTab('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      filterTab === 'all'
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    All ({validRows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('new')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      filterTab === 'new'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    New Items ({newItemsCount})
                  </button>
                  {matchItemsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterTab('matched')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        filterTab === 'matched'
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'bg-white hover:bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      Updates ({matchItemsCount})
                    </button>
                  )}
                </div>

                {/* Quick Search */}
                <div className="relative w-full sm:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search in preview..."
                    className="w-full pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 font-medium"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Clean Preview Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/90 text-slate-700 font-bold sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center text-slate-400">#</th>
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3 text-right">Selling Price</th>
                        <th className="py-2.5 px-3 text-center">Stock</th>
                        <th className="py-2.5 px-3 text-center">GST</th>
                        <th className="py-2.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-slate-400">
                            No products match your search or filter.
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((row, idx) => {
                          const p = row.product;
                          return (
                            <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                                {idx + 1}
                              </td>

                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-900 leading-snug">
                                  {p.name}
                                </div>
                                {p.skuCode && (
                                  <span className="text-[10.5px] font-mono text-slate-400 block mt-0.5">
                                    SKU: {p.skuCode}
                                  </span>
                                )}
                              </td>

                              <td className="py-2.5 px-3">
                                <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                                  {p.category}
                                </span>
                              </td>

                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                {formatINR(p.sellingPrice)}
                              </td>

                              <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-800">
                                {p.stockQty}{' '}
                                <span className="text-[10px] text-slate-400 font-normal">
                                  {p.unit}
                                </span>
                              </td>

                              <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                                {p.gstRate}%
                              </td>

                              <td className="py-2.5 px-3 text-center">
                                {row.isExistingMatch ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                                    <RefreshCw className="w-2.5 h-2.5" />
                                    <span>Update</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900">
                                    <Check className="w-2.5 h-2.5" />
                                    <span>New</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>

          {parseResult && (
            <button
              type="button"
              id="btn-confirm-import-csv"
              onClick={handleExecuteImport}
              disabled={validRows.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Package className="w-4 h-4" />
              <span>Confirm & Import {validRows.length} Products</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
