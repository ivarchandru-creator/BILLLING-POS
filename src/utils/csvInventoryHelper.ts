import { Product, Supplier } from '../types';
import { ELECTRICAL_CATEGORIES } from '../data/electricalShopData';

export interface ParsedCsvProductRow {
  id: string;
  rowNumber: number;
  raw: Record<string, string>;
  product: Product;
  errors: string[];
  warnings: string[];
  status: 'valid' | 'warning' | 'error';
  isExistingMatch: boolean;
  matchedExistingProduct?: Product;
}

export interface ParseResult {
  rows: ParsedCsvProductRow[];
  totalRows: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  matchCount: number;
}

// Standard CSV Headers for the template
export const CSV_TEMPLATE_HEADERS = [
  'Item Name*',
  'Category',
  'Selling Price (₹)*',
  'Cost Price (₹)',
  'Current Stock',
  'Min Stock Threshold',
  'Unit',
  'GST Rate (%)',
  'HSN Code',
  'SKU Code',
  'Supplier Name',
];

// Sample rows representing realistic electrical shop inventory
export const CSV_TEMPLATE_SAMPLE_ROWS = [
  [
    'Anchor Roma 10A 1-Way Switch',
    'Switches & Sockets',
    '32',
    '22',
    '120',
    '25',
    'pcs',
    '18',
    '8536',
    'AR-SW-1-10A',
    'Havells & Anchor Regional Depot',
  ],
  [
    'Anchor Roma 20A Power Socket',
    'Switches & Sockets',
    '98',
    '68',
    '60',
    '15',
    'pcs',
    '18',
    '8536',
    'AR-SKT-20A',
    'Havells & Anchor Regional Depot',
  ],
  [
    'Finolex 1.5 sq mm FR Wire (90m Red)',
    'Wires & Cables',
    '1850',
    '1480',
    '35',
    '10',
    'coil',
    '18',
    '8544',
    'FNX-FR-15-RD',
    'Coimbatore Electricals & Cable Dist.',
  ],
  [
    'Finolex 2.5 sq mm FR Wire (90m Blue)',
    'Wires & Cables',
    '2950',
    '2380',
    '25',
    '8',
    'coil',
    '18',
    '8544',
    'FNX-FR-25-BL',
    'Coimbatore Electricals & Cable Dist.',
  ],
  [
    'Philips 9W Stellar Bright LED Bulb (B22)',
    'LED & Lighting',
    '110',
    '75',
    '80',
    '20',
    'pcs',
    '12',
    '8539',
    'PHL-LED-9W',
    'Philips Lighting Agency',
  ],
  [
    'Schneider 16A Single Pole C-Curve MCB',
    'MCB & Switchgear',
    '195',
    '140',
    '45',
    '15',
    'pcs',
    '18',
    '8536',
    'SCH-MCB-16A',
    'L&T Schneider Switchgear Hub',
  ],
  [
    'Finolex 25mm Heavy Duty PVC Conduit (3m)',
    'Pipes & Conduits',
    '95',
    '68',
    '150',
    '40',
    'meter',
    '18',
    '3917',
    'FNX-PVC-25MM',
    'Sri Balaji Pipes & Fittings',
  ],
  [
    'Orient 1200mm Ceiling Fan (Brown)',
    'Fans & Fixtures',
    '2250',
    '1750',
    '18',
    '5',
    'pcs',
    '18',
    '8414',
    'ORI-FAN-1200',
    'Havells & Anchor Regional Depot',
  ],
  [
    'Steel Grip PVC Electrical Insulation Tape Black',
    'Accessories & Tools',
    '15',
    '9',
    '200',
    '50',
    'pcs',
    '18',
    '3919',
    'SG-TAPE-BLK',
    'Sundaram Hardware Traders',
  ],
];

/**
 * Escapes a cell value for safe CSV output
 */
