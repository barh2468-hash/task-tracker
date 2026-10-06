import { useEffect, useRef, useState } from 'react';
import { FileDown, Mail, X } from 'lucide-react';
import { t } from '../language/LanguageContext.jsx';

export default function EmailLayoutsDialog({ rows, onSend, onClose }) {
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const [recipients, setRecipients] = useState('');
  const [subject, setSubject] = useState(() => `פרישת שוחות – ${[...new Set(rows.map(row => row.project_name))].join(', ')}`.slice(0, 200));
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [requestId] = useState(() => crypto.randomUUID());
  const totalSize = rows.reduce((sum, row) => sum + row.pdf_size, 0);
  const tooLarge = totalSize > 18 * 1000 * 1000;
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    inputRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; if (dialog.open) dialog.close(); };
  }, []);
  async function submit(event) {
    event.preventDefault();
    if (sending || result || tooLarge) return;
    const to = [...new Set(recipients.split(/[,;\s]+/).filter(Boolean).map(value => value.toLowerCase()))];
    if (!to.length || to.length > 10 || to.some(value => !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value))) { setError(t('יש להזין עד 10 כתובות מייל תקינות.')); return; }
    setSending(true); setAttempted(true); setError('');
    try { setResult(await onSend({ requestId, layoutIds: rows.map(row => row.id), recipients: to, subject, message })); }
    catch (failure) { setError(failure.message || t('שליחת המייל נכשלה.')); }
    finally { setSending(false); }
  }
  return <dialog ref={dialogRef} className="manholeEmailDialog" aria-labelledby="manhole-email-title" onCancel={event => { event.preventDefault(); if (!sending) onClose(); }}>
    <header className="manholePreviewHeader"><div><h2 id="manhole-email-title">{t('שליחת פרישות במייל')}</h2><p>{t('קובצי ה־PDF יישלחו כקבצים מצורפים, כולל התמונות.')}</p></div><button type="button" className="manholePreviewClose" disabled={sending} aria-label={t('סגירה')} onClick={onClose}><X size={22} aria-hidden="true" /></button></header>
    <form className="manholeEmailForm" onSubmit={submit}>
      <label>{t('נמענים')}<textarea ref={inputRef} aria-label={t('נמענים')} value={recipients} disabled={attempted} onChange={event => setRecipients(event.target.value)} placeholder="name@example.com" autoCapitalize="none" autoCorrect="off" spellCheck={false} dir="ltr" required aria-describedby="manhole-email-hint" /><small id="manhole-email-hint">{t('הפרידו כתובות בפסיק. עד 10 נמענים.')}</small></label>
      <label>{t('נושא')}<input value={subject} disabled={attempted} onChange={event => setSubject(event.target.value)} maxLength={200} required /></label>
      <label>{t('הודעה')}<textarea value={message} disabled={attempted} onChange={event => setMessage(event.target.value)} maxLength={2000} /></label>
      <div className="manholeEmailAttachments"><b><FileDown size={17} aria-hidden="true" />{t('קבצים מצורפים')} ({rows.length})</b><ul>{rows.map(row => <li key={row.id}>{row.file_name} · {row.project_name}</li>)}</ul></div>
      {tooLarge && <p role="alert" className="manholeSavedError">{t('הקבצים גדולים מדי לשליחה יחד. בחרו פחות פרישות. אפשר לשלוח עד 18 MB.')}</p>}
      {error && <p role="alert" className="manholeSavedError">{error}</p>}
      {result && <p role="status" className="manholeEmailSuccess">{result.rejected?.length ? `${t('המייל התקבל לשליחה לחלק מהנמענים. כתובות שנדחו')}: ${result.rejected.join(', ')}` : t('המייל התקבל לשליחה עם קובצי הפרישות המצורפים.')}</p>}
      <footer className="manholeEmailActions"><button type="button" disabled={sending} onClick={onClose}>{t(result ? 'סגירה' : 'ביטול')}</button><button type="submit" className="manholePrimaryButton" disabled={sending || Boolean(result) || tooLarge}><Mail size={17} aria-hidden="true" />{t(sending ? 'שולח...' : attempted ? 'בדיקת מצב השליחה' : 'שליחת מייל')}</button></footer>
    </form>
  </dialog>;
}
