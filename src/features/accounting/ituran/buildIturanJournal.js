import { ITURAN_REMARK, ITURAN_SUPPLIER_ACCOUNT_TYPE, ITURAN_SUPPLIER_CARD } from '../fuel/fuelConfig.js';
import { buildTollJournal } from '../tolls/buildTollJournal.js';

/**
 * Ituran journals use the same split as the toll invoices (general vehicles carry
 * 2/3 of the VAT, trucks alone with full VAT, general-vehicle card split over the
 * vehicles with the last one taking the balance). Differences: supplier card 5931,
 * remark "חשבונית איתורן", reference 1 = the printed invoice number and
 * reference 2 = the invoice number in SAP (typed in by accounting).
 */
export function buildIturanJournal(invoice, cardFor, sapInvoiceNumber) {
  const sap = (sapInvoiceNumber || '').trim();
  return buildTollJournal(invoice, cardFor, {
    kind: 'ituran',
    supplierName: 'איתוראן — ספק',
    supplierCard: ITURAN_SUPPLIER_CARD,
    supplierType: ITURAN_SUPPLIER_ACCOUNT_TYPE,
    remark: () => ITURAN_REMARK,
    refs: ({ invoiceNumber }) => ({ ref1: invoiceNumber, ref2: sap, ref3: '' }),
    extraChecks: () => [{ ok: sap !== '', label: sap ? `אסמכתא 2 = מספר החשבונית בסאפ (${sap})` : 'יש להזין את מספר החשבונית בסאפ (אסמכתא 2)' }],
  });
}
