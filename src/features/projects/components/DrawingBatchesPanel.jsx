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
  if (event.event_type === 'created') return 'המנה נוצרה והועברה לתור השרטוט';
  if (event.event_type === 'drafter_assigned') return 'שיוך השרטט עודכן';
  if (event.event_type === 'status_changed') {
    return `${statusLabels[event.old_status] || event.old_status} ← ${statusLabels[event.new_status] || event.new_status}`;
  }
  return event.note || 'המנה עודכנה';
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
      <section className="projectTabPanel drawingBatchesEmpty" role="tabpanel">
        <Layers3 size={30} />
        <b>עדיין לא נוצרו מנות שרטוט</b>
        <span>דיווח המשך העבודה הראשון יופיע כאן עם סטטוס ומסמכים משלו.</span>
      </section>
    );
  }

  return (
    <section className="projectTabPanel drawingBatchesPanel" role="tabpanel">
      <header className="projectTabPanelHeader">
        <div>
          <b>מנות שרטוט</b>
          <small>כל סבב מתקדם בנפרד מסטטוס הפרויקט</small>
        </div>
        <span className="projectDocumentsCount">{orderedBatches.length}</span>
      </header>

      <div className="drawingBatchesList">
        {orderedBatches.map((batch) => {
          const batchDocuments = documents.filter(
            (document) => document.drawing_batch_id === batch.id,
          );
          const batchReviewFiles = reviewFiles.filter(
            (file) => file.drawing_batch_id === batch.id,
          );
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
                  <span className="drawingBatchNumber">מנה {batch.batch_number}</span>
                  <div>
                    <b>{typeLabels[batch.update_type]}</b>
                    <small>
                      {new Date(`${batch.work_date}T12:00:00`).toLocaleDateString('he-IL')}
                    </small>
                  </div>
                </div>
                <span className={`drawingBatchStatus ${batch.status}`}>
                  {statusLabels[batch.status]}
                </span>
              </header>

              <p className="drawingBatchSummary">{batch.summary}</p>

              <div className="drawingBatchMeta">
                <span className={batch.review_impact === 'changes_review' ? 'batchImpactWarning' : ''}>
                  <PencilRuler size={15} /> {impactLabels[batch.review_impact]}
                </span>
                <span>
                  <UserRound size={15} />
                  {batch.assigned_drafter_profile?.full_name || 'טרם שויך שרטט'}
                </span>
                <span>
                  <Clock3 size={15} /> נוצרה על ידי{' '}
                  {batch.created_by_profile?.full_name || 'משתמש'}
                </span>
              </div>

              {batchDocuments.length > 0 && (
                <div className="drawingBatchFiles">
                  <b><FileText size={16} /> חומרים מהשטח</b>
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
                  className="smallBtn drawingBatchPrimaryAction"
                  disabled={updatingBatchId === batch.id}
                  onClick={() => changeStatus(batch, 'in_drafting')}
                >
                  <Play size={16} />
                  {updatingBatchId === batch.id ? 'מעדכן...' : 'התחלת שרטוט'}
                </button>
              )}

              {batch.status === 'in_drafting' && canDraft && (
                <DrafterReviewBox
                  reviewFiles={reviewDraft.files}
                  setReviewFiles={(files) =>
                    setReviewDrafts((drafts) => ({
                      ...drafts,
                      [batch.id]: { ...reviewDraft, files },
                    }))
                  }
                  reviewNote={reviewDraft.note}
                  title={`שליחת מנה ${batch.batch_number} להגהה`}
                  description="העלה את קובצי השרטוט של המנה. רק המנה הזו תעבור להגהה."
                  progressDescription="הקבצים נשמרים ומנת השרטוט מועברת להגהה"
                  setReviewNote={(note) =>
                    setReviewDrafts((drafts) => ({
                      ...drafts,
                      [batch.id]: { ...reviewDraft, note },
                    }))
                  }
                  onSend={async () => {
                    const result = await onSendToReview(
                      batch,
                      reviewDraft.files,
                      reviewDraft.note,
                    );
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
                approvalDescription={`לאשר את מנת שרטוט ${batch.batch_number} בלי לשנות את סטטוס הפרויקט?`}
              />

              {batch.status === 'approved' && (
                <div className="drawingBatchApproved">
                  <CheckCircle2 size={18} /> מנת השרטוט אושרה
                </div>
              )}

              {events.length > 0 && (
                <details className="drawingBatchEvents">
                  <summary>{events.length} פעולות במנה</summary>
                  <div>
                    {events.map((event) => (
                      <p key={event.id}>
                        <b>{eventDescription(event)}</b>
                        <span>
                          {event.profiles?.full_name || 'משתמש'} ·{' '}
                          {new Date(event.created_at).toLocaleString('he-IL')}
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