function escapeCsvCell(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates the CSV string content for the product import template
 */
export function generateProductCsvTemplateContent(): string {
  const headerLine = CSV_TEMPLATE_HEADERS.map(escapeCsvCell).join(',');
  const rowLines = CSV_TEMPLATE_SAMPLE_ROWS.map((row) => row.map(escapeCsvCell).join(','));
  return [headerLine, ...rowLines].join('\r\n');
}

/**
 * Downloads the sample CSV template with UTF-8 BOM so Excel opens it with proper formatting
 */
export function downloadProductCsvTemplate(): void {
  const csvContent = generateProductCsvTemplateContent();
  // Include \uFEFF UTF-8 Byte Order Mark for Excel compatibility
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'electrical_inventory_import_template.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports existing inventory products to CSV in the same standard template format
 */
export function exportProductsToCsv(products: Product[], suppliers: Supplier[]): void {
  const headerLine = CSV_TEMPLATE_HEADERS.map(escapeCsvCell).join(',');
  const rows = products.map((p) => {
    const supplier = suppliers.find((s) => s.supplierId === p.supplierId);
    return [
      escapeCsvCell(p.name),
      escapeCsvCell(p.category),
      escapeCsvCell(p.sellingPrice),
      escapeCsvCell(p.purchasePrice),
      escapeCsvCell(p.stockQty),
      escapeCsvCell(p.minimumStock),
      escapeCsvCell(p.unit),
      escapeCsvCell(p.gstRate),
      escapeCsvCell(p.hsnCode || ''),
      escapeCsvCell(p.skuCode || ''),
      escapeCsvCell(supplier ? supplier.companyName : ''),
    ].join(',');
  });

  const csvContent = [headerLine, ...rows].join('\r\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    `inventory_export_${new Date().toISOString().split('T')[0]}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Custom robust CSV string tokenizer supporting quotes, escaped quotes (""), and line breaks
 */
function tokenizeCsv(text: string): string[][] {
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;
  let i = 0;

  // Strip leading UTF-8 BOM if present
  let cleanText = text;
  if (cleanText.charCodeAt(0) === 0xfeff) {
    cleanText = cleanText.slice(1);
  }

  while (i < cleanText.length) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote: "" -> "
        currentCell += '"';
        i += 2;
        continue;
      }
      insideQuotes = !insideQuotes;
      i++;
      continue;
    }

    if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
      i++;
      continue;
    }

    if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentCell.trim());
      // Only push non-empty rows
      if (currentRow.some((c) => c.length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
      i++;
      continue;
    }

    currentCell += char;
    i++;
  }

  // Final cell & row if file doesn't end with a newline
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      lines.push(currentRow);
    }
  }

  return lines;
}

/**
 * Maps arbitrary header names to standardized product properties
 */
function matchColumnHeader(header: string): string | null {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (['itemname', 'productname', 'name', 'item', 'product', 'title', 'description'].includes(h)) {
    return 'name';
  }
  if (['category', 'itemcategory', 'productcategory', 'type', 'cat'].includes(h)) {
    return 'category';
  }
  if (
    [
      'sellingprice',
      'sellingprice',
      'price',
      'rate',
      'salesrate',
      'mrp',
      'retailprice',
      'saleprice',
    ].includes(h)
  ) {
    return 'sellingPrice';
  }
  if (
    [
      'costprice',
      'cost',
      'purchaseprice',
      'purchaserate',
      'buyprice',
      'costpricer',
      'buyingrate',
    ].includes(h)
  ) {
    return 'purchasePrice';
  }
  if (
    [
      'currentstock',
      'stock',
      'stockqty',
      'quantity',
      'initialstock',
      'qty',
      'openingstock',
      'available',
    ].includes(h)
  ) {
    return 'stockQty';
  }
  if (
    [
      'minstockthreshold',
      'minstock',
      'minimumstock',
      'threshold',
      'minqty',
      'reorderlevel',
      'alertstock',
    ].includes(h)
  ) {
    return 'minimumStock';
  }
  if (['unit', 'uom', 'measuringunit', 'unitofmeasure', 'measure'].includes(h)) {
    return 'unit';
  }
  if (['gstrate', 'gst', 'gstpercent', 'taxrate', 'tax', 'gstpercentage'].includes(h)) {
    return 'gstRate';
  }
  if (['hsncode', 'hsn', 'hsnsac', 'sac', 'hsnno'].includes(h)) {
    return 'hsnCode';
  }
  if (['skucode', 'sku', 'code', 'itemcode', 'productcode', 'barcode'].includes(h)) {
    return 'skuCode';
  }
  if (
    [
      'suppliername',
      'supplier',
      'vendor',
      'distributor',
      'dealer',
      'companyname',
    ].includes(h)
  ) {
    return 'supplier';
  }

  return null;
}

/**
 * Normalizes category against known electrical categories
 */
