import React, { useState, useRef, useId } from 'react';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';
import { Product, Supplier } from '../types';
import {
  parseProductCsv,
  downloadProductCsvTemplate,
  generateProductCsvTemplateContent,
  ParseResult,
  ParsedCsvProductRow,
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
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'valid' | 'matched' | 'errors'>('all');
  const [updateExisting, setUpdateExisting] = useState(true);
  const [stockMode, setStockMode] = useState<'set' | 'add'>('set');

  if (!isOpen) return null;

  const handleFileProcess = (file: File) => {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      alert('Please upload a valid .csv file.');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        const result = parseProductCsv(text, suppliers, existingProducts);
        setParseResult(result);
        setFilterTab('all');
      }
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
    const sampleCsv = generateProductCsvTemplateContent();
    setFileName('sample_electrical_products.csv');
    const result = parseProductCsv(sampleCsv, suppliers, existingProducts);
    setParseResult(result);
    setFilterTab('all');
  };

  const handleReset = () => {
    setFileName(null);
    setParseResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Filter rows for the preview list
  const filteredRows = parseResult?.rows.filter((row) => {
    if (filterTab === 'valid') return row.status !== 'error' && !row.isExistingMatch;
    if (filterTab === 'matched') return row.isExistingMatch && row.status !== 'error';
    if (filterTab === 'errors') return row.status === 'error';
    return true;
  }) || [];

  const validRows = parseResult?.rows.filter((r) => r.status !== 'error') || [];
  const newItemsCount = validRows.filter((r) => !r.isExistingMatch).length;
  const matchItemsCount = validRows.filter((r) => r.isExistingMatch).length;

  const handleExecuteImport = () => {
    if (!parseResult || validRows.length === 0) return;

    // Build the final array of products to persist
    const productsToImport = validRows.map((r) => r.product);

    onImportProducts(productsToImport, {
      updateExisting,
      stockMode,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Import Products from CSV
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-modal-download-template"
              onClick={downloadProductCsvTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
              title="Download pre-formatted sample CSV template"
            >
              <Download className="w-3.5 h-3.5 text-orange-400" />
              <span>Download CSV Template</span>
            </button>

            <button
              type="button"
              id="btn-close-csv-modal"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          {!parseResult ? (
            /* Upload Screen */
            <div className="space-y-6">
              {/* Drag & Drop Upload Box */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 sm:p-10 flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${
                  dragActive
                    ? 'border-orange-500 bg-orange-50/40'
                    : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/50'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  id={fileInputId}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileProcess(e.target.files[0]);
                    }
                  }}
                />

                <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-600 flex items-center justify-center mb-4 shadow-2xs">
                  <Upload className="w-7 h-7" />
                </div>

                <h3 className="text-base font-bold text-slate-900">
                  Click to select or drag and drop your CSV file
                </h3>

                <div className="mt-4 flex items-center gap-2">
                  <span className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg border border-slate-200">
                    Browse Files
                  </span>
                  <span className="text-xs text-slate-400">or</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoadSampleData();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-orange-50 text-orange-600 border border-orange-200 font-semibold text-xs rounded-lg transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Try with 9 Sample Electrical Items</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Parsed File Preview & Confirmation Screen */
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    File Loaded
                  </span>
                  <span className="text-xs font-bold text-slate-900 font-mono truncate block mt-0.5" title={fileName || ''}>
                    {fileName}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {parseResult.totalRows} rows parsed
                  </span>
                </div>

                <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                    Valid to Import
                  </span>
                  <span className="text-lg font-bold text-emerald-950 font-mono mt-0.5 block">
                    {parseResult.validCount}
                  </span>
                  <span className="text-[11px] text-emerald-700 font-medium">
                    {newItemsCount} new • {matchItemsCount} existing
                  </span>
                </div>

                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                    Catalog Matches
                  </span>
                  <span className="text-lg font-bold text-amber-950 font-mono mt-0.5 block">
                    {parseResult.matchCount}
                  </span>
                  <span className="text-[11px] text-amber-700 font-medium">
                    Matches existing items
                  </span>
                </div>

                <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 block">
                    Errors
                  </span>
                  <span className="text-lg font-bold text-rose-950 font-mono mt-0.5 block">
                    {parseResult.errorCount}
                  </span>
                  <span className="text-[11px] text-rose-700 font-medium">
                    {parseResult.errorCount === 0 ? 'All rows clean' : 'Rows will be skipped'}
                  </span>
                </div>
              </div>

              {/* Import Settings & Strategy Controls */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <span className="text-xs font-bold text-slate-900 block">
                  Import Behavior Options:
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* Option 1: Existing match strategy */}
                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-700 block">
                      When item matches existing product (by SKU or Name):
                    </label>
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 text-slate-800 cursor-pointer">
                        <input
                          type="radio"
                          name="updateExisting"
                          checked={updateExisting}
                          onChange={() => setUpdateExisting(true)}
                          className="accent-orange-500"
                        />
                        <span>Update existing product (recommended)</span>
                      </label>
                      <label className="flex items-center gap-2 text-slate-800 cursor-pointer">
                        <input
                          type="radio"
                          name="updateExisting"
                          checked={!updateExisting}
                          onChange={() => setUpdateExisting(false)}
                          className="accent-orange-500"
                        />
                        <span>Always create as new separate items</span>
                      </label>
                    </div>
                  </div>

                  {/* Option 2: Stock mode */}
                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-700 block">
                      For matched products, update stock level as:
                    </label>
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 text-slate-800 cursor-pointer">
                        <input
                          type="radio"
                          name="stockMode"
                          checked={stockMode === 'set'}
                          onChange={() => setStockMode('set')}
                          className="accent-orange-500"
                        />
                        <span>Replace with CSV stock value (e.g. physical count)</span>
                      </label>
                      <label className="flex items-center gap-2 text-slate-800 cursor-pointer">
                        <input
                          type="radio"
                          name="stockMode"
                          checked={stockMode === 'add'}
                          onChange={() => setStockMode('add')}
                          className="accent-orange-500"
                        />
                        <span>Add CSV stock to existing stock (replenishment)</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFilterTab('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      filterTab === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All Rows ({parseResult.totalRows})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('valid')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      filterTab === 'valid'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    New Products ({newItemsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('matched')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      filterTab === 'matched'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Existing Matches ({matchItemsCount})
                  </button>
                  {parseResult.errorCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterTab('errors')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        filterTab === 'errors'
                          ? 'bg-rose-600 text-white'
                          : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                      }`}
                    >
                      Errors ({parseResult.errorCount})
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Choose Another File</span>
                </button>
              </div>

              {/* Scrollable Preview Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center">#</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Item Name & SKU</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3 text-right">Selling Price</th>
                        <th className="py-2.5 px-3 text-right">Cost Price</th>
                        <th className="py-2.5 px-3 text-center">Stock</th>
                        <th className="py-2.5 px-3 text-center">GST</th>
                        <th className="py-2.5 px-3">HSN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-400">
                            No rows found under this filter.
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((row) => {
                          const p = row.product;
                          return (
                            <tr
                              key={row.id}
                              className={`hover:bg-slate-50 transition-colors ${
                                row.status === 'error' ? 'bg-rose-50/40' : ''
                              }`}
                            >
                              <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                                {row.rowNumber}
                              </td>

                              <td className="py-2.5 px-3">
                                {row.status === 'error' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold bg-rose-100 text-rose-800">
                                    <AlertCircle className="w-3 h-3" />
                                    <span>Error</span>
                                  </span>
                                ) : row.isExistingMatch ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold bg-amber-100 text-amber-800">
                                    <RefreshCw className="w-3 h-3" />
                                    <span>Update</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold bg-emerald-100 text-emerald-800">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>New Item</span>
                                  </span>
                                )}
                              </td>

                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-900">{p.name}</div>
                                {p.skuCode && (
                                  <div className="text-[10px] text-slate-500 font-mono">
                                    SKU: {p.skuCode}
                                  </div>
                                )}
                                {row.errors.length > 0 && (
                                  <div className="text-[10px] text-rose-600 font-semibold mt-0.5">
                                    {row.errors.join(', ')}
                                  </div>
                                )}
                                {row.warnings.length > 0 && (
                                  <div className="text-[10px] text-amber-600 mt-0.5">
                                    {row.warnings.join(' • ')}
                                  </div>
                                )}
                              </td>

                              <td className="py-2.5 px-3 text-slate-600">{p.category}</td>

                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                {formatINR(p.sellingPrice)}
                                <span className="text-[10px] text-slate-400 font-normal ml-0.5">
                                  /{p.unit}
                                </span>
                              </td>

                              <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                                {formatINR(p.purchasePrice)}
                              </td>

                              <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                                {p.stockQty}{' '}
                                <span className="text-[10px] text-slate-400 font-normal">
                                  {p.unit}
                                </span>
                              </td>

                              <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                                {p.gstRate}%
                              </td>

                              <td className="py-2.5 px-3 font-mono text-slate-500">
                                {p.hsnCode || '-'}
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

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-colors"
          >
            Cancel
          </button>

          {parseResult && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">
                Ready to import <strong className="text-slate-900">{validRows.length}</strong> valid items
              </span>
              <button
                type="button"
                id="btn-confirm-import-csv"
                onClick={handleExecuteImport}
                disabled={validRows.length === 0}
                className="flex items-center gap-2 px-5 py-2 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 text-black text-xs font-bold rounded-lg shadow-xs transition-colors"
              >
                <span>Import {validRows.length} Products</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
