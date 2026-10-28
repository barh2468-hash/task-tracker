import { useState } from 'react';
import { t, useLanguage } from '../language/LanguageContext.jsx';
import { useTranslation } from 'react-i18next';
import GprWorkspace from './GprWorkspace.jsx';
import { emptyOrder } from './model.js';
import Microsoft365Panel from './Microsoft365Panel.jsx';
import GprNotificationsPreview from './GprNotificationsPreview.jsx';
import OrderEmailsPanel from './OrderEmailsPanel.jsx';
import { progressPatch } from './progress.js';

let previewConnection = {
  mailbox: 'mailbox@example.com',
  folder_name: 'GPR',
  allowed_senders: ['orders@example.com'],
  enabled: true,
  last_sync_at: '2026-10-28T08:00:00Z',
};
const previewMicrosoftCall = async (action, payload) => {
  if (action === 'settings') previewConnection = { ...previewConnection, ...payload };
  return {
    configured: true,
    lookback_days: 14,
    missing: ['M365_TENANT_ID', 'M365_CLIENT_ID', 'M365_CLIENT_SECRET'],
    callback: 'https://example.supabase.co/functions/v1/gpr-microsoft?callback=1',
    connection: previewConnection,
    pending: [],
  };
};

// This fixture exists only in the DEV route and never calls the database.
const fixture = {
  ...emptyOrder(),
  id: 'local-gpr-example',
  title: 'מוסך רכבת באר שבע',
  location: 'באר שבע',
  source_subject: 'אלקטרה אלקו התק"ש- פרויקט מוסך רכבת באר שבע- GPR- הכנה לשטח',
  source_email:
    'היי,\nהתקבלה הזמנת עבודה.\nאיתור ומיפוי תשתיות תת קרקעיות באמצעות מערכת GPR.\nמס׳ הזמנה: 2260844\nאני צריך לקבל צילומי ת״ז ומס׳ רכב של הצוות שיבצע את האיתור.',
  order_number: '2260844',
  contact_name: "משה מנצ'ובסקי",
  contact_phone: '0544886255',
  contact_email: 'MosheMa@electra.co.il',
  planned_days: 1,
  description:
    'איתור ומיפוי תשתיות תת קרקעיות באמצעות מערכת GPR בתחום העבודה המסומן בצבע כחול בתוכנית מדידה שהתקבלה ממזמין העבודה.',
  created_at: '2026-10-25T07:00:00Z',
  updated_at: '2026-10-25T07:00:00Z',
  requirements: [
    { key: 'plan', done: false, detail: '' },
    { key: 'schedule', done: false, detail: '' },
    {
      key: 'crew',
      done: false,
      detail: 'אני צריך לקבל צילומי ת"ז ומס\' רכב של הצוות שיבצע את האיתור.',
    },
    { key: 'copies', done: false, detail: '' },
    { key: 'ttl', done: false, detail: '' },
  ],
};
const loadPreviewEmails = async () => [
  {
    id: 'example-update',
    subject: fixture.source_subject,
    body_text: fixture.source_email,
    sender: 'orders@example.com',
    status: 'imported',
    received_at: fixture.created_at,
    has_attachments: true,
  },
];
export default function LocalGprPreview() {
  useTranslation();
  const { language, setLanguage } = useLanguage();
  const [orders, setOrders] = useState([fixture]);
  const [selectedId, setSelectedId] = useState(null);
  return (
    <main
      className="gprPreview"
      style={
        new URLSearchParams(window.location.search).has('compact') ? { maxWidth: 430 } : undefined
      }
    >
      <header className="gprPreviewHeader">
        <p>{t('gpr.preview')}</p>
        <label>
          {t('gpr.language')}
          <select value={language} onChange={(event) => void setLanguage(event.target.value)}>
            <option value="he" lang="he">
              עברית
            </option>
            <option value="en" lang="en">
              English
            </option>
            <option value="el" lang="el">
              Ελληνικά
            </option>
          </select>
        </label>
      </header>
      {new URLSearchParams(window.location.search).has('notifications') ? (
        <GprNotificationsPreview order={orders[0]} onOpen={setSelectedId} />
      ) : (
        <Microsoft365Panel orders={orders} call={previewMicrosoftCall} />
      )}
      <GprWorkspace
        orders={orders}
        emailIntakeConnected
        selectedId={selectedId}
        onSelect={setSelectedId}
        onOpenProject={() => {}}
        onRetry={() => {}}
        onSetDeleted={async (order, deleted) => {
          const row = {
            ...order,
            deleted_at: deleted ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          };
          setOrders((current) => current.map((item) => (item.id === row.id ? row : item)));
          return row;
        }}
        onUpdate={async (order, change) => {
          const row = {
            ...order,
            ...progressPatch(order, change),
            updated_at: new Date().toISOString(),
          };
          setOrders((current) => current.map((item) => (item.id === row.id ? row : item)));
          return row;
        }}
        renderEmails={(order) => (
          <OrderEmailsPanel
            key={order.id}
            order={order}
            loadEmails={loadPreviewEmails}
            live={false}
          />
        )}
        onSave={async (form) => {
          const row = {
            ...form,
            id: form.id || crypto.randomUUID(),
            created_at: form.created_at || new Date().toISOString(),
          };
          setOrders((current) => [row, ...current.filter((item) => item.id !== row.id)]);
          return row;
        }}
      />
    </main>
  );
}
