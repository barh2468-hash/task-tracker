import { CARMEL_REMARK, CARMEL_SUPPLIER_ACCOUNT_TYPE, CARMEL_SUPPLIER_CARD } from '../fuel/fuelConfig.js';
import { buildTollJournal } from '../tolls/buildTollJournal.js';

/**
 * Carmel Tunnels journals follow the Ituran process exactly: same VAT/truck/vehicle
 * split as the Road 6 tolls, reference 1 = the printed invoice number and
 * reference 2 = the invoice number in SAP (typed in by accounting).
 */
export function buildCarmelJournal(invoice, cardFor, sapInvoiceNumber) {
  const sap = (sapInvoiceNumber || '').trim();
  return buildTollJournal(invoice, cardFor, {
    kind: 'carmel',
    supplierName: 'מנהרות הכרמל — ספק',
    supplierCard: CARMEL_SUPPLIER_CARD,
    supplierType: CARMEL_SUPPLIER_ACCOUNT_TYPE,
    remark: () => CARMEL_REMARK,
    refs: ({ invoiceNumber }) => ({ ref1: invoiceNumber, ref2: sap, ref3: '' }),
    extraChecks: () => [
      { ok: CARMEL_SUPPLIER_CARD !== '', label: CARMEL_SUPPLIER_CARD ? `כרטיס ספק ${CARMEL_SUPPLIER_CARD}` : 'לא הוגדר כרטיס ספק למנהרות הכרמל' },
      { ok: sap !== '', label: sap ? `אסמכתא 2 = מספר החשבונית בסאפ (${sap})` : 'יש להזין את מספר החשבונית בסאפ (אסמכתא 2)' },
    ],
  });
}
