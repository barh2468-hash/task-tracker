import { useState } from 'react';
import { t } from '../language/LanguageContext.jsx';
import { RESPONSE_OPTIONS, addDays, today } from './model.js';

export function Field({ label, ...props }) {
  return (
    <label>
      {t(label)}
      <input {...props} />
    </label>
  );
}
export function FormActions({ onClose, busy, submitDisabled = false, label = 'quotes.save' }) {
  return (
    <div className="quotesActions">
      <button type="submit" disabled={busy || submitDisabled}>
        {t(label)}
      </button>
      <button type="button" className="secondary" disabled={busy} onClick={onClose}>
        {t('quotes.cancel')}
      </button>
    </div>
  );
}
export function QuoteForm({ quote, clients, onSave, onClose, busy, defaultOwner = '' }) {
  const [form, setForm] = useState(() => ({
    number: '',
    title: '',
    clientId: '',
    sentAt: today(),
    amount: '',
    owner: defaultOwner,
    notes: '',
    ...quote,
  }));
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(form);
      }}
    >
      <div className="quotesFormGrid">
        <Field
          label="quotes.number"
          value={form.number}
          onChange={set('number')}
          required
          maxLength={100}
        />
        <label>
          {t('quotes.client')}
          <select
            aria-label={t('quotes.client')}
            value={form.clientId}
            onChange={set('clientId')}
            required
          >
            <option value="">{t('quotes.chooseClient')}</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="quotes.project"
          value={form.title}
          onChange={set('title')}
          required
          maxLength={500}
        />
        <Field label="quotes.owner" value={form.owner} onChange={set('owner')} maxLength={120} />
        <Field
          label="quotes.sentAt"
          type="date"
          value={form.sentAt}
          onChange={set('sentAt')}
          required
        />
        <Field
          label="quotes.amount"
          type="number"
          min="0"
          step="0.01"
          placeholder={t('quotes.optional')}
          value={form.amount}
          onChange={set('amount')}
        />
      </div>
      <label>
        {t('quotes.notes')}
        <textarea value={form.notes} onChange={set('notes')} maxLength={4000} rows={3} />
      </label>
      <FormActions onClose={onClose} busy={busy} />
    </form>
  );
}
export function ClientForm({ client, onSave, onClose, busy }) {
  const [form, setForm] = useState(() => ({
    name: '',
    contact: '',
    email: '',
    phone: '',
    notes: '',
    optOut: false,
    ...client,
  }));
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(form);
      }}
    >
      <div className="quotesFormGrid">
        <Field
          label="quotes.clientName"
          value={form.name}
          onChange={set('name')}
          required
          maxLength={200}
        />
        <Field
          label="quotes.contact"
          value={form.contact}
          onChange={set('contact')}
          maxLength={200}
        />
        <Field
          label="quotes.email"
          type="email"
          dir="ltr"
          value={form.email}
          onChange={set('email')}
        />
        <Field
          label="quotes.phone"
          type="tel"
          value={form.phone}
          onChange={set('phone')}
          maxLength={60}
        />
      </div>
      <label>
        {t('quotes.notes')}
        <textarea value={form.notes} onChange={set('notes')} rows={3} maxLength={4000} />
      </label>
      <label className="quotesCheck">
        <input
          type="checkbox"
          checked={form.optOut}
          onChange={(event) => setForm((current) => ({ ...current, optOut: event.target.checked }))}
        />
        {t('quotes.optOut')}
      </label>
      <p className="quotesMuted">{t('quotes.optOutHelp')}</p>
      <FormActions onClose={onClose} busy={busy} />
    </form>
  );
}
export function ResponseFields({ form, setForm }) {
  return (
    <>
      <label>
        {t('quotes.response')}
        <select
          aria-label={t('quotes.response')}
          value={form.option}
          onChange={(event) => setForm((current) => ({ ...current, option: event.target.value }))}
        >
          {RESPONSE_OPTIONS.map((key) => (
            <option key={key} value={key}>
              {t(`quotes.response.${key}`)}
            </option>
          ))}
        </select>
      </label>
      {form.option === 'date' && (
        <Field
          label="quotes.returnDate"
          type="date"
          required
          min={addDays(today(), 1)}
          value={form.date}
          onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
        />
      )}
      <label>
        {t('quotes.responseNote')}
        <textarea
          value={form.note}
          required={form.option === 'other'}
          maxLength={1000}
          rows={3}
          onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
        />
      </label>
    </>
  );
}
export function ResponseForm({ onSave, onClose, busy }) {
  const [form, setForm] = useState({ option: 'interested', date: '', note: '' });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(form);
      }}
    >
      <p className="quotesMuted">{t('quotes.responseHelp')}</p>
      <ResponseFields form={form} setForm={setForm} />
      <FormActions onClose={onClose} busy={busy} />
    </form>
  );
}
export function SnoozeForm({ onSave, onClose, busy }) {
  const [date, setDate] = useState(addDays(today(), 14));
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(date);
      }}
    >
      <Field
        label="quotes.returnDate"
        type="date"
        required
        min={addDays(today(), 1)}
        value={date}
        onChange={(event) => setDate(event.target.value)}
      />
      <FormActions onClose={onClose} busy={busy} />
    </form>
  );
}
export function MessageForm({ onSave, onClose, busy }) {
  const [form, setForm] = useState({ sender: '', subject: '', body: '' });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(form);
      }}
    >
      <p className="quotesMuted">{t('quotes.pasteHelp')}</p>
      <Field
        label="quotes.sender"
        type="email"
        dir="ltr"
        value={form.sender}
        required
        onChange={(event) => setForm((current) => ({ ...current, sender: event.target.value }))}
      />
      <Field
        label="quotes.subject"
        value={form.subject}
        dir="auto"
        required
        maxLength={500}
        onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
      />
      <label>
        {t('quotes.body')}
        <textarea
          dir="auto"
          rows={8}
          value={form.body}
          required
          maxLength={100000}
          onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
        />
      </label>
      <FormActions onClose={onClose} busy={busy} label="quotes.pasteEmail" />
    </form>
  );
}
