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
 * Robust number parsing supporting Indian currency notations (Rs, Rs., ₹, INR, /-, commas, %)
 */
export function parseNumber(raw: any): number | null {
  if (raw === undefined || raw === null) return null;
  let str = String(raw).trim();
  if (!str || /^(n\/?a|nil|null|none|-|--)$/i.test(str)) return null;
  // Clean currency symbols, Rs/Rs./INR, /-, % and spaces
  // Handle commas used as thousands separator
  str = str.replace(/₹|inr|\brs\.?|\/-|%/gi, '').replace(/,/g, '').trim();
  const match = str.match(/[-+]?\d*\.?\d+/);
  if (!match) return null;
  const num = parseFloat(match[0]);
  return isNaN(num) ? null : num;
}

/**
 * Custom robust CSV string tokenizer supporting quotes, escaped quotes (""),
 * stray quotes in product names (e.g. 1" PVC pipe, 2" Gang Box), and multiple delimiters (, ; \t |).
 */
function tokenizeCsv(text: string): string[][] {
  if (!text) return [];

  // Strip leading UTF-8 BOM if present
  let cleanText = text.replace(/^\uFEFF+/, '');

  // Auto-detect delimiter based on frequency in first non-empty lines
  const sampleLines = cleanText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 10);

  const delimiterCounts: Record<string, number> = { ',': 0, ';': 0, '\t': 0, '|': 0 };
  for (const line of sampleLines) {
    for (const d of Object.keys(delimiterCounts)) {
      let inQ = false;
      for (let j = 0; j < line.length; j++) {
        if (line[j] === '"') inQ = !inQ;
        else if (!inQ && line[j] === d) delimiterCounts[d]++;
      }
    }
  }

  const bestDelim = Object.entries(delimiterCounts).sort((a, b) => b[1] - a[1])[0];
  const delim = bestDelim && bestDelim[1] > 0 ? bestDelim[0] : ',';

  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  let cellHasContent = false;
  let i = 0;

  while (i < cleanText.length) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (!cellHasContent) {
      if (char === ' ' || char === '\t') {
        currentCell += char;
        i++;
        continue;
      }
      cellHasContent = true;
      if (char === '"') {
        inQuotes = true;
        currentCell = ''; // Strip starting quote
        i++;
        continue;
      }
    }

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: "" -> "
          currentCell += '"';
          i += 2;
          continue;
        }
        // Check if this quote is followed by delimiter, newline, or EOF (valid closing quote)
        let p = i + 1;
        while (p < cleanText.length && (cleanText[p] === ' ' || cleanText[p] === '\t')) p++;
        const pChar = cleanText[p];
        if (pChar === delim || pChar === '\r' || pChar === '\n' || p >= cleanText.length) {
          inQuotes = false;
          i = p;
          continue;
        } else {
          // Stray quote inside text (e.g. 1" inside "Finolex 1" Conduit")
          currentCell += '"';
          i++;
          continue;
        }
      }
      currentCell += char;
      i++;
      continue;
    }

    // Outside quotes
    if (char === delim) {
      currentRow.push(currentCell.trim());
      currentCell = '';
      cellHasContent = false;
      i++;
      continue;
    }

    if (char === '\r' || char === '\n') {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentCell.trim());
      // Skip completely empty lines
      if (currentRow.some((c) => c.length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
      cellHasContent = false;
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
 * Maps arbitrary header names to standardized product properties with exhaustive Indian POS synonyms
 */
function matchColumnHeader(header: string): string | null {
  if (!header || !header.trim()) return null;

  // Clean header: remove (rs), (inr), (₹), %, *, brackets and spaces
  const cleaned = header
    .toLowerCase()
    .replace(/\((?:rs\.?|inr|₹|%|pcs|nos)\)/gi, '')
    .replace(/[^a-z0-9]/g, '');

  // 1. Item Name
  if (
    [
      'itemname',
      'productname',
      'name',
      'item',
      'product',
      'title',
      'description',
      'particulars',
      'particular',
      'itemdescription',
      'productdescription',
      'descriptionofgoods',
      'descofgoods',
      'materialdescription',
      'materialname',
      'material',
      'itemdetails',
      'productdetails',
      'itemtitle',
      'goods',
      'goodsservice',
      'article',
      'articlename',
      'itemdesc',
      'productdesc',
      'modelname',
      'nameoftheitem',
      'stockitem',
      'stockitemname',
      'productitem',
    ].includes(cleaned)
  ) {
    return 'name';
  }

  // 2. Selling Price
  if (
    [
      'sellingprice',
      'sellingpriceinr',
      'sellingpricers',
      'salesprice',
      'salespricers',
      'saleprice',
      'salepricers',
      'salerate',
      'saleraters',
      'salesrate',
      'salesraters',
      'sellingrate',
      'sellingraters',
      'sellprice',
      'sellrate',
      'price',
      'pricers',
      'priceinr',
      'rate',
      'raters',
      'rateinr',
      'mrp',
      'mrprs',
      'mrpinr',
      'retailprice',
      'retailrate',
      'retailpricers',
      'unitprice',
      'unitpricers',
      'unitrate',
      'unitraters',
      'standardrate',
      'standardprice',
      'listprice',
      'rateperunit',
      'priceperunit',
      'rateunit',
      'priceunit',
      'netrate',
      'netprice',
      'counterrate',
      'counterprice',
      'amount',
      'finalprice',
      'billingrate',
      'selling',
    ].includes(cleaned)
  ) {
    return 'sellingPrice';
  }

  // 3. Purchase / Cost Price
  if (
    [
      'costprice',
      'costpricers',
      'costpriceinr',
      'costpricer',
      'costrate',
      'costraters',
      'cost',
      'costrs',
      'costinr',
      'purchaseprice',
      'purchasepricers',
      'purchasepriceinr',
      'purchaserate',
      'purchaseraters',
      'buyprice',
      'buypricers',
      'buyrate',
      'buyraters',
      'buyingprice',
      'buyingrate',
      'purprice',
      'purrate',
      'purcost',
      'purchasecost',
      'landingcost',
      'dealerprice',
      'dealerrate',
      'wholesaleprice',
      'wholesalerate',
      'tradeprice',
      'traderate',
      'supplierprice',
      'supplierrate',
    ].includes(cleaned)
  ) {
    return 'purchasePrice';
  }

  // 4. Stock Quantity
  if (
    [
      'currentstock',
      'stock',
      'stockqty',
      'stockquantity',
      'quantity',
      'qty',
      'initialstock',
      'openingstock',
      'openingqty',
      'opstock',
      'opqty',
      'closingstock',
      'closingqty',
      'balancestock',
      'balanceqty',
      'balstock',
      'balqty',
      'available',
      'availablestock',
      'availableqty',
      'inhand',
      'stockinhand',
      'instock',
      'physicalstock',
      'totalstock',
      'totalqty',
      'count',
      'onhand',
      'stockonhand',
      'unitsinstock',
      'itemcount',
      'qtynos',
      'qtypcs',
      'stocknos',
      'stockpcs',
      'stockqtypcs',
    ].includes(cleaned)
  ) {
    return 'stockQty';
  }

  // 5. Minimum Stock Threshold
  if (
    [
      'minstockthreshold',
      'minstock',
      'minimumstock',
      'minstockqty',
      'threshold',
      'minqty',
      'minimumqty',
      'reorderlevel',
      'reorderqty',
      'reorderpoint',
      'reorder',
      'alertstock',
      'lowstockalert',
      'lowstock',
      'dangerlevel',
      'minlevel',
      'safetystock',
      'bufferstock',
      'minorderqty',
    ].includes(cleaned)
  ) {
    return 'minimumStock';
  }

  // 6. Category
  if (
    [
      'category',
      'itemcategory',
      'productcategory',
      'type',
      'cat',
      'group',
      'itemgroup',
      'productgroup',
      'stockgroup',
      'under',
      'subgroup',
      'subcategory',
      'class',
      'classification',
      'department',
      'dept',
      'section',
      'brand',
      'make',
      'company',
    ].includes(cleaned)
  ) {
    return 'category';
  }

  // 7. Unit of Measure
  if (
    [
      'unit',
      'uom',
      'measuringunit',
      'unitofmeasure',
      'unitofmeasurement',
      'measure',
      'packing',
      'pack',
      'packunit',
      'pkg',
      'package',
      'per',
      'unituom',
      'units',
    ].includes(cleaned)
  ) {
    return 'unit';
  }

  // 8. GST Rate
  if (
    [
      'gstrate',
      'gst',
      'gstpercent',
      'gstpercentage',
      'taxrate',
      'tax',
      'taxpercent',
      'taxpercentage',
      'gstslab',
      'taxslab',
      'gstpct',
      'taxpct',
      'igst',
      'igstrate',
      'igstpercent',
      'rateoftax',
      'applicabletax',
      'vat',
      'vatpercent',
    ].includes(cleaned)
  ) {
    return 'gstRate';
  }

  // 9. HSN Code
  if (
    [
      'hsncode',
      'hsn',
      'hsnsac',
      'hsnsaccode',
      'hsnno',
      'hsnnumber',
      'sac',
      'saccode',
      'tariff',
      'tariffcode',
      'commoditycode',
    ].includes(cleaned)
  ) {
    return 'hsnCode';
  }

  // 10. SKU / Barcode
  if (
    [
      'skucode',
      'sku',
      'code',
      'itemcode',
      'productcode',
      'barcode',
      'barcodeno',
      'upc',
      'ean',
      'partno',
      'partnumber',
      'modelno',
      'modelnumber',
      'catalogno',
      'catalogue',
      'catalogueno',
      'itemid',
      'productid',
      'serialno',
      'itemno',
    ].includes(cleaned)
  ) {
    return 'skuCode';
  }

  // 11. Supplier / Vendor
  if (
    [
      'suppliername',
      'supplier',
      'vendor',
      'vendorname',
      'distributor',
      'distributorname',
      'dealer',
      'dealername',
      'partyname',
      'party',
      'companyname',
      'manufacturer',
      'mfg',
      'maker',
      'agency',
      'depot',
      'source',
    ].includes(cleaned)
  ) {
    return 'supplier';
  }

  // Fuzzy substring fallbacks
  if (cleaned.includes('itemname') || cleaned.includes('productname')) return 'name';
  if (cleaned.includes('selling') || cleaned.includes('saleprice') || cleaned.includes('salerate')) return 'sellingPrice';
  if (cleaned.includes('cost') || cleaned.includes('purchase')) return 'purchasePrice';
  if (cleaned.includes('stock') || cleaned.includes('qty')) return 'stockQty';

  return null;
}

/**
 * Normalizes category against known electrical categories with smart name keyword inference
 */
function normalizeCategory(catStr: string | undefined, productName?: string): { category: string; warning?: string } {
  const pName = (productName || '').toLowerCase();

  // If category is provided
  if (catStr && catStr.trim()) {
    const raw = catStr.trim();
    // Exact match
    const exact = ELECTRICAL_CATEGORIES.find(
      (c) => c.toLowerCase() === raw.toLowerCase() && c !== 'All Items'
    );
    if (exact) return { category: exact };

    // Fuzzy match with standard categories
    const lower = raw.toLowerCase();
    if (lower.includes('switch') || lower.includes('socket') || lower.includes('plate') || lower.includes('roma') || lower.includes('gang')) {
      return { category: 'Switches & Sockets' };
    }
    if (lower.includes('wire') || lower.includes('cable') || lower.includes('copper') || lower.includes('aluminum')) {
      return { category: 'Wires & Cables' };
    }
    if (lower.includes('led') || lower.includes('light') || lower.includes('bulb') || lower.includes('tube') || lower.includes('panel') || lower.includes('flood') || lower.includes('batten') || lower.includes('spot')) {
      return { category: 'LED & Lighting' };
    }
    if (lower.includes('mcb') || lower.includes('breaker') || lower.includes('switchgear') || lower.includes('db') || lower.includes('rccb') || lower.includes('elcb') || lower.includes('isolator')) {
      return { category: 'MCB & Switchgear' };
    }
    if (lower.includes('pipe') || lower.includes('conduit') || lower.includes('casing') || lower.includes('bend') || lower.includes('pvc') || lower.includes('fitting')) {
      return { category: 'Pipes & Conduits' };
    }
    if (lower.includes('fan') || lower.includes('fixture') || lower.includes('holder') || lower.includes('exhaust') || lower.includes('regulator') || lower.includes('ceiling rose')) {
      return { category: 'Fans & Fixtures' };
    }
    if (lower.includes('tape') || lower.includes('tool') || lower.includes('tester') || lower.includes('screw') || lower.includes('accessory') || lower.includes('hardware')) {
      return { category: 'Accessories & Tools' };
    }

    // Preserve user's custom category name
    return { category: raw };
  }

  // Infer from product name if category was empty
  if (pName.includes('wire') || pName.includes('cable') || pName.includes('copper') || pName.includes('sq mm')) {
    return { category: 'Wires & Cables' };
  }
  if (pName.includes('switch') || pName.includes('socket') || pName.includes('plate') || pName.includes('gang box')) {
    return { category: 'Switches & Sockets' };
  }
  if (pName.includes('led') || pName.includes('bulb') || pName.includes('tube') || pName.includes('batten') || pName.includes('light')) {
    return { category: 'LED & Lighting' };
  }
  if (pName.includes('mcb') || pName.includes('isolator') || pName.includes('rccb') || pName.includes('breaker')) {
    return { category: 'MCB & Switchgear' };
  }
  if (pName.includes('pipe') || pName.includes('conduit') || pName.includes('casing') || pName.includes('pvc')) {
    return { category: 'Pipes & Conduits' };
  }
  if (pName.includes('fan') || pName.includes('regulator') || pName.includes('exhaust')) {
    return { category: 'Fans & Fixtures' };
  }
  if (pName.includes('tape') || pName.includes('tester') || pName.includes('holder')) {
    return { category: 'Accessories & Tools' };
  }

  return {
    category: ELECTRICAL_CATEGORIES[1] || 'Switches & Sockets',
    warning: 'Category was empty, defaulted to Switches & Sockets',
  };
}

/**
 * Normalizes product unit
 */
function normalizeUnit(unitStr: string | undefined): string {
  if (!unitStr) return 'pcs';
  const u = unitStr.toLowerCase().trim();
  if (['pcs', 'pc', 'piece', 'pieces', 'nos', 'no', 'unit', 'units', 'each', 'ea'].includes(u)) return 'pcs';
  if (['coil', 'coils', 'bundle', 'bundles', 'roll', 'rolls'].includes(u)) return 'coil';
  if (['meter', 'meters', 'mtr', 'mtrs', 'm', 'metre', 'metres'].includes(u)) return 'meter';
  if (['box', 'boxes', 'carton', 'cartons', 'pkt', 'pkts', 'pack', 'packet', 'packets'].includes(u)) return 'box';
  if (['set', 'sets', 'pair', 'pairs'].includes(u)) return 'set';
  if (['kg', 'kgs', 'kilogram'].includes(u)) return 'kg';
  if (['ft', 'feet', 'foot'].includes(u)) return 'ft';
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

  // 1. Detect the true header row (skipping metadata/title lines if present)
  let headerRowIndex = 0;
  let maxMatchedCols = 0;
  const columnMap: Record<number, string> = {};

  for (let r = 0; r < Math.min(tokenized.length, 15); r++) {
    const candidateRow = tokenized[r];
    let matchedCount = 0;
    candidateRow.forEach((cell) => {
      if (matchColumnHeader(cell)) {
        matchedCount++;
      }
    });
    if (matchedCount > maxMatchedCols) {
      maxMatchedCols = matchedCount;
      headerRowIndex = r;
    }
  }

  // If a header row with matches was found, build column map
  if (maxMatchedCols > 0) {
    const headerRow = tokenized[headerRowIndex];
    headerRow.forEach((h, index) => {
      const matched = matchColumnHeader(h);
      if (matched) {
        columnMap[index] = matched;
      }
    });
  } else {
    // If no header matches, assume standard template positional columns
    // [Name, Category, Selling Price, Cost Price, Stock, Min Stock, Unit, GST, HSN, SKU, Supplier]
    columnMap[0] = 'name';
    columnMap[1] = 'category';
    columnMap[2] = 'sellingPrice';
    columnMap[3] = 'purchasePrice';
    columnMap[4] = 'stockQty';
    columnMap[5] = 'minimumStock';
    columnMap[6] = 'unit';
    columnMap[7] = 'gstRate';
    columnMap[8] = 'hsnCode';
    columnMap[9] = 'skuCode';
    columnMap[10] = 'supplier';
    headerRowIndex = -1; // Treat row 0 as data
  }

  const parsedRows: ParsedCsvProductRow[] = [];
  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  let matchCount = 0;

  // Process data rows
  const startRow = headerRowIndex + 1;
  for (let r = startRow; r < tokenized.length; r++) {
    const rowCells = tokenized[r];

    // Skip empty or blank lines
    const hasAnyContent = rowCells.some((c) => c && c.trim().length > 0);
    if (!hasAnyContent) {
      continue;
    }

    const rawData: Record<string, string> = {};
    rowCells.forEach((cell, idx) => {
      const fieldName = columnMap[idx] || `col_${idx}`;
      rawData[fieldName] = cell;
    });

    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Extract Name
    let rawName = rawData['name']?.trim() || '';
    const rawSku = rawData['skuCode']?.trim() || '';

    // If name is missing, attempt recovery from SKU or other columns
    if (!rawName) {
      if (rawSku) {
        rawName = `Product ${rawSku}`;
        warnings.push(`Item Name was missing; generated from SKU "${rawSku}"`);
      } else {
        // Check if any other unmapped column has text
        const alternativeTextCol = Object.entries(rawData).find(
          ([k, v]) => k.startsWith('col_') && v && v.trim().length > 2 && isNaN(Number(v))
        );
        if (alternativeTextCol) {
          rawName = alternativeTextCol[1].trim();
          warnings.push(`Item Name recovered from column "${alternativeTextCol[0]}"`);
        } else {
          // If row has some pricing or stock data, give it a placeholder instead of fatal error
          const hasAnyData = Object.values(rawData).some((v) => parseNumber(v) !== null);
          if (hasAnyData) {
            rawName = `Electrical Item (Row ${r + 1})`;
            warnings.push('Item Name was missing; defaulted to placeholder. Please rename in product edit.');
          } else {
            // Truly blank row
            continue;
          }
        }
      }
    }

    // 2. Selling Price & Cost Price
    const parsedSelling = parseNumber(rawData['sellingPrice']);
    const parsedCost = parseNumber(rawData['purchasePrice']);

    let sellingPrice = 0;
    let purchasePrice = 0;

    if (parsedSelling !== null && parsedSelling >= 0) {
      sellingPrice = parsedSelling;
    }

    if (parsedCost !== null && parsedCost >= 0) {
      purchasePrice = parsedCost;
    }

    // Smart pricing fallbacks (No unnecessary blocking errors!)
    if (sellingPrice === 0) {
      if (purchasePrice > 0) {
        // Derive selling price at 25% markup
        sellingPrice = Math.round(purchasePrice * 1.25);
        warnings.push(`Selling Price missing, calculated as ₹${sellingPrice} (Cost + 25%)`);
      } else {
        warnings.push('Selling Price set to ₹0. Please update selling rate before billing.');
      }
    } else if (purchasePrice === 0) {
      // Estimate cost at 75% of selling price
      purchasePrice = Math.round(sellingPrice * 0.75);
    }

    if (purchasePrice > sellingPrice && sellingPrice > 0) {
      warnings.push(`Cost Price (₹${purchasePrice}) is higher than Selling Price (₹${sellingPrice})`);
    }

    // 3. Category
    let { category, warning: catWarn } = normalizeCategory(rawData['category'], rawName);
    if (catWarn) warnings.push(catWarn);

    // 4. Stock Quantity
    let stockQty = 0;
    const parsedStock = parseNumber(rawData['stockQty']);
    if (parsedStock !== null) {
      stockQty = Math.max(0, parsedStock);
    }

    // 5. Minimum Stock Threshold
    let minimumStock = 10;
    const parsedMin = parseNumber(rawData['minimumStock']);
    if (parsedMin !== null && parsedMin >= 0) {
      minimumStock = parsedMin;
    }

    // 6. Unit
    let unit = normalizeUnit(rawData['unit']);

    // 7. GST Rate
    let gstRate = 18;
    const parsedGst = parseNumber(rawData['gstRate']);
    if (parsedGst !== null) {
      if (parsedGst > 0 && parsedGst <= 1) {
        // Decimal percentage format like 0.18 -> 18%
        gstRate = Math.round(parsedGst * 100);
      } else if (parsedGst >= 0 && parsedGst <= 100) {
        gstRate = parsedGst;
      } else {
        warnings.push(`Invalid GST Rate "${rawData['gstRate']}", defaulted to 18%`);
      }
    }

    // 8. HSN Code
    let hsnCode = rawData['hsnCode']?.trim();
    if (!hsnCode) {
      if (category === 'Wires & Cables') hsnCode = '8544';
      else if (category === 'LED & Lighting') hsnCode = '8539';
      else if (category === 'Pipes & Conduits') hsnCode = '3917';
      else if (category === 'Fans & Fixtures') hsnCode = '8414';
      else hsnCode = '8536';
    }

    // 9. SKU Code
    const skuCode = rawSku || undefined;

    // 10. Supplier Matching
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

    // 11. Match against existing products by SKU or Name
    let matchedExistingProduct: Product | undefined = undefined;
    if (skuCode) {
      const skuClean = skuCode.trim().toLowerCase();
      matchedExistingProduct = existingProducts.find(
        (p) => p.skuCode && p.skuCode.trim().toLowerCase() === skuClean
      );
    }
    if (!matchedExistingProduct && rawName) {
      const nameClean = rawName.trim().toLowerCase();
      matchedExistingProduct = existingProducts.find(
        (p) => p.name && p.name.trim().toLowerCase() === nameClean
      );
    }
    if (!matchedExistingProduct && rawName) {
      const normRaw = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normRaw.length >= 3) {
        matchedExistingProduct = existingProducts.find(
          (p) => p.name && p.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normRaw
        );
      }
    }

    const isExistingMatch = Boolean(matchedExistingProduct);
    if (isExistingMatch && matchedExistingProduct) {
      matchCount++;
      // If price was missing in CSV, inherit existing product's price
      if (sellingPrice === 0 && matchedExistingProduct.sellingPrice > 0) {
        sellingPrice = matchedExistingProduct.sellingPrice;
      }
      if (purchasePrice === 0 && matchedExistingProduct.purchasePrice > 0) {
        purchasePrice = matchedExistingProduct.purchasePrice;
      }
      if ((!rawData['category'] || !rawData['category'].trim()) && matchedExistingProduct.category) {
        category = matchedExistingProduct.category;
      }
      if ((!rawData['unit'] || !rawData['unit'].trim()) && matchedExistingProduct.unit) {
        unit = matchedExistingProduct.unit;
      }
      if (!rawData['hsnCode'] && matchedExistingProduct.hsnCode) {
        hsnCode = matchedExistingProduct.hsnCode;
      }
      warnings.push(`Matches existing product: "${matchedExistingProduct.name}"`);
    }

    const status: 'valid' | 'warning' | 'error' =
      errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid';

    if (status === 'error') {
      errorCount++;
    } else if (status === 'warning') {
      warningCount++;
      validCount++;
    } else {
      validCount++;
    }

    const product: Product = {
      productId: matchedExistingProduct ? matchedExistingProduct.productId : `prod-${Date.now()}-${r}`,
      name: rawName,
      category,
      skuCode,
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
      rowNumber: r + 1,
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