function normalizeCategory(catStr: string | undefined): { category: string; warning?: string } {
  if (!catStr || !catStr.trim()) {
    return {
      category: ELECTRICAL_CATEGORIES[1] || 'Switches & Sockets',
      warning: 'Category was empty, defaulted to Switches & Sockets',
    };
  }

  const raw = catStr.trim();
  // Exact match
  const exact = ELECTRICAL_CATEGORIES.find(
    (c) => c.toLowerCase() === raw.toLowerCase() && c !== 'All Items'
  );
  if (exact) return { category: exact };

  // Fuzzy match with standard categories
  const lower = raw.toLowerCase();
  if (lower.includes('switch') || lower.includes('socket') || lower.includes('plate')) {
    return { category: 'Switches & Sockets' };
  }
  if (lower.includes('wire') || lower.includes('cable') || lower.includes('copper')) {
    return { category: 'Wires & Cables' };
  }
  if (lower.includes('led') || lower.includes('light') || lower.includes('bulb') || lower.includes('tube') || lower.includes('panel') || lower.includes('flood')) {
    return { category: 'LED & Lighting' };
  }
  if (lower.includes('mcb') || lower.includes('breaker') || lower.includes('switchgear') || lower.includes('db') || lower.includes('rccb') || lower.includes('elcb') || lower.includes('isolator')) {
    return { category: 'MCB & Switchgear' };
  }
  if (lower.includes('pipe') || lower.includes('conduit') || lower.includes('casing') || lower.includes('bend') || lower.includes('pvc')) {
    return { category: 'Pipes & Conduits' };
  }
  if (lower.includes('fan') || lower.includes('fixture') || lower.includes('holder') || lower.includes('exhaust')) {
    return { category: 'Fans & Fixtures' };
  }

  // Preserve user's custom category name
  return {
    category: raw,
  };
}

/**
 * Normalizes product unit
 */
function normalizeUnit(unitStr: string | undefined): string {
  if (!unitStr) return 'pcs';
  const u = unitStr.toLowerCase().trim();
  if (['pcs', 'pc', 'piece', 'pieces', 'nos', 'no', 'unit'].includes(u)) return 'pcs';
  if (['coil', 'coils', 'bundle', 'roll'].includes(u)) return 'coil';
  if (['meter', 'meters', 'mtr', 'm', 'metre', 'metres'].includes(u)) return 'meter';
  if (['box', 'boxes', 'carton', 'pkt', 'pack', 'packet'].includes(u)) return 'box';
  if (['set', 'sets', 'pair'].includes(u)) return 'set';
  return u || 'pcs';
}

/**
 * Parses CSV text and validates each row against the electrical shop product model
 */
