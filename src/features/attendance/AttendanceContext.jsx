import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { useMessage } from '../../context/MessageContext.jsx';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh.js';
import * as attendanceFeatureApi from './api.js';
import { cacheOfflineData, getOfflineData } from '../../services/offlineStore.js';

const AttendanceContext = createContext(null);

export function AttendanceProvider({ children }) {
  const { profile, isManager, session } = useAuth();
  const { setMessage } = useMessage();
  const [workSessions, setWorkSessions] = useState([]);
  const [attendanceSessions, setAttendanceSessions] = useState([]);
  const [attendanceAvailable, setAttendanceAvailable] = useState(true);
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const [attendanceEndDialogOpen, setAttendanceEndDialogOpen] = useState(false);
  const [attendanceEndNote, setAttendanceEndNote] = useState('');
  const [projectWorkEndTarget, setProjectWorkEndTarget] = useState(null);
  const [projectWorkEndBusy, setProjectWorkEndBusy] = useState(false);
  const lastReconciledDateRef = useRef(null);

  async function loadWorkSessions() {
    try {
      const data = await attendanceFeatureApi.getWorkSessions(isManager);
      setWorkSessions(data);
      await cacheOfflineData(`work-sessions:${session?.user?.id}`, data);
    } catch (error) {
      const cached = await getOfflineData(`work-sessions:${session?.user?.id}`);
      if (cached) setWorkSessions(cached);
      else {
        setMessage(error instanceof Error ? error.message : String(error));
        setWorkSessions([]);
      }
    }
  }

  async function loadAttendanceSessions() {
    try {
      const data = await attendanceFeatureApi.getAttendanceSessions(isManager, session?.user?.id);
      setAttendanceAvailable(true);
      setAttendanceSessions(data);
      await cacheOfflineData(`attendance-sessions:${session?.user?.id}`, data);
    } catch (error) {
      console.warn('Attendance sessions load failed:', error instanceof Error ? error.message : error);
      const cached = await getOfflineData(`attendance-sessions:${session?.user?.id}`);
      setAttendanceAvailable(Boolean(cached));
      setAttendanceSessions(cached || []);
    }
  }

  useEffect(() => {
    if (!profile) {
      setWorkSessions([]);
      setAttendanceSessions([]);
      return;
    }
    let active = true;
    (async () => {
      try {
        await attendanceFeatureApi.closeStaleSessions();
      } catch (error) {
        // The database schedule remains the source of truth. This call is a
        // recovery path for devices returning after midnight or a missed job.
        console.warn('Stale attendance reconciliation failed:', error instanceof Error ? error.message : error);
      } finally {
        lastReconciledDateRef.current = new Date().toDateString();
      }
      if (active) await Promise.all([loadWorkSessions(), loadAttendanceSessions()]);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    if (!profile) return;

    let midnightTimer;
    const reconcile = async () => {
      try {
        await attendanceFeatureApi.closeStaleSessions();
        await Promise.all([loadWorkSessions(), loadAttendanceSessions()]);
      } catch (error) {
        console.warn('Midnight attendance reconciliation failed:', error instanceof Error ? error.message : error);
      } finally {
        lastReconciledDateRef.current = new Date().toDateString();
      }
    };
    const scheduleNextMidnight = () => {
      const next = new Date();
      next.setHours(24, 0, 5, 0);
      midnightTimer = window.setTimeout(async () => {
        await reconcile();
        scheduleNextMidnight();
      }, Math.max(1000, next.getTime() - Date.now()));
    };
    const onVisibilityChange = () => {
      const localDate = new Date().toDateString();
      if (document.visibilityState === 'visible' && lastReconciledDateRef.current !== localDate) reconcile();
    };

    scheduleNextMidnight();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearTimeout(midnightTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useRealtimeRefresh({
    enabled: Boolean(profile),
    channelName: 'infrastructure-tracker-attendance',
    tables: ['work_sessions', 'attendance_sessions'],
    onRefresh: () => Promise.all([loadWorkSessions(), loadAttendanceSessions()]),
    pollIntervalMs: 15000,
  });

  useEffect(() => {
    const reload = () => Promise.all([loadWorkSessions(), loadAttendanceSessions()]);
    window.addEventListener('maya-data-synced', reload);
    return () => window.removeEventListener('maya-data-synced', reload);
  });

  async function runMutation(promise) {
    const result = await promise;
    if (result?.message) setMessage(result.message);
    return result;
  }

  async function startWork(project) {
    const result = await runMutation(attendanceFeatureApi.startWork(project, profile));
    if (result?.offlineSession) setWorkSessions((items) => [result.offlineSession, ...items]);
    else await loadWorkSessions();
    return result;
  }

  function openProjectWorkEndDialog(project) {
    setProjectWorkEndTarget(project);
  }

  function closeProjectWorkEndDialog() {
    if (!projectWorkEndBusy) setProjectWorkEndTarget(null);
  }

  async function endWork({ endNote, crewMembers }) {
    if (!projectWorkEndTarget || projectWorkEndBusy) return null;
    setProjectWorkEndBusy(true);
    try {
      const result = await runMutation(
        attendanceFeatureApi.endWork(projectWorkEndTarget, profile, { endNote, crewMembers }),
      );
      if (result?.offlineChanges) {
        setWorkSessions((items) => items.map((item) => item.id === result.sessionId ? { ...item, ...result.offlineChanges } : item));
      } else await loadWorkSessions();
      if (result?.success) setProjectWorkEndTarget(null);
      return result;
    } finally {
      setProjectWorkEndBusy(false);
    }
  }

  async function startAttendance(attendanceType) {
    if (attendanceBusy) return null;
    setAttendanceBusy(true);
    try {
      const result = await runMutation(
        attendanceFeatureApi.startAttendance(attendanceType, { profile, attendanceSessions, attendanceAvailable }),
      );
      if (result?.offlineSession) setAttendanceSessions((items) => [result.offlineSession, ...items]);
      else await loadAttendanceSessions();
      return result;
    } finally {
      setAttendanceBusy(false);
    }
  }

  function openAttendanceEndDialog() {
    const openSession = myAttendanceSessions.find((item) => !item.ended_at && !item.is_all_day);
    if (!openSession) {
      setMessage('לא נמצאה משמרת כללית פתוחה.');
      return;
    }
    setAttendanceEndNote('');
    setAttendanceEndDialogOpen(true);
  }

  async function finishAttendance(endNote) {
    if (attendanceBusy) return null;
    setAttendanceBusy(true);
    try {
      const result = await runMutation(attendanceFeatureApi.finishAttendance(endNote, { profile, attendanceSessions }));
      if (result?.offlineChanges) {
        setAttendanceSessions((items) => items.map((item) => item.id === result.sessionId ? { ...item, ...result.offlineChanges } : item));
      } else await loadAttendanceSessions();
      if (result?.success) {
        setAttendanceEndDialogOpen(false);
        setAttendanceEndNote('');
      }
      return result;
    } finally {
      setAttendanceBusy(false);
    }
  }

  const myAttendanceSessions = useMemo(
    () => attendanceSessions.filter((item) => item.worker_id === session?.user?.id),
    [attendanceSessions, session?.user?.id],
  );

  const value = {
    workSessions,
    attendanceSessions,
    attendanceAvailable,
    attendanceBusy,
    attendanceEndDialogOpen,
    attendanceEndNote,
    setAttendanceEndNote,
    setAttendanceEndDialogOpen,
    myAttendanceSessions,
    startWork,
    endWork,
    projectWorkEndTarget,
    projectWorkEndBusy,
    openProjectWorkEndDialog,
    closeProjectWorkEndDialog,
    startAttendance,
    finishAttendance,
    openAttendanceEndDialog,
  };

  return <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>;
}

export function useAttendance() {
  const ctx = useContext(AttendanceContext);
  if (!ctx) throw new Error('useAttendance must be used within an AttendanceProvider');
  return ctx;
}
