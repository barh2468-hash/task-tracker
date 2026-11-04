import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMessage } from '../context/MessageContext.jsx';
import { useAuth } from '../features/auth/useAuth.js';
import { t } from '../features/language/LanguageContext.jsx';
import {
  getPaymentDevices,
  insertPaymentDevice,
  updatePaymentDevice,
  insertPaymentDeviceUpdates,
} from '../services/api/paymentDevices.js';
import { currentMonth, formatMonth, projectDevice } from '../features/accounting/payments/paymentSchedule.js';
import { exportPaymentsWorkbook } from '../features/accounting/payments/exportPaymentsWorkbook.js';

const EMPTY_FORM = {
  device_label: '',
  invoice_no: '',
  purchase_month: '',
  monthly_payment: '',
  total_payments: '',
  base_month: '',
  base_payment_no: '',
  notes: '',
};

function formatIls(value) {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(Number(value) || 0);
}

export default function AccountingPaymentsPage() {
  useTranslation();
  const { setMessage } = useMessage();
  const { profile } = useAuth();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(currentMonth());
  const [selected, setSelected] = useState(() => new Set());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function addDevice(event) {
    event.preventDefault();
    const total = Number(form.total_payments);
    const baseNo = Number(form.base_payment_no);
    if (!form.device_label.trim() || !form.base_month || !(total > 0) || baseNo < 0 || baseNo > total) {
      setMessage(t('נא למלא מכשיר, חודש בסיס, מספר תשלום בסיסי וסה״כ תשלומים תקינים.'));
      return;
    }
    setSaving(true);
    const baseMonth = `${form.base_month}-01`;
    const { error } = await insertPaymentDevice({
      device_label: form.device_label.trim(),
      invoice_no: form.invoice_no.trim() || null,
      purchase_month: form.purchase_month ? `${form.purchase_month}-01` : null,
      monthly_payment: Number(form.monthly_payment) || 0,
      total_payments: total,
      base_month: baseMonth,
      base_payment_no: baseNo,
      due_month: baseMonth,
      payment_no: baseNo,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(t('המכשיר נוסף'));
    setForm(EMPTY_FORM);
    setShowForm(false);
    load();
  }

  async function exportExcel() {
    try {
      await exportPaymentsWorkbook(devices.filter((d) => d.status === 'active'));
    } catch (exportError) {
      setMessage(exportError.message || t('ייצוא קובץ ה־Excel נכשל.'));
    }
  }

  const load = useCallback(async () => {
    const { data, error } = await getPaymentDevices();
    if (error) setMessage(error.message);
    else setDevices(data || []);
    setLoading(false);
  }, [setMessage]);

  useEffect(() => {
    load();
  }, [load]);

  const active = useMemo(() => devices.filter((d) => d.status === 'active'), [devices]);
  const projections = useMemo(
    () => new Map(active.map((d) => [d.id, projectDevice(d, month)])),
    [active, month],
  );

  // Row values: selected rows preview the chosen month, others show the saved state.
  const rows = useMemo(
    () =>
      active.map((d) => {
        const isSel = selected.has(d.id);
        const p = projections.get(d.id);
        const saved = projectDevice(d, d.due_month);
        return {
          device: d,
          isSel,
          p,
          dueMonth: isSel ? p.due_month : d.due_month,
          paymentNo: isSel ? p.payment_no : d.payment_no,
          balance: isSel ? p.balance : saved.balance,
        };
      }),
    [active, selected, projections],
  );

  const totals = useMemo(
    () => ({
      monthly: rows.reduce((sum, r) => sum + Number(r.device.monthly_payment), 0),
      balance: rows.reduce((sum, r) => sum + r.balance, 0),
    }),
    [rows],
  );

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === active.length ? new Set() : new Set(active.map((d) => d.id))));
  }

  async function apply() {
    const chosen = active.filter((d) => selected.has(d.id));
    if (!chosen.length) return;
    setSaving(true);
    const logRows = [];
    for (const d of chosen) {
      const p = projections.get(d.id);
      const { error } = await updatePaymentDevice(d.id, {
        due_month: p.due_month,
        payment_no: p.payment_no,
        status: p.finished ? 'closed' : 'active',
      });
      if (error) {
        setMessage(error.message);
        setSaving(false);
        return;
      }
      logRows.push({
        device_id: d.id,
        month: p.due_month,
        payment_no: p.payment_no,
        balance: p.balance,
        updated_by: profile?.id || null,
      });
    }
    await insertPaymentDeviceUpdates(logRows);
    const finished = chosen.filter((d) => projections.get(d.id).finished);
    const base = `${t('עודכנו')} ${chosen.length} ${t('מכשירים')}`;
    setMessage(
      finished.length
        ? `${base}. ${t('הסתיימו — לעדכן את יוסי')}: ${finished.map((d) => d.device_label).join(', ')}`
        : base,
    );
    setSelected(new Set());
    setSaving(false);
    load();
  }

  if (loading) return <p>{t('טוען...')}</p>;

  return (
    <section className="accountingPage">
      <h2>{t('מעקב תשלומים — טכנולוגיות תפיסה מרחבית')}</h2>
      <p>{t('בחרי חודש וסמני את המכשירים לעדכון. מספר התשלום והיתרה מחושבים אוטומטית.')}</p>

      <div className="accountingToolbar">
        <label>
          {t('חודש לעדכון')}{' '}
          <input
            type="month"
            value={month.slice(0, 7)}
            onChange={(event) => event.target.value && setMonth(`${event.target.value}-01`)}
          />
        </label>
        <button onClick={apply} disabled={saving || !selected.size}>
          {t('עדכון מכשירים מסומנים')} ({selected.size})
        </button>
        <button className="secondary" onClick={() => setShowForm((v) => !v)}>
          {t('הוספת מכשיר')}
        </button>
        <button className="secondary" onClick={exportExcel} disabled={!active.length}>
          {t('ייצוא ל-Excel')}
        </button>
      </div>

      {showForm && (
        <form className="accountingToolbar" onSubmit={addDevice}>
          <input placeholder={t('מכשיר')} value={form.device_label} onChange={(e) => setField('device_label', e.target.value)} />
          <input placeholder={t('מס׳ חשבונית')} value={form.invoice_no} onChange={(e) => setField('invoice_no', e.target.value)} />
          <label>
            {t('תאריך קנייה')}{' '}
            <input type="month" value={form.purchase_month} onChange={(e) => setField('purchase_month', e.target.value)} />
          </label>
          <input type="number" min="0" step="0.01" placeholder={t('תשלום חודשי')} value={form.monthly_payment} onChange={(e) => setField('monthly_payment', e.target.value)} />
          <input type="number" min="1" placeholder={t('סה״כ תשלומים')} value={form.total_payments} onChange={(e) => setField('total_payments', e.target.value)} />
          <label>
            {t('חודש חיוב בסיסי')}{' '}
            <input type="month" value={form.base_month} onChange={(e) => setField('base_month', e.target.value)} />
          </label>
          <input type="number" min="0" placeholder={t('מספר תשלום בסיסי')} value={form.base_payment_no} onChange={(e) => setField('base_payment_no', e.target.value)} />
          <input placeholder={t('הערות')} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
          <button type="submit" disabled={saving}>{t('שמירה')}</button>
        </form>
      )}

      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={active.length > 0 && selected.size === active.length}
                  onChange={toggleAll}
                />
              </th>
              <th>{t('מכשיר')}</th>
              <th>{t('מס׳ חשבונית')}</th>
              <th>{t('תשלום חודשי')}</th>
              <th>{t('ת.פרעון')}</th>
              <th>{t('מספר תשלום')}</th>
              <th>{t('יתרה לתשלום')}</th>
              <th>{t('הערות')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ device: d, isSel, p, dueMonth, paymentNo, balance }) => (
              <tr key={d.id}>
                <td>
                  <input type="checkbox" checked={isSel} onChange={() => toggle(d.id)} />
                </td>
                <td>{d.device_label}</td>
                <td>{d.invoice_no}</td>
                <td>{formatIls(d.monthly_payment)}</td>
                <td>{formatMonth(dueMonth)}</td>
                <td>
                  {paymentNo}/{d.total_payments}
                  {isSel && p.finished && <strong> — {t('אחרון, לעדכן את יוסי')}</strong>}
                  {isSel && p.overrun && <strong> — {t('חריגה מסה״כ התשלומים')}</strong>}
                </td>
                <td>{formatIls(balance)}</td>
                <td>{d.notes}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>{t('סה״כ')}</td>
              <td>{formatIls(totals.monthly)}</td>
              <td colSpan={2}></td>
              <td>{formatIls(totals.balance)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