export function parseProductCsv(
  csvText: string,
  suppliers: Supplier[],
  existingProducts: Product[]
): ParseResult {
  const tokenized = tokenizeCsv(csvText);

  if (tokenized.length === 0) {
    return {
      rows: [],
      totalRows: 0,
      validCount: 0,
      warningCount: 0,
      errorCount: 0,
      matchCount: 0,
    };
  }

  // First row is headers
  const headerRow = tokenized[0];
  const columnMap: Record<number, string> = {};

  headerRow.forEach((h, index) => {
    const matched = matchColumnHeader(h);
    if (matched) {
      columnMap[index] = matched;
    }
  });

  const parsedRows: ParsedCsvProductRow[] = [];
  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  let matchCount = 0;

  // Process data rows
  for (let r = 1; r < tokenized.length; r++) {
    const rowCells = tokenized[r];
    const rawData: Record<string, string> = {};

    rowCells.forEach((cell, idx) => {
      const fieldName = columnMap[idx] || `col_${idx}`;
      rawData[fieldName] = cell;
    });

    const errors: string[] = [];
    const warnings: string[] = [];

    // Extract fields
    const rawName = rawData['name'] || '';
    if (!rawName.trim()) {
      errors.push('Missing Item Name (required)');
    }

    // Selling Price
    const rawSellingPrice = rawData['sellingPrice'];
    let sellingPrice = 0;
    if (rawSellingPrice === undefined || rawSellingPrice === '') {
      errors.push('Missing Selling Price (required)');
    } else {
      const parsed = parseFloat(rawSellingPrice.replace(/[^0-9.]/g, ''));
      if (isNaN(parsed) || parsed < 0) {
        errors.push(`Invalid Selling Price: "${rawSellingPrice}"`);
      } else {
        sellingPrice = parsed;
      }
    }

    // Cost / Purchase Price
    let purchasePrice = 0;
    const rawCost = rawData['purchasePrice'];
    if (rawCost !== undefined && rawCost !== '') {
      const parsedCost = parseFloat(rawCost.replace(/[^0-9.]/g, ''));
      if (!isNaN(parsedCost) && parsedCost >= 0) {
        purchasePrice = parsedCost;
      }
    } else {
      // Estimate purchase price around 75% if omitted
      purchasePrice = Math.round(sellingPrice * 0.75);
    }

    if (purchasePrice > sellingPrice && sellingPrice > 0) {
      warnings.push(`Cost Price (₹${purchasePrice}) is higher than Selling Price (₹${sellingPrice})`);
    }

    // Category
    const { category, warning: catWarn } = normalizeCategory(rawData['category']);
    if (catWarn) warnings.push(catWarn);

    // Stock Qty
    let stockQty = 0;
    const rawStock = rawData['stockQty'];
    if (rawStock !== undefined && rawStock !== '') {
      const parsedStock = parseFloat(rawStock.replace(/[^0-9.-]/g, ''));
      if (!isNaN(parsedStock)) {
        stockQty = Math.max(0, parsedStock);
      }
    }

    // Minimum Stock
    let minimumStock = 10;
    const rawMin = rawData['minimumStock'];
    if (rawMin !== undefined && rawMin !== '') {
      const parsedMin = parseFloat(rawMin.replace(/[^0-9.]/g, ''));
      if (!isNaN(parsedMin) && parsedMin >= 0) {
        minimumStock = parsedMin;
      }
    }

    // Unit
    const unit = normalizeUnit(rawData['unit']);

    // GST Rate
    let gstRate = 18;
    const rawGst = rawData['gstRate'];
    if (rawGst !== undefined && rawGst !== '') {
      const parsedGst = parseFloat(rawGst.replace(/[^0-9.]/g, ''));
      if (!isNaN(parsedGst) && parsedGst >= 0 && parsedGst <= 100) {
        gstRate = parsedGst;
      } else {
        warnings.push(`Invalid GST Rate "${rawGst}", defaulted to 18%`);
      }
    }

    // HSN Code
    let hsnCode = rawData['hsnCode']?.trim();
    if (!hsnCode) {
      // Common electrical HSN codes
      if (category === 'Wires & Cables') hsnCode = '8544';
      else if (category === 'LED & Lighting') hsnCode = '8539';
      else if (category === 'Pipes & Conduits') hsnCode = '3917';
      else if (category === 'Fans & Fixtures') hsnCode = '8414';
      else hsnCode = '8536';
    }

    // SKU Code
    const skuCode = rawData['skuCode']?.trim() || undefined;

    // Supplier matching
    let supplierId: string | undefined = undefined;
    const rawSupplier = rawData['supplier']?.trim();
    if (rawSupplier) {
      const matchedSupplier = suppliers.find(
        (s) =>
          s.companyName.toLowerCase().includes(rawSupplier.toLowerCase()) ||
          s.name.toLowerCase().includes(rawSupplier.toLowerCase()) ||
          s.supplierId.toLowerCase() === rawSupplier.toLowerCase()
      );
      if (matchedSupplier) {
        supplierId = matchedSupplier.supplierId;
      } else {
        warnings.push(`Supplier "${rawSupplier}" not found in system`);
      }
    }

    // Match against existing products by SKU or Name
    let matchedExistingProduct: Product | undefined = undefined;
    if (skuCode) {
      matchedExistingProduct = existingProducts.find(
        (p) => p.skuCode && p.skuCode.toLowerCase() === skuCode.toLowerCase()
      );
    }
    if (!matchedExistingProduct && rawName.trim()) {
      matchedExistingProduct = existingProducts.find(
        (p) => p.name.toLowerCase() === rawName.trim().toLowerCase()
      );
    }

    const isExistingMatch = Boolean(matchedExistingProduct);
    if (isExistingMatch) {
      matchCount++;
      warnings.push(`Matches existing product: "${matchedExistingProduct?.name}"`);
    }

    const status: 'valid' | 'warning' | 'error' =
      errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid';

    if (status === 'error') {
      errorCount++;
    } else if (status === 'warning') {
      warningCount++;
      validCount++; // still importable
    } else {
      validCount++;
    }

    const product: Product = {
      productId: matchedExistingProduct ? matchedExistingProduct.productId : `prod-${Date.now()}-${r}`,
      name: rawName.trim() || 'Untitled Product',
      category,
      skuCode: skuCode || undefined,
      sellingPrice,
      purchasePrice,
      gstRate,
      stockQty,
      minimumStock,
      unit,
      supplierId,
      activeStatus: true,
      hsnCode,
    };

    parsedRows.push({
      id: `csv-row-${r}`,
      rowNumber: r,
      raw: rawData,
      product,
      errors,
      warnings,
      status,
      isExistingMatch,
      matchedExistingProduct,
    });
  }

  return {
    rows: parsedRows,
    totalRows: parsedRows.length,
    validCount,
    warningCount,
    errorCount,
    matchCount,
  };
}
