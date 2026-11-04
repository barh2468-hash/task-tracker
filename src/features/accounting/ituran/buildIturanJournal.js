import { ITURAN_REMARK, ITURAN_SUPPLIER_ACCOUNT_TYPE, ITURAN_SUPPLIER_CARD } from '../fuel/fuelConfig.js';
import { buildTollJournal } from '../tolls/buildTollJournal.js';

/**
 * Ituran journals use the same split as the toll invoices (general vehicles carry
 * 2/3 of the VAT, trucks alone with full VAT, general-vehicle card split over the
 * vehicles with the last one taking the balance). Differences: supplier card 5931,
 * remark "חשבונית איתורן", reference 2 = the printed invoice number (filled automatically,
 * reference 1 is left empty).
 */
export function buildIturanJournal(invoice, cardFor) {
  return buildTollJournal(invoice, cardFor, {
    kind: 'ituran',
    supplierName: 'איתוראן — ספק',
    supplierCard: ITURAN_SUPPLIER_CARD,
    supplierType: ITURAN_SUPPLIER_ACCOUNT_TYPE,
    remark: () => ITURAN_REMARK,
    refs: ({ invoiceNumber }) => ({ ref1: '', ref2: invoiceNumber, ref3: '' }),
    extraChecks: () => [],
  });
}
