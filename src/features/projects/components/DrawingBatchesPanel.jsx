import { useTranslation } from 'react-i18next';
import { t, useLanguage } from '../../language/LanguageContext.jsx';
import { localeForLanguage } from '../../language/locale.js';
import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  FileText,
  Layers3,
  PencilRuler,
  Play,
  UserRound,
} from 'lucide-react';
import DrafterReviewBox from './DrafterReviewBox.jsx';
import ReviewFilesPanel from './ReviewFilesPanel.jsx';

const statusLabels = {
  pending_drafting: 'ממתינה לשרטוט',
  in_drafting: 'בשרטוט',
  sent_to_review: 'נשלחה להגהה',
  approved: 'אושרה',
  cancelled: 'בוטלה',
};

const typeLabels = {
  addition: 'תוספת לעבודה קודמת',
  correction: 'תיקון למידע שנשלח',
  new_phase: 'שלב חדש בפרויקט',
};

const impactLabels = {
  no_change: 'תוספת נפרדת',
  changes_review: 'משפיעה על ההגהה הקיימת',
  unsure: 'נדרשת החלטת אחראי השרטוט',
};

function eventDescription(event) {
  if (event.event_type === 'created') return t('המנה נוצרה והועברה לתור השרטוט');
  if (event.event_type === 'drafter_assigned') return t('שיוך השרטט עודכן');
  if (event.event_type === 'status_changed') {
    return t('{{value0}} ← {{value1}}', {
      value0: t(statusLabels[event.new_status] || event.new_status),
      value1: t(statusLabels[event.old_status] || event.old_status),
    });
  }
  return event.note || t('המנה עודכנה');
}

