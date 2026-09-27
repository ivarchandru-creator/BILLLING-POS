import { Product, Supplier, SupplierTransaction, Invoice, ShopSettings, StockTransaction, Customer } from '../types';

export const ELECTRICAL_CATEGORIES = [
  'All Items',
  'Switches & Sockets',
  'Wires & Cables',
  'LED & Lighting',
  'MCB & Switchgear',
  'Pipes & Conduits',
  'Fans & Fixtures',
  'Accessories & Tools',
];

export const INITIAL_SHOP_SETTINGS: ShopSettings = {
  shopName: 'Sri Senthur Velan Electricals and Pipes',
  tagline: 'Your trusted electrical partner',
  ownerName: 'Tpk Chandru',
  phone: '98450 12345',
  alternatePhone: '94430 67890',
  email: '',
  address: 'No. 42, Cross Cut Road, Gandhipuram',
  city: 'Coimbatore',
  state: 'Tamil Nadu',
  pincode: '641012',
  gstin: '33ABCDE1234F1Z5',
  defaultPrinterType: 'ink',
  thermalPaperWidth: '80mm',
  defaultGstOn: false,
  defaultGstRate: 18,
  footerMessage: 'Thank you for shopping with Sri Senthur Velan Electricals and Pipes! Goods once sold can be exchanged within 7 days.',
  termsAndConditions: '1. Manufacturer warranty applies. 2. Cash memos must be presented for returns. 3. Subject to local jurisdiction.',
  currentUserRole: 'admin',
  currentUserName: 'Tpk Chandru',
};

// Clean initial data - zero mock data
export const INITIAL_CUSTOMERS: Customer[] = [];
export const INITIAL_SUPPLIERS: Supplier[] = [];
export const INITIAL_SUPPLIER_TRANSACTIONS: SupplierTransaction[] = [];
export const INITIAL_PRODUCTS: Product[] = [];
export const INITIAL_STOCK_TRANSACTIONS: StockTransaction[] = [];
export const INITIAL_INVOICES: Invoice[] = [];
