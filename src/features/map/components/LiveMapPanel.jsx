import { useTranslation } from 'react-i18next';
import { t } from '../../language/LanguageContext.jsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, FolderKanban } from 'lucide-react';
import { useProjects } from '../../projects/ProjectsContext.jsx';
import { useAttendance } from '../../attendance/AttendanceContext.jsx';
import { mapsLink, toDateInputValue } from '../../../utils/format.js';

export default function LiveMapPanel({ onOpenProject }) {
  useTranslation();
  const { projects } = useProjects();
  const { workSessions } = useAttendance();
  const mapElementRef = useRef(null);
  const leafletMapRef = useRef(null);
  const [selectedPointId, setSelectedPointId] = useState(null);
  const [mapError, setMapError] = useState('');
  const [mapDay, setMapDay] = useState(() => toDateInputValue(new Date()));

  useEffect(() => {
    const now = new Date();
    const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timeout = window.setTimeout(
      () => setMapDay(toDateInputValue(new Date())),
      nextDay.getTime() - now.getTime() + 250,
    );
    return () => window.clearTimeout(timeout);
  }, [mapDay]);

  const points = useMemo(() => {
    const result = [];
    const workersOnMap = new Set();
    const sorted = workSessions
      .filter((session) => toDateInputValue(new Date(session.started_at)) === mapDay)
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

    const addSession = (session, isActive) => {
      if (workersOnMap.has(session.worker_id)) return;
      const lat = isActive ? session.started_lat : (session.ended_lat ?? session.started_lat);
      const lng = isActive ? session.started_lng : (session.ended_lng ?? session.started_lng);
      const accuracy = isActive
        ? session.started_accuracy
        : (session.ended_accuracy ?? session.started_accuracy);
      if (typeof lat !== 'number' || typeof lng !== 'number') return;

      workersOnMap.add(session.worker_id);
      result.push({
        id: session.id,
        workerId: session.worker_id,
        workerName: session.profiles?.full_name || t('עובד שטח'),
        projectId: session.project_id,
        projectName: session.projects?.name || t('פרויקט'),
        projectLocation: session.projects?.location || '',
        lat,
        lng,
        accuracy,
        reportedAt: session.ended_at || session.started_at,
        isActive,
      });
    };

    sorted.filter((session) => !session.ended_at).forEach((session) => addSession(session, true));
    sorted.filter((session) => session.ended_at).forEach((session) => addSession(session, false));
    return result.slice(0, 60);
  }, [workSessions, mapDay]);

  const selectedPoint = points.find((point) => point.id === selectedPointId) || points[0] || null;
  const activeCount = points.filter((point) => point.isActive).length;

  function focusMapPoint(point) {
    setSelectedPointId(point.id);
    leafletMapRef.current?.flyTo([point.lat, point.lng], 17, {
      animate: true,
      duration: 0.65,
    });
  }

  useEffect(() => {
    if (!mapElementRef.current) return;
    setMapError('');

    try {
      mapElementRef.current.innerHTML = '';
      const map = L.map(mapElementRef.current, {
        zoomControl: true,
        attributionControl: true,
      });
      leafletMapRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      if (points.length === 0) {
        map.setView([31.77, 35.21], 8);
      } else {
        points.forEach((point) => {
          const markerIcon = L.divIcon({
            className: 'liveMapMarkerWrap',
            html: `<span class="liveMapMarker ${point.isActive ? 'active' : 'recent'}"><span></span></span>`,
            iconSize: [38, 38],
            iconAnchor: [19, 19],
          });
          const marker = L.marker([point.lat, point.lng], { icon: markerIcon }).addTo(map);
          const tooltip = document.createElement('span');
          tooltip.textContent = `${point.workerName} · ${point.projectName}`;
          marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -14] });
          marker.on('click', () => focusMapPoint(point));
        });
        const initialPoint = selectedPoint || points[0];
        map.setView([initialPoint.lat, initialPoint.lng], 17);
      }

      return () => {
        map.remove();
        leafletMapRef.current = null;
      };
    } catch {
      setMapError('לא ניתן לטעון את שכבת המפה כרגע.');
      return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  return (
    <section className="liveMapPanel">
      <div className="liveMapHeader">
        <div>
          <span className="eyebrow">FIELD CONTROL</span>
          <h2>{t('מפת פעילות בשטח')}</h2>
          <p>{t('מוצגים רק דיווחי היום. עובדים פעילים בירוק ודיווחים שהסתיימו בכחול.')}</p>
        </div>
        <div className="liveMapStats">
          <span>
            <b>{activeCount}</b>
            {t('פעילים עכשיו')}
          </span>
          <span>
            <b>{points.length}</b>
            {t('נקודות עובדים')}
          </span>
        </div>
      </div>

      <div className="liveMapLayout">
        <div className="liveMapCanvasWrap">
          <div ref={mapElementRef} className="liveMapCanvas" aria-label={t('מפת מיקומי עובדים')} />
          {mapError && <div className="liveMapError">{mapError}</div>}
          <div className="liveMapLegend" aria-hidden="true">
            <span>
              <i className="active" />
              {t('עבודה פעילה')}
            </span>
            <span>
              <i className="recent" />
              {t('דיווח אחרון')}
            </span>
          </div>
        </div>

        <aside className="liveMapSidebar">
          <div className="liveMapSidebarTitle">
            <b>{t('עובדים על המפה')}</b>
            <span>
              {points.length}
              {t('מיקומים')}
            </span>
          </div>
          <div className="liveMapPeople">
            {points.length === 0 && (
              <div className="liveMapEmpty">
                <MapPin size={28} />
                <b>{t('עדיין אין מיקומים להצגה')}</b>
                <span>{t('המפה תתעדכן כאשר עובד יתחיל או יסיים עבודה עם הרשאת מיקום.')}</span>
              </div>
            )}
            {points.map((point) => (
              <button
                key={point.id}
                className={`liveMapPerson ${selectedPoint?.id === point.id ? 'selected' : ''}`}
                onClick={() => focusMapPoint(point)}
              >
                <span className={`liveMapAvatar ${point.isActive ? 'active' : ''}`}>
                  {point.workerName[0] || t('ע')}
                </span>
                <span>
                  <b>{point.workerName}</b>
                  <small>{point.projectName}</small>
                  <em>
                    {point.isActive
                      ? t('פעיל עכשיו')
                      : t('דיווח אחרון: {{value0}}', {
                          value0: new Date(point.reportedAt).toLocaleString('he-IL'),
                        })}
                  </em>
                </span>
              </button>
            ))}
          </div>

          {selectedPoint && (
            <div className="liveMapSelection">
              <span className={`liveMapStatus ${selectedPoint.isActive ? 'active' : ''}`}>
                {selectedPoint.isActive ? t('עבודה פעילה') : t('מיקום אחרון')}
              </span>
              <h3>{selectedPoint.projectName}</h3>
              <p>
                <MapPin size={15} /> {selectedPoint.projectLocation || t('לא הוגדרה כתובת')}
              </p>
              <small>
                {t('דווח')}
                {new Date(selectedPoint.reportedAt).toLocaleString('he-IL')}
                {typeof selectedPoint.accuracy === 'number'
                  ? t(' · דיוק כ־{{value0}} מ׳', { value0: Math.round(selectedPoint.accuracy) })
                  : ''}
              </small>
              <div className="liveMapActions">
                <button
                  onClick={() => {
                    const project = projects.find((item) => item.id === selectedPoint.projectId);
                    if (project) onOpenProject?.(project);
                  }}
                >
                  <FolderKanban size={16} />
                  {t('פתיחת הפרויקט')}
                </button>
                <a
                  href={mapsLink(selectedPoint.lat, selectedPoint.lng)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('ניווט לנקודה')}
                </a>
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