export default function DrawingBatchesPanel({
  batches,
  documents,
  reviewFiles,
  currentUserId,
  isManager,
  isAssignedFieldWorker,
  canManageReview,
  onUpdateStatus,
  onSendToReview,
  onDeleteReviewFile,
}) {
  useTranslation();
  const { language } = useLanguage();
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [updatingBatchId, setUpdatingBatchId] = useState(null);

  const orderedBatches = useMemo(
    () => [...batches].sort((left, right) => right.batch_number - left.batch_number),
    [batches],
  );

  async function changeStatus(batch, newStatus) {
    setUpdatingBatchId(batch.id);
    try {
      return await onUpdateStatus(batch, newStatus);
    } finally {
      setUpdatingBatchId(null);
    }
  }

  if (!orderedBatches.length) {
    return (
      <section className="projectTabPanel drawingBatchesEmpty">
        <Layers3 size={30} />
        <b>{t('עדיין לא נוצרו מנות שרטוט')}</b>
        <span>{t('דיווח המשך העבודה הראשון יופיע כאן עם סטטוס ומסמכים משלו.')}</span>
      </section>
    );
  }

  return (
    <section className="projectTabPanel drawingBatchesPanel">
      <header className="projectTabPanelHeader">
        <div>
          <b>{t('מנות שרטוט')}</b>
          <small>{t('כל סבב מתקדם בנפרד מסטטוס הפרויקט')}</small>
        </div>
        <span className="projectDocumentsCount">{orderedBatches.length}</span>
      </header>

      <div className="drawingBatchesList">
        {orderedBatches.map((batch) => {
          const batchDocuments = documents.filter(
            (document) => document.drawing_batch_id === batch.id,
          );
          const batchReviewFiles = reviewFiles.filter((file) => file.drawing_batch_id === batch.id);
          const events = [...(batch.project_drawing_batch_events || [])].sort(
            (left, right) => new Date(right.created_at) - new Date(left.created_at),
          );
          const isAssignedDrafter = batch.assigned_drafter === currentUserId;
          const canDraft =
            isManager || (canManageReview && (!batch.assigned_drafter || isAssignedDrafter));
          const canApprove =
            batch.status === 'sent_to_review' && (isManager || isAssignedFieldWorker);
          const reviewDraft = reviewDrafts[batch.id] || { files: [], note: '' };

          return (
            <article className={`drawingBatchCard batchStatus-${batch.status}`} key={batch.id}>
              <header className="drawingBatchHeader">
                <div className="drawingBatchIdentity">
                  <span className="drawingBatchNumber">
                    {t('מנה {{number}}', {
                      number: batch.batch_number.toLocaleString(localeForLanguage(language)),
                    })}
                  </span>
                  <div>
                    <b>{t(typeLabels[batch.update_type])}</b>
                    <small>
                      {new Date(`${batch.work_date}T12:00:00`).toLocaleDateString(
                        localeForLanguage(language),
                      )}
                    </small>
                  </div>
                </div>
                <span className={`drawingBatchStatus ${batch.status}`}>
                  {t(statusLabels[batch.status])}
                </span>
              </header>

              <p className="drawingBatchSummary">{batch.summary}</p>

              <div className="drawingBatchMeta">
                <span
                  className={batch.review_impact === 'changes_review' ? 'batchImpactWarning' : ''}
                >
                  <PencilRuler size={15} /> {t(impactLabels[batch.review_impact])}
                </span>
                <span>
                  <UserRound size={15} />
                  {batch.assigned_drafter_profile?.full_name || t('טרם שויך שרטט')}
                </span>
                <span>
                  <Clock3 size={15} />{' '}
                  {t('נוצרה על ידי {{name}}', {
                    name: batch.created_by_profile?.full_name || t('משתמש'),
                  })}
                </span>
              </div>

              {batchDocuments.length > 0 && (
                <div className="drawingBatchFiles">
                  <b>
                    <FileText size={16} /> {t('חומרים מהשטח')}
                  </b>
                  <ul>
                    {batchDocuments.map((document) => (
                      <li key={document.id}>{document.file_name}</li>
                    ))}
                  </ul>
                </div>
              )}

              {batch.status === 'pending_drafting' && canDraft && (
                <button
                  type="button"
                  className="smallBtn drawingBatchPrimaryAction projectPrimaryAction"
                  disabled={updatingBatchId === batch.id}
                  onClick={() => changeStatus(batch, 'in_drafting')}
                >
                  <Play size={16} />
                  {updatingBatchId === batch.id ? t('מעדכן...') : t('התחלת שרטוט')}
                </button>
              )}

              {['in_drafting', 'sent_to_review'].includes(batch.status) && canDraft && (
                <DrafterReviewBox
                  reviewFiles={reviewDraft.files}
                  setReviewFiles={(files) =>
                    setReviewDrafts((drafts) => ({
                      ...drafts,
                      [batch.id]: { ...reviewDraft, files },
                    }))
                  }
                  reviewNote={reviewDraft.note}
                  title={t('שליחת מנה {{number}} להגהה', {
                    number: batch.batch_number.toLocaleString(localeForLanguage(language)),
                  })}
                  description={t('העלה את קובצי השרטוט של המנה. רק המנה הזו תעבור להגהה.')}
                  progressDescription={t('הקבצים נשמרים ומנת השרטוט מועברת להגהה')}
                  setReviewNote={(note) =>
                    setReviewDrafts((drafts) => ({
                      ...drafts,
                      [batch.id]: { ...reviewDraft, note },
                    }))
                  }
                  onSend={async () => {
                    const result = await onSendToReview(batch, reviewDraft.files, reviewDraft.note);
                    if (result?.ok) {
                      setReviewDrafts((drafts) => ({
                        ...drafts,
                        [batch.id]: { files: [], note: '' },
                      }));
                    }
                    return result;
                  }}
                />
              )}

              <ReviewFilesPanel
                files={batchReviewFiles}
                canDelete={canManageReview}
                onDelete={onDeleteReviewFile}
                canApprove={canApprove}
                onApprove={() => changeStatus(batch, 'approved')}
                approvalDescription={t('לאשר את מנת שרטוט {{number}} בלי לשנות את סטטוס הפרויקט?', {
                  number: batch.batch_number.toLocaleString(localeForLanguage(language)),
                })}
              />

              {batch.status === 'approved' && (
                <div className="drawingBatchApproved">
                  <CheckCircle2 size={18} /> {t('מנת השרטוט אושרה')}
                </div>
              )}

              {events.length > 0 && (
                <details className="drawingBatchEvents">
                  <summary>{t('{{count}} פעולות במנה', { count: events.length })}</summary>
                  <div>
                    {events.map((event) => (
                      <p key={event.id}>
                        <b>{eventDescription(event)}</b>
                        <span>
                          {event.profiles?.full_name || t('משתמש')} ·{' '}
                          {new Date(event.created_at).toLocaleString(localeForLanguage(language))}
                        </span>
                      </p>
                    ))}
                  </div>
                </details>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
