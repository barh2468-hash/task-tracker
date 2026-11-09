import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../features/auth/useAuth.js';
import { useProjects } from '../features/projects/ProjectsContext.jsx';
import { t, useLanguage } from '../features/language/LanguageContext.jsx';
import { localeForLanguage } from '../features/language/locale.js';
import { roleLabel, supabase } from '../services/supabase.js';
import { useSignedFileLinks } from '../features/projects/hooks/useSignedFileLinks.js';
import FileLinksNotice from '../features/projects/components/FileLinksNotice.jsx';
import './viewer-information.css';

// Explicit business fields; integration credentials are never requested.
const datasets = {
  profiles: ['viewer.users', 'created_at', {full_name:'שם מלא',email:'אימייל',role:'תפקיד'}],
  crew_helpers: ['viewer.helpers','created_at',{name:'שם',is_active:'viewer.active'}],
  chat_messages: ['צ׳אט פנימי','created_at',{sender_id:'viewer.sender',project_id:'פרויקט',body:'viewer.body',created_at:'תאריך'}],
  notifications: ['התראות','created_at',{recipient_id:'viewer.recipient',title:'כותרת',body:'viewer.body',project_id:'פרויקט',created_at:'תאריך'}],
  personal_notes: ['viewer.notes','created_at',{owner_id:'viewer.owner',title:'כותרת',body:'viewer.body',project_id:'פרויקט',updated_at:'תאריך'}],
  payment_devices: ['viewer.payments','created_at',{device_label:'שם',invoice_no:'מספר חשבונית',purchase_month:'viewer.month',monthly_payment:'viewer.monthly',total_payments:'viewer.totalPayments',balance:'viewer.balance',status:'סטטוס',notes:'הערות'}],
  project_manhole_layouts: ['פרישת שוחות','created_at',{project_name:'פרויקט',created_by_name:'שם מלא',manhole_number:'מספר שוחה',infrastructure:'תשתית',work_date:'תאריך',file_name:'שם קובץ'}],
};
const pathDatasets = {
  '/app/chat':'chat_messages','/app/notifications':'notifications','/app/users':'profiles',
  '/app/my-notes':'personal_notes','/app/manhole-layout':'project_manhole_layouts',
  '/app/accounting/tolls':'payment_devices',
};
export const viewerDatasetForPath = (path) => pathDatasets[path];
const PAGE_SIZE = 100;

export default function ViewerInformationPage({initialDataset = 'profiles'}) {
  useTranslation();
  const {isViewer} = useAuth();
  const {workers, projects} = useProjects();
  const {language} = useLanguage();
  const locale = localeForLanguage(language);
  const [params,setParams] = useSearchParams();
  const selected = params.get('dataset');
  const dataset = Object.hasOwn(datasets, selected) ? selected
    : Object.hasOwn(datasets, initialDataset) ? initialDataset : 'profiles';
  const [label,order,fields] = datasets[dataset] || datasets.profiles;
  const [rows,setRows] = useState([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState(false);
  const [more,setMore] = useState(false);
  const [query,setQuery] = useState('');
  const fileLinks = useSignedFileLinks('manhole-layouts', dataset === 'project_manhole_layouts'
    ? rows.map(row=>({...row,file_path:row.pdf_path})) : []);
  const request = useRef(0);
  const load = useCallback(async (offset = 0) => {
    if (!isViewer) return;
    const version = ++request.current;
    setLoading(true); setError(false);
    const {data,error} = await supabase.from(dataset).select('*')
      .order(order, {ascending:false}).order('id').range(offset, offset + PAGE_SIZE - 1);
    if (request.current !== version) return;
    if (error) setError(true);
    else {setRows(current => offset ? [...current,...data] : data); setMore(data.length === PAGE_SIZE);}
    setLoading(false);
  },[dataset,isViewer,order]);
  useEffect(() => {
    setRows([]); setMore(false); setQuery(''); void load();
    return () => {request.current += 1;};
  },[load]);
  if (!isViewer) return <Navigate to="/app/projects" replace />;
  function value(field, raw, row) {
    if (raw == null || raw === '') return '—';
    if (field === 'role') return t(raw === 'demo' && row?.email === 'johnny-maya@clients.maya.invalid' ? 'viewer.role' : roleLabel[raw] || raw);
    if (field === 'status') return t(raw);
    if (field.endsWith('_at') || field === 'work_date') return new Intl.DateTimeFormat(locale,
      {timeZone:'Asia/Hebron',dateStyle:'medium',...(field.endsWith('_at') ? {timeStyle:'short'} : {})}).format(new Date(raw));
    if (field === 'project_id') return projects.find(p=>p.id===raw)?.name || raw;
    if (['sender_id','recipient_id','owner_id'].includes(field)) return workers.find(p=>p.id===raw)?.full_name || raw;
    if (typeof raw === 'number') return raw.toLocaleString(locale);
    if (typeof raw === 'boolean') return t(raw ? 'כן' : 'לא');
    if (typeof raw === 'object') return JSON.stringify(raw,null,2);
    return raw;
  }
  const filtered = rows.filter(row => Object.keys(fields).some(field =>
    String(value(field,row[field],row)).toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale))));
  return <section className="card viewerInformation">
    <h2>{t(label)}</h2>
    <label>{t('viewer.select')}<select value={dataset} onChange={event=>setParams({dataset:event.target.value})}>
      {Object.entries(datasets).map(([name,[title]])=><option key={name} value={name}>{t(title)}</option>)}
    </select></label>
    <label>{t('viewer.search')}<input type="search" value={query} onChange={event=>setQuery(event.target.value)} /></label>
    {error && <p role="alert">{t('viewer.loadError')} <button type="button" onClick={()=>load(rows.length)}>{t('נסה שוב')}</button></p>}
    {!loading && !error && !filtered.length && <p>{t('viewer.empty')}</p>}
    {filtered.map((row,index)=><article className="card" key={row.id}>
      <h3 dir="auto">{row.full_name || row.title || row.device_label || row.project_name || row.plate_number || t('viewer.record',{number:(index+1).toLocaleString(locale)})}</h3>
      {row.pdf_path && fileLinks.links[row.id]?.view && <a href={fileLinks.links[row.id].view} target="_blank" rel="noreferrer">{row.file_name}</a>}
      <dl>{Object.entries(fields).filter(([field])=>row[field] != null).map(([field,title])=><div key={field}><dt>{t(title)}</dt><dd dir="auto">{value(field,row[field],row)}</dd></div>)}</dl>
    </article>)}
    {dataset === 'project_manhole_layouts' && <FileLinksNotice {...fileLinks} />}
    {loading && <p role="status">{t('טוען...')}</p>}
    {more && <button type="button" disabled={loading} onClick={()=>load(rows.length)}>{t('viewer.more')}</button>}
  </section>;
}
