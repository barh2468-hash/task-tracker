import { useAttendance } from '../AttendanceContext.jsx';
import { useAuth } from '../../auth/useAuth.js';
import WorkDiaryPanel from '../../work-diary/components/WorkDiaryPanel.jsx';

export default function ExitWorkDiary() {
  const { workDiaryTarget, closeWorkDiary } = useAttendance();
  const { profile } = useAuth();
  if (!workDiaryTarget) return null;
  return <WorkDiaryPanel key={workDiaryTarget.id} project={workDiaryTarget} currentUserName={profile?.full_name || ''} canDelete={false} autoOpen onClose={closeWorkDiary} />;
}
