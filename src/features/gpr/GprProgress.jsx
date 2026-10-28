import { Check, CheckCircle2, Circle, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { t, useLanguage } from '../language/LanguageContext.jsx';
import { localeForLanguage } from '../language/locale.js';
import { GPR_STATUSES, orderName } from './model.js';
import { requirementProgress } from './progress.js';

export function GprChecklist({ order, busy, onChange }) {
  useTranslation();
  const { language } = useLanguage();
  const number = (n) => new Intl.NumberFormat(localeForLanguage(language)).format(n);
  const { total, done } = requirementProgress(order);
  return (
    <div className="gprChecklist">
      <div className="gprProgressHeading">
        <b>{t('gpr.actions')}</b>
        <span role="status">
          {busy
            ? t('gpr.saving')
            : total
              ? t('gpr.progressCount', { done: number(done), total: number(total) })
              : t('gpr.noRequirements')}
        </span>
      </div>
      {total > 0 && (
        <progress
          value={done}
          max={total}
          aria-label={t('gpr.progressFor', { name: orderName(order, t) })}
        />
      )}
      <ul className="gprActionList">
        {(order.requirements || []).map((item) => (
          <li key={item.key} className={item.done ? 'isDone' : ''}>
            <label>
              <input
                type="checkbox"
                checked={item.done}
                disabled={busy || !onChange}
                aria-label={t(item.done ? 'gpr.reopenRequirement' : 'gpr.completeRequirement', {
                  name: t(`gpr.requirement.${item.key}`),
                })}
                onChange={(event) =>
                  onChange({ type: 'requirement', key: item.key, done: event.target.checked })
                }
              />
              <span className="gprCheckIcon" aria-hidden="true">
                {item.done ? <CheckCircle2 size={19} /> : <Circle size={19} />}
              </span>
              <span className="gprActionCopy">
                <b>{t(`gpr.requirement.${item.key}`)}</b>
                {item.detail && <small dir="auto">{item.detail}</small>}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GprQuickStatus({ order, busy, onChange }) {
  useTranslation();
  const completed = order.status === 'completed';
  return (
    <div className="gprQuickStatus">
      <label>
        <span>{t('gpr.status')}</span>
        <select
          value={order.status}
          disabled={busy || !onChange}
          aria-label={t('gpr.statusFor', { name: orderName(order, t) })}
          onChange={(event) => onChange({ type: 'status', value: event.target.value })}
        >
          {GPR_STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(`gpr.status.${value}`)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className={`gprCompleteButton ${completed ? 'isCompleted' : ''}`}
        disabled={busy || !onChange}
        onClick={() => onChange({ type: 'status', value: completed ? 'new' : 'completed' })}
      >
        {completed ? <RotateCcw size={16} /> : <Check size={17} />}
        {t(completed ? 'gpr.reopenWork' : 'gpr.completeWork')}
      </button>
    </div>
  );
}
