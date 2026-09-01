import { useEffect, useState } from 'react';
import { createSignedUrl } from '../../../services/api/storage.js';

export default function ReviewFilesPanel({ files, canDelete, onDelete }) {
  const [urls, setUrls] = useState({});

  useEffect(() => {
    let cancelled = false;
    async function loadUrls() {
      const next = {};
      for (const file of files) {
        const { data } = await createSignedUrl('project-review-files', file.file_path, 60 * 60);
        if (data?.signedUrl) next[file.id] = data.signedUrl;
      }
      if (!cancelled) setUrls(next);
    }
    loadUrls();
    return () => {
      cancelled = true;
    };
  }, [files]);

  if (!files.length) return null;
  return (
    <div className="tasksBox reviewFilesBox">
      <div className="tasksHeader">
        <b>קבצי הגהה</b>
        <span className="muted">{files.length} קבצים</span>
      </div>
      {files.map((file) => (
        <div className="taskItem" key={file.id}>
          <div>
            <b>{file.file_name || "קובץ PDF"}</b>
            <p className="muted">
              הועלה על ידי {file.profiles?.full_name || "שרטט"} · {new Date(file.created_at).toLocaleString("he-IL")}
            </p>
          </div>
          <div className="taskActions">
            {urls[file.id] && (
              <a className="ghost tinyBtn" href={urls[file.id]} target="_blank" rel="noreferrer">
                פתיחת PDF
              </a>
            )}
            {canDelete && (
              <button className="danger ghost tinyBtn" onClick={() => onDelete(file)}>
                מחיקת PDF
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
