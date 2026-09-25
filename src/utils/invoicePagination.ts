import { InvoiceItem } from '../types';

export interface IndexedInvoiceItem {
  item: InvoiceItem;
  originalIndex: number;
}

export interface InvoicePageData {
  pageIndex: number;
  pageNumber: number;
  totalPages: number;
  isFirstPage: boolean;
  isLastPage: boolean;
  items: IndexedInvoiceItem[];
  pageSubtotal: number;
  runningSubtotal: number;
}

/**
 * Paginates invoice items for printing:
 * - A5 bill: maximum 15 products per page
 * - A4 bill: maximum 25 products per page
 * - Splits into multiple pages when total items exceed maxPerPage
 * - Totals and summary are displayed strictly on the final page
 */
export function paginateInvoiceItems(items: InvoiceItem[], maxPerPage: number = 25): InvoicePageData[] {
  const total = items.length;

  if (total === 0) {
    return [
      {
        pageIndex: 0,
        pageNumber: 1,
        totalPages: 1,
        isFirstPage: true,
        isLastPage: true,
        items: [],
        pageSubtotal: 0,
        runningSubtotal: 0,
      },
    ];
  }

  const indexed: IndexedInvoiceItem[] = items.map((item, idx) => ({
    item,
    originalIndex: idx,
  }));

  const pagesGroups: IndexedInvoiceItem[][] = [];
  for (let i = 0; i < total; i += maxPerPage) {
    pagesGroups.push(indexed.slice(i, i + maxPerPage));
  }

  const totalPages = pagesGroups.length;
  let running = 0;

  return pagesGroups.map((group, idx) => {
    const pageSubtotal = group.reduce((sum, it) => sum + it.item.lineTotal, 0);
    running += pageSubtotal;
    return {
      pageIndex: idx,
      pageNumber: idx + 1,
      totalPages,
      isFirstPage: idx === 0,
      isLastPage: idx === totalPages - 1,
      items: group,
      pageSubtotal,
      runningSubtotal: running,
    };
  });
}
