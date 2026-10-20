import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Plus, X } from 'lucide-react';
import { t } from '../language/LanguageContext.jsx';

export default function WorkerPicker({ value, names, multiple = false, compact = false, label, disabled, onChange, describedBy }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState({});
  const button = useRef(null);
  const menu = useRef(null);
  const searchInput = useRef(null);
  const id = useId();
  const selected = value ? value.split(/[,;\n]+/).map((name) => name.trim()).filter(Boolean) : [];
  const choices = [...new Set([...selected, ...names])];
  const filtered = choices.filter((name) => name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  useLayoutEffect(() => {
    if (!open) return;
    const rect = button.current.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 16);
    const below = window.innerHeight - rect.bottom;
    const showBelow = below >= 340 || below >= rect.top;
    const height = Math.min(340, Math.max(0, (showBelow ? below : rect.top) - 11));
    setPosition({
      width, maxHeight: height,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      ...(showBelow ? { top: rect.bottom + 3 } : { bottom: window.innerHeight - rect.top + 3 }),
    });
    searchInput.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event) => {
      if (!button.current?.contains(event.target) && !menu.current?.contains(event.target)) setOpen(false);
    };
    const reposition = (event) => {
      if (!menu.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation(); event.preventDefault();
      setOpen(false); button.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape, true);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  const close = () => { setOpen(false); button.current?.focus({ preventScroll: true }); };
  if (!multiple) return <div className="workPlanWorkerSingle">
    <span className="workPlanWorkerName" dir="auto" aria-hidden="true">{value || t('workPlan.chooseLeader')}</span>
    <ChevronDown size={13} aria-hidden="true" />
    <select className="workPlanWorkerSelect" value={value} disabled={disabled}
    aria-label={label} aria-describedby={describedBy} title={value || label} dir="auto" onChange={(event) => onChange(event.target.value)}>
    <option value="">{t('workPlan.chooseLeader')}</option>
    {value && !names.includes(value) && <option value={value}>{value}</option>}
    {names.map((name) => <option key={name} value={name}>{name}</option>)}
    </select>
  </div>;

  return <>
    <button ref={button} type="button" className={`workPlanWorkerTrigger${compact ? ' workPlanAddHelpers' : ''}`} disabled={disabled}
      aria-label={label} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
      title={compact ? t('workPlan.addHelpers') : value || label} onClick={() => { setSearch(''); setOpen((current) => !current); }}>
      {compact ? <Plus size={15} aria-hidden="true" /> : <><span dir="auto">{value || t('workPlan.chooseHelpers')}</span><ChevronDown size={13} aria-hidden="true" /></>}
    </button>
    {open && createPortal(<div ref={menu} id={id} className="workPlanWorkerMenu" role="dialog" aria-label={label}
      style={position} onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget) && event.relatedTarget !== button.current) setOpen(false);
      }}>
      <div className="workPlanWorkerMenuHeader"><strong>{t('workPlan.chooseHelpers')}</strong>
        <button type="button" className="ghost" aria-label={t('workPlan.closeWorkers')} onClick={close}><X size={16} aria-hidden="true" /></button>
      </div>
      <input ref={searchInput} type="search" value={search} onChange={(event) => setSearch(event.target.value)}
        aria-label={t('workPlan.searchWorkers')} placeholder={t('workPlan.searchWorkers')} />
      <div className="workPlanWorkerOptions">
        {filtered.map((name) => <label key={name}>
          <input type="checkbox" checked={selected.includes(name)} onChange={(event) => {
            const next = event.target.checked ? [...selected, name] : selected.filter((item) => item !== name);
            onChange(next.join(', '));
          }} /><span dir="auto">{name}</span>
        </label>)}
        {!filtered.length && <p role="status">{t('workPlan.noWorkersFound')}</p>}
      </div>
      <button type="button" className="secondary" onClick={close}>{t('workPlan.doneWorkers')}</button>
    </div>, button.current.closest('.workPlanPage'))}
  </>;
}
