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
 * Paginates invoice items for A4 Ink printing:
 * - Single-page limit: <= 10 items (fits full store header, customer box, table, totals, terms, and signature)
 * - Multi-page:
 *   - Page 1: Full header + Customer Box -> fits up to 12 items
 *   - Middle Pages: Condensed header -> fits up to 16 items
 *   - Final (Last) Page: Condensed header + Totals & Footers -> fits up to 10 items
 */
export function paginateInvoiceItems(items: InvoiceItem[]): InvoicePageData[] {
  const total = items.length;

  if (total <= 10) {
    const subtotal = items.reduce((sum, it) => sum + it.lineTotal, 0);
    return [
      {
        pageIndex: 0,
        pageNumber: 1,
        totalPages: 1,
        isFirstPage: true,
        isLastPage: true,
        items: items.map((item, i) => ({ item, originalIndex: i })),
        pageSubtotal: subtotal,
        runningSubtotal: subtotal,
      },
    ];
  }

  const indexed: IndexedInvoiceItem[] = items.map((item, idx) => ({
    item,
    originalIndex: idx,
  }));

  const pagesGroups: IndexedInvoiceItem[][] = [];

  if (total <= 22) {
    // 2 pages split: ensure last page has <= 10 items
    const page2Count = Math.min(10, Math.floor(total / 2));
    const page1Count = total - page2Count;
    pagesGroups.push(indexed.slice(0, page1Count));
    pagesGroups.push(indexed.slice(page1Count));
  } else {
    // 3 or more pages:
    // Page 1 takes 12 items
    pagesGroups.push(indexed.slice(0, 12));
    let remainder = indexed.slice(12);

    while (remainder.length > 0) {
      if (remainder.length <= 10) {
        // Fits comfortably on last page alongside Totals & Footer
        pagesGroups.push(remainder);
        break;
      } else if (remainder.length <= 20) {
        // Split into 1 middle page and 1 final page
        const lastCount = Math.min(10, Math.floor(remainder.length / 2));
        const midCount = remainder.length - lastCount;
        pagesGroups.push(remainder.slice(0, midCount));
        pagesGroups.push(remainder.slice(midCount));
        break;
      } else {
        // Middle page takes 14 items
        pagesGroups.push(remainder.slice(0, 14));
        remainder = remainder.slice(14);
      }
    }
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
