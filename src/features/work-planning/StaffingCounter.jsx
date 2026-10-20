import { useId } from 'react';
import { CheckCircle2, ChevronDown, CircleAlert, Users } from 'lucide-react';
import { t, useLanguage } from '../language/LanguageContext.jsx';
import { localeForLanguage } from '../language/locale.js';
import { getStaffingSummary } from './staffingSummary.js';

export default function StaffingCounter({ rows, rosterNames, workers, source }) {
  const { language } = useLanguage();
  const id = useId();
  const summary = getStaffingSummary(rows, rosterNames, workers);
  const number = (value) => new Intl.NumberFormat(localeForLanguage(language)).format(value);
  const list = (entries) => [...entries].sort((a, b) => a.name.localeCompare(b.name, localeForLanguage(language)))
    .map((entry) => <li key={entry.key} dir="auto">{entry.name}</li>);
  return <div className={`workPlanStaffing${summary.complete ? ' complete' : ''}`} role="region" aria-label={t('workPlan.staffingTitle')}>
    <div className="workPlanStaffingCounts" role="status" aria-live="polite" aria-atomic="true">
      <strong><Users size={16} aria-hidden="true" />{t(summary.uniqueCount === 1 ? 'workPlan.uniqueStaffOne' : 'workPlan.uniqueStaff', { count: number(summary.uniqueCount) })}</strong>
      <span>{t('workPlan.staffingCoverage', { assigned: number(summary.assigned), total: number(summary.total) })}</span>
      <span className="workPlanStaffingStatus">{summary.complete ? <CheckCircle2 size={15} aria-hidden="true" /> : <CircleAlert size={15} aria-hidden="true" />}
        {t(!summary.total ? 'workPlan.noStaffingRoster' : summary.missing.length === 1 ? 'workPlan.missingStaffOne' : summary.missing.length ? 'workPlan.missingStaffCount'
          : summary.review.length ? 'workPlan.staffingReviewStatus' : 'workPlan.allStaffCovered', { count: number(summary.missing.length) })}
      </span>
    </div>
    <progress className="workPlanStaffingProgress" value={summary.assigned} max={summary.total || 1}
      aria-label={t('workPlan.staffingCoverage', { assigned: number(summary.assigned), total: number(summary.total) })} />
    <details className="workPlanStaffingDetails">
      <summary aria-controls={id}>{t('workPlan.staffingDetails')}<ChevronDown size={12} aria-hidden="true" /></summary>
      <div id={id} className="workPlanStaffingBody">
        <p>{t(source === 'published' ? 'workPlan.staffingPublishedSource' : source === 'workbook' ? 'workPlan.staffingWorkbookSource' : 'workPlan.staffingDirectorySource')}</p>
        <p>{t('workPlan.staffingAbsenceHint')}</p>
        {summary.missing.length > 0 && <><h3>{t('workPlan.missingStaffTitle')}</h3><ul>{list(summary.missing)}</ul></>}
        {summary.review.length > 0 && <><h3>{t('workPlan.staffingReviewTitle')}</h3><p>{t('workPlan.staffingReviewHint')}</p><ul>{list(summary.review)}</ul></>}
        {summary.additional.length > 0 && <><h3>{t('workPlan.additionalStaffTitle')}</h3><ul>{list(summary.additional)}</ul></>}
        {summary.complete && <p>{t('workPlan.allStaffCovered')}</p>}
      </div>
    </details>
  </div>;
}
