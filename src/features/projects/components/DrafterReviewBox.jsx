export default function DrafterReviewBox({
  reviewFile,
  setReviewFile,
  reviewNote,
  setReviewNote,
  onSend,
}) {
  return (
    <div
      className="reviewBox"
      style={{
        border: "1px solid #fecdd3",
        background: "#fff7f7",
        borderRadius: 18,
        padding: 16,
        display: "grid",
        gap: 12,
      }}
    >
      <div>
        <b>שליחה להגהה</b>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          העלה PDF ושלח התראה לעובדי השטח, למנהלים ולשרטטים.
        </p>
      </div>
      <label>
        קובץ PDF להגהה
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => setReviewFile(e.target.files?.[0] || null)}
        />
      </label>
      {reviewFile && <span className="muted">נבחר: {reviewFile.name}</span>}
      <textarea
        value={reviewNote}
        onChange={(e) => setReviewNote(e.target.value)}
        placeholder="הערה לעובדי השטח, אופציונלי"
      />
      <button className="smallBtn danger" onClick={onSend} disabled={!reviewFile}>
        שלח להגהה
      </button>
    </div>
  );
}
