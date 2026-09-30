import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock3, History } from 'lucide-react';
import { t } from '../../language/LanguageContext.jsx';
import { useProjects } from '../ProjectsContext.jsx';

const HISTORY_PAGE_SIZE = 10;
const LAST_DAY_MS = 24 * 60 * 60 * 1000;

function lastDayCutoff() {
  return new Date(Date.now() - LAST_DAY_MS).toISOString();
}

function filterFallback(items, view) {
  if (view === 'all') return items;
  const cutoff = Date.now() - LAST_DAY_MS;
  return items.filter((item) => new Date(item.created_at).getTime() >= cutoff);
}

function paginationPages(currentPage, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  return [...new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages])]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);
}

export default function ProjectHistoryPanel({ projectId, fallbackItems, refreshKey }) {
  const { loadProjectHistory } = useProjects();
  const [view, setView] = useState('recent');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState(() => filterFallback(fallbackItems, 'recent'));
  const [total, setTotal] = useState(items.length);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestIdRef = useRef(0);
  const totalPages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const fallback = filterFallback(fallbackItems, view);
    const pageOffset = (page - 1) * HISTORY_PAGE_SIZE;

    if (!navigator.onLine) {
      setItems(fallback.slice(pageOffset, pageOffset + HISTORY_PAGE_SIZE));
      setTotal(fallback.length);
      setError('');
      return undefined;
    }

    setLoading(true);
    setError('');

    loadProjectHistory(projectId, {
      since: view === 'recent' ? lastDayCutoff() : undefined,
      offset: pageOffset,
      limit: HISTORY_PAGE_SIZE,
    })
      .then((result) => {
        if (requestIdRef.current !== requestId) return;
        const availablePages = Math.max(1, Math.ceil(result.total / HISTORY_PAGE_SIZE));
        if (page > availablePages) {
          setPage(availablePages);
          return;
        }
        setItems(result.items);
        setTotal(result.total);
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) return;
        setItems(fallback.slice(pageOffset, pageOffset + HISTORY_PAGE_SIZE));
        setTotal(fallback.length);
        setError(t('טעינת היסטוריית העדכונים נכשלה.'));
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setLoading(false);
      });

    return () => {
      if (requestIdRef.current === requestId) requestIdRef.current += 1;
    };
  }, [fallbackItems, loadProjectHistory, page, projectId, refreshKey, view]);

  return (
    <section className="projectTabPanel projectHistoryPanel" role="tabpanel">
      <header className="projectTabPanelHeader projectHistoryHeader">
        <div>
          <b>
            {view === 'recent'
              ? t('עדכונים ב־24 השעות האחרונות')
              : t('היסטוריית עדכונים מלאה')}
          </b>
          <small>
            {total === 0 ? (
              t('אין עדכונים')
            ) : (
              <>
                {t('{{value0}} עדכונים', { value0: total })} ·{' '}
                {t('עמוד {{value0}} מתוך {{value1}}', {
                  value0: page,
                  value1: totalPages,
                })}
              </>
            )}
          </small>
        </div>
        <div className="projectHistoryViewSwitch" role="group" aria-label={t('טווח זמן')}>
          <button
            type="button"
            className={view === 'recent' ? 'active' : ''}
            aria-pressed={view === 'recent'}
            onClick={() => {
              setView('recent');
              setPage(1);
            }}
          >
            <Clock3 size={15} />
            {t('24 שעות אחרונות')}
          </button>
          <button
            type="button"
            className={view === 'all' ? 'active' : ''}
            aria-pressed={view === 'all'}
            onClick={() => {
              setView('all');
              setPage(1);
            }}
          >
            <History size={15} />
            {t('כל ההיסטוריה')}
          </button>
        </div>
      </header>

      {error && <div className="projectHistoryError" role="alert">{error}</div>}

      <div className={`historyList${loading ? ' loading' : ''}`} aria-busy={loading}>
        {loading && items.length === 0 && (
          <div className="projectHistoryLoading" role="status">
            <span className="projectLoadSpinner" aria-hidden="true" />
            {t('טוען עדכונים...')}
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="projectHistoryEmpty">
            {view === 'recent'
              ? t('לא נמצאו עדכונים ב־24 השעות האחרונות.')
              : t('אין עדכונים עדיין')}
          </div>
        )}
        {items.map((item) => (
          <div className="historyItem" key={item.id}>
            <b>{t(item.new_status)}</b>
            <span>
              {item.profiles?.full_name || t('משתמש')} ·{' '}
              {new Date(item.created_at).toLocaleString('he-IL')}
            </span>
            {item.note && <p>{item.note}</p>}
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <nav className="projectHistoryPagination" aria-label={t('דפדוף בהיסטוריית העדכונים')}>
          <button
            type="button"
            className="projectHistoryPageStep"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1 || loading}
          >
            <ChevronRight size={15} />
            <span>{t('הקודם')}</span>
          </button>

          <div className="projectHistoryPageNumbers">
            {paginationPages(page, totalPages).map((pageNumber, index, pages) => (
              <span key={pageNumber}>
                {index > 0 && pageNumber - pages[index - 1] > 1 && (
                  <span className="projectHistoryPageEllipsis" aria-hidden="true">…</span>
                )}
                <button
                  type="button"
                  className={pageNumber === page ? 'active' : ''}
                  aria-current={pageNumber === page ? 'page' : undefined}
                  aria-label={t('עמוד {{value0}}', { value0: pageNumber })}
                  onClick={() => setPage(pageNumber)}
                  disabled={loading}
                >
                  {pageNumber}
                </button>
              </span>
            ))}
          </div>

          <button
            type="button"
            className="projectHistoryPageStep"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page === totalPages || loading}
          >
            <span>{t('הבא')}</span>
            <ChevronLeft size={15} />
          </button>
        </nav>
      )}
    </section>
  );
}
