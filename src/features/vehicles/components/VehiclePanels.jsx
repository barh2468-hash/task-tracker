import { useRef, useState } from 'react';
import { Download, Plus, Trash2, Upload } from 'lucide-react';
import { t } from '../../language/LanguageContext.jsx';
import { useMessage } from '../../../context/MessageContext.jsx';
import Button from '../../../components/ui/Button.jsx';
import Field from '../../../components/ui/Field.jsx';
import Card from '../../../components/ui/Card.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import ExpiryPill from './ExpiryPill.jsx';
import { DOCUMENT_TYPES, INSURANCE_KINDS, TOLL_KINDS } from '../constants.js';
import { currentMonthString, expiryLevel, formatDate, todayString } from '../utils/vehicleStatus.js';
import ScanUploader from './ScanUploader.jsx';
import {
  addInspection,
  attachScanDocument,
  addInsurancePolicy,
  getDocumentUrl,
  removeInspection,
  removeInsurancePolicy,
  removeOdometerReading,
  removeTollSubscription,
  removeVehicleDocument,
  saveOdometerReading,
  saveTollSubscription,
  uploadVehicleDocument,
} from '../api.js';

/** Runs a mutation, then refreshes the page data; failures surface as an error toast. */
function useMutation(onChanged) {
  const { setMessage } = useMessage();
  const [busy, setBusy] = useState(false);
  async function run(action, successText) {
    setBusy(true);
    try {
      await action();
      if (successText) setMessage(successText);
      await onChanged();
      return true;
    } catch (error) {
      setMessage(error?.message || t('הפעולה נכשלה.'), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

const confirmDelete = () => window.confirm(t('למחוק את הרשומה?'));

const digitsOf = (plate) => String(plate ?? '').replace(/\D/g, '');

/** Hint shown when the scanned document names a different plate than this vehicle's. */
function plateMismatch(vehicle, fields) {
  return fields?.plate_number && digitsOf(fields.plate_number) !== digitsOf(vehicle.plate_number)
    ? `${t('בסריקה מופיע רכב')} ${fields.plate_number}, ${t('שונה מרכב זה')} (${vehicle.plate_number}). ${t('יש לוודא שזה המסמך הנכון.')}`
    : '';
}

function DeleteButton({ onClick, disabled }) {
  return (
    <Button variant="ghost" size="sm" className="iconOnly" aria-label={t('מחיקה')} disabled={disabled} onClick={onClick}>
      <Trash2 size={15} />
    </Button>
  );
}

function Table({ headers, children }) {
  return (
    <div className="equipmentTableWrap">
      <table className="equipmentTable">
        <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}<th /></tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------- insurance
const EMPTY_POLICY = { kind: 'comprehensive', insurer: '', agent: '', policy_number: '', valid_from: '', valid_to: '' };

export function InsurancePanel({ vehicle, policies, canEdit, userId, onChanged }) {
  const { busy, run } = useMutation(onChanged);
  const [form, setForm] = useState({ ...EMPTY_POLICY, agent: vehicle.insurance_agent || '' });
  const [scan, setScan] = useState(null);
  const [warning, setWarning] = useState('');
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  function applyScan({ scan: uploaded, fields }) {
    setScan(uploaded);
    if (!fields) return;
    setWarning(plateMismatch(vehicle, fields));
    setForm((current) => ({
      ...current,
      kind: fields.kind || current.kind,
      insurer: fields.insurer ?? current.insurer,
      agent: fields.agent ?? current.agent,
      policy_number: fields.policy_number ?? current.policy_number,
      valid_from: fields.valid_from ?? current.valid_from,
      valid_to: fields.valid_to ?? current.valid_to,
    }));
  }

  async function submit(event) {
    event.preventDefault();
    const ok = await run(async () => {
      let documentId = null;
      if (scan) {
        const docType = form.kind === 'mandatory' ? 'insurance_mandatory' : 'insurance_comprehensive';
        documentId = (await attachScanDocument(vehicle.id, scan, docType, userId, form.valid_to)).id;
      }
      await addInsurancePolicy(
        vehicle.id,
        { ...form, valid_from: form.valid_from || null, document_id: documentId, source: scan ? 'ai' : 'manual' },
        userId,
      );
    }, t('הפוליסה נוספה.'));
    if (ok) {
      setForm({ ...EMPTY_POLICY, agent: vehicle.insurance_agent || '' });
      setScan(null);
      setWarning('');
    }
  }

  return (
    <Card>
      {policies.length === 0 ? (
        <EmptyState title={t('לא הוזנו פוליסות לרכב זה')} />
      ) : (
        <Table headers={[t('סוג'), t('חברה'), t('סוכן'), t('מס׳ פוליסה'), t('מתאריך'), t('עד')]}>
          {policies.map((policy) => (
            <tr key={policy.id}>
              <td>{t(INSURANCE_KINDS[policy.kind])}</td>
              <td>{policy.insurer || '—'}</td>
              <td>{policy.agent || '—'}</td>
              <td>{policy.policy_number || '—'}</td>
              <td>{formatDate(policy.valid_from)}</td>
              <td><ExpiryPill level={expiryLevel(policy.valid_to)} validTo={policy.valid_to} /></td>
              <td>{canEdit && <DeleteButton disabled={busy} onClick={() => confirmDelete() && run(() => removeInsurancePolicy(policy.id))} />}</td>
            </tr>
          ))}
        </Table>
      )}
      {canEdit && (
        <form className="form formGrid" onSubmit={submit}>
          <ScanUploader kind="policy" onResult={applyScan} onDiscard={() => { setScan(null); setWarning(''); }} label={t('מילוי מפוליסה סרוקה')} />
          {warning && <p className="muted" role="status">{warning}</p>}
          <Field label={t('סוג')}>
            <select value={form.kind} onChange={set('kind')}>
              {Object.entries(INSURANCE_KINDS).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
            </select>
          </Field>
          <Field label={t('חברת ביטוח')}><input value={form.insurer} onChange={set('insurer')} /></Field>
          <Field label={t('סוכן')}><input value={form.agent} onChange={set('agent')} /></Field>
          <Field label={t('מספר פוליסה')}><input value={form.policy_number} onChange={set('policy_number')} /></Field>
          <Field label={t('תחילת תוקף')}><input type="date" value={form.valid_from} onChange={set('valid_from')} /></Field>
          <Field label={t('סיום תוקף')}><input type="date" required value={form.valid_to} onChange={set('valid_to')} /></Field>
          <Button type="submit" disabled={busy}><Plus size={16} /> {t('הוספת פוליסה')}</Button>
        </form>
      )}
    </Card>
  );
}

// ----------------------------------------------------------- inspections
const EMPTY_INSPECTION = { inspected_on: '', valid_to: '', station: '', result: '' };

export function InspectionsPanel({ vehicle, inspections, canEdit, userId, onChanged }) {
  const { busy, run } = useMutation(onChanged);
  const [form, setForm] = useState(EMPTY_INSPECTION);
  const [scan, setScan] = useState(null);
  const [warning, setWarning] = useState('');
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  function applyScan({ scan: uploaded, fields }) {
    setScan(uploaded);
    if (!fields) return;
    setWarning(plateMismatch(vehicle, fields));
    setForm((current) => ({
      ...current,
      inspected_on: fields.inspected_on ?? current.inspected_on,
      valid_to: fields.valid_to ?? current.valid_to,
      station: fields.station ?? current.station,
      result: fields.result ?? current.result,
    }));
  }

  async function submit(event) {
    event.preventDefault();
    const ok = await run(async () => {
      let documentId = null;
      if (scan) documentId = (await attachScanDocument(vehicle.id, scan, 'inspection', userId, form.valid_to)).id;
      await addInspection(vehicle.id, { ...form, inspected_on: form.inspected_on || null, document_id: documentId }, userId);
    }, t('הטסט נוסף.'));
    if (ok) {
      setForm(EMPTY_INSPECTION);
      setScan(null);
      setWarning('');
    }
  }

  return (
    <Card>
      {inspections.length === 0 ? (
        <EmptyState title={t('לא הוזן טסט לרכב זה')} />
      ) : (
        <Table headers={[t('תאריך טסט'), t('תחנה'), t('תוצאה'), t('בתוקף עד')]}>
          {inspections.map((inspection) => (
            <tr key={inspection.id}>
              <td>{formatDate(inspection.inspected_on)}</td>
              <td>{inspection.station || '—'}</td>
              <td>{inspection.result || '—'}</td>
              <td><ExpiryPill level={expiryLevel(inspection.valid_to)} validTo={inspection.valid_to} /></td>
              <td>{canEdit && <DeleteButton disabled={busy} onClick={() => confirmDelete() && run(() => removeInspection(inspection.id))} />}</td>
            </tr>
          ))}
        </Table>
      )}
      {canEdit && (
        <form className="form formGrid" onSubmit={submit}>
          <ScanUploader kind="inspection" onResult={applyScan} onDiscard={() => { setScan(null); setWarning(''); }} label={t('מילוי מרישיון / טסט סרוק')} />
          {warning && <p className="muted" role="status">{warning}</p>}
          <Field label={t('תאריך ביצוע')}><input type="date" value={form.inspected_on} onChange={set('inspected_on')} /></Field>
          <Field label={t('בתוקף עד')}><input type="date" required value={form.valid_to} onChange={set('valid_to')} /></Field>
          <Field label={t('תחנת טסט')}><input value={form.station} onChange={set('station')} /></Field>
          <Field label={t('תוצאה / הערה')}><input value={form.result} onChange={set('result')} /></Field>
          <Button type="submit" disabled={busy}><Plus size={16} /> {t('הוספת טסט')}</Button>
        </form>
      )}
    </Card>
  );
}

// ------------------------------------------------------- toll subscriptions
export function TollsPanel({ vehicle, tolls, canEdit, userId, onChanged }) {
  const { busy, run } = useMutation(onChanged);
  const [kind, setKind] = useState('kvish6');
  const [number, setNumber] = useState('');
  const byKind = new Map(tolls.map((toll) => [toll.kind, toll]));

  async function submit(event) {
    event.preventDefault();
    const ok = await run(
      () => saveTollSubscription(vehicle.id, { kind, subscription_number: number.trim(), updated_on: todayString() }, userId),
      t('המנוי נשמר.'),
    );
    if (ok) setNumber('');
  }

  return (
    <Card>
      <Table headers={[t('מנוי'), t('מספר מנוי'), t('עודכן')]}>
        {Object.entries(TOLL_KINDS).map(([value, label]) => {
          const toll = byKind.get(value);
          return (
            <tr key={value}>
              <td>{t(label)}</td>
              <td>{toll ? toll.subscription_number || t('משויך') : <span className="muted">{t('לא משויך')}</span>}</td>
              <td>{toll ? formatDate(toll.updated_on) : '—'}</td>
              <td>{canEdit && toll && <DeleteButton disabled={busy} onClick={() => confirmDelete() && run(() => removeTollSubscription(toll.id))} />}</td>
            </tr>
          );
        })}
      </Table>
      {canEdit && (
        <form className="form formGrid" onSubmit={submit}>
          <Field label={t('מנוי')}>
            <select value={kind} onChange={(event) => setKind(event.target.value)}>
              {Object.entries(TOLL_KINDS).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
            </select>
          </Field>
          <Field label={t('מספר מנוי (אופציונלי)')}>
            <input value={number} onChange={(event) => setNumber(event.target.value)} />
          </Field>
          <Button type="submit" disabled={busy}><Plus size={16} /> {t('שיוך / עדכון מנוי')}</Button>
        </form>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- odometer
export function OdometerPanel({ vehicle, readings, canEdit, userId, onChanged }) {
  const { busy, run } = useMutation(onChanged);
  const [km, setKm] = useState('');
  const month = currentMonthString();
  const highest = readings.reduce((max, reading) => Math.max(max, reading.odometer_km), 0);

  async function submit(event) {
    event.preventDefault();
    const value = Number(km);
    if (value < highest && !window.confirm(t('הקריאה נמוכה מהקריאה הגבוהה ביותר שנרשמה. להמשיך?'))) return;
    const ok = await run(
      () => saveOdometerReading(vehicle.id, { reading_month: month, odometer_km: value, read_on: todayString() }, userId),
      t('הקריאה נשמרה.'),
    );
    if (ok) setKm('');
  }

  return (
    <Card>
      {readings.length === 0 ? (
        <EmptyState title={t('אין קריאות ק"מ')} />
      ) : (
        <Table headers={[t('חודש'), t('ק"מ'), t('תאריך דיווח')]}>
          {readings.map((reading) => (
            <tr key={reading.id}>
              <td>{formatDate(reading.reading_month).slice(3)}</td>
              <td className="num">{reading.odometer_km.toLocaleString('he-IL')}</td>
              <td>{formatDate(reading.read_on)}</td>
              <td>{canEdit && <DeleteButton disabled={busy} onClick={() => confirmDelete() && run(() => removeOdometerReading(reading.id))} />}</td>
            </tr>
          ))}
        </Table>
      )}
      {canEdit && (
        <form className="form formGrid" onSubmit={submit}>
          <Field label={`${t('קריאת ק"מ לחודש הנוכחי')} (${formatDate(month).slice(3)})`}>
            <input type="number" min="0" required value={km} onChange={(event) => setKm(event.target.value)} />
          </Field>
          <Button type="submit" disabled={busy}><Plus size={16} /> {t('שמירת קריאה')}</Button>
        </form>
      )}
    </Card>
  );
}

// ------------------------------------------------------------- assignments
const dateTime = (value) =>
  value ? new Date(value).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export function AssignmentsPanel({ assignments }) {
  return (
    <Card>
      {assignments.length === 0 ? (
        <EmptyState title={t('אין היסטוריית שיוך לרכב זה')} />
      ) : (
        <Table headers={[t('נהג'), t('מתאריך'), t('עד'), t('סוג'), t('ק"מ התחלה'), t('ק"מ סיום')]}>
          {assignments.map((assignment) => (
            <tr key={assignment.id}>
              <td>{assignment.driver_name || '—'}</td>
              <td>{dateTime(assignment.started_at)}</td>
              <td>{assignment.ended_at ? dateTime(assignment.ended_at) : <span className="pill done">{t('מחזיק/ה כעת')}</span>}</td>
              <td>{assignment.assignment_kind === 'temporary' ? t('זמני') : t('קבוע')}</td>
              <td className="num">{assignment.start_odometer?.toLocaleString('he-IL') ?? '—'}</td>
              <td className="num">{assignment.end_odometer?.toLocaleString('he-IL') ?? '—'}</td>
              <td />
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}

// --------------------------------------------------------------- documents
export function DocumentsPanel({ vehicle, documents, canEdit, userId, onChanged }) {
  const { busy, run } = useMutation(onChanged);
  const { setMessage } = useMessage();
  const fileRef = useRef(null);
  const [docType, setDocType] = useState('registration');
  const [validTo, setValidTo] = useState('');

  async function upload(event) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const ok = await run(
      () => uploadVehicleDocument(vehicle.id, file, { docType, validTo }, userId),
      t('המסמך הועלה.'),
    );
    if (ok) {
      fileRef.current.value = '';
      setValidTo('');
    }
  }

  async function open(document) {
    try {
      window.open(await getDocumentUrl(document), '_blank', 'noopener');
    } catch (error) {
      setMessage(error?.message || t('לא ניתן לפתוח את המסמך.'), 'error');
    }
  }

  return (
    <Card>
      {documents.length === 0 ? (
        <EmptyState title={t('לא הועלו מסמכים לרכב זה')} />
      ) : (
        <Table headers={[t('סוג'), t('קובץ'), t('תוקף'), t('הועלה')]}>
          {documents.map((document) => (
            <tr key={document.id}>
              <td>{t(DOCUMENT_TYPES[document.doc_type])}</td>
              <td>{document.original_name}</td>
              <td>{document.valid_to ? <ExpiryPill level={expiryLevel(document.valid_to)} validTo={document.valid_to} /> : '—'}</td>
              <td>{formatDate(document.uploaded_at?.slice(0, 10))}</td>
              <td>
                <Button variant="ghost" size="sm" className="iconOnly" aria-label={t('פתיחה')} onClick={() => open(document)}>
                  <Download size={15} />
                </Button>
                {canEdit && <DeleteButton disabled={busy} onClick={() => confirmDelete() && run(() => removeVehicleDocument(document))} />}
              </td>
            </tr>
          ))}
        </Table>
      )}
      {canEdit && (
        <form className="form formGrid" onSubmit={upload}>
          <Field label={t('סוג מסמך')}>
            <select value={docType} onChange={(event) => setDocType(event.target.value)}>
              {Object.entries(DOCUMENT_TYPES).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
            </select>
          </Field>
          <Field label={t('תוקף (אם רלוונטי)')}>
            <input type="date" value={validTo} onChange={(event) => setValidTo(event.target.value)} />
          </Field>
          <Field label={t('קובץ (PDF / JPG / PNG, עד 10MB)')}>
            <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png" required />
          </Field>
          <Button type="submit" disabled={busy}><Upload size={16} /> {t('העלאה')}</Button>
        </form>
      )}
    </Card>
  );
}
