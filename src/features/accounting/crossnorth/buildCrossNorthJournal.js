import { CROSS_NORTH_REMARK, CROSS_NORTH_SUPPLIER_ACCOUNT_TYPE, CROSS_NORTH_SUPPLIER_CARD } from '../fuel/fuelConfig.js';
import { buildTollJournal } from '../tolls/buildTollJournal.js';

/**
 * Cross-North (חוצה צפון) journals follow the Ituran / Carmel process exactly: same VAT/truck/vehicle
 * split as the Road 6 tolls, reference 2 = the printed invoice number (reference 1 and 3 stay empty).
 */
export function buildCrossNorthJournal(invoice, cardFor) {
  return buildTollJournal(invoice, cardFor, {
    kind: 'crossnorth',
    supplierName: 'חוצה צפון — ספק',
    supplierCard: CROSS_NORTH_SUPPLIER_CARD,
    supplierType: CROSS_NORTH_SUPPLIER_ACCOUNT_TYPE,
    remark: () => CROSS_NORTH_REMARK,
    refs: ({ invoiceNumber }) => ({ ref1: '', ref2: invoiceNumber, ref3: '' }),
    extraChecks: () => [],
  });
}
