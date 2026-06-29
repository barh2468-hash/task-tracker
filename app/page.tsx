'use client';

import { useEffect, useMemo, useState } from 'react';
import { Camera, CheckCircle, Clock, Download, FilePlus2, FolderKanban, History, LogOut, Pencil, PlayCircle, Search, Shield, Square, Trash2, Users, X } from 'lucide-react';
import { envReady, statusProgress, statuses, supabase } from '@/lib/supabase';

type Role = 'manager' | 'field_worker';
type Profile = { id: string; email: string | null; full_name: string; role: Role };
type ProjectPhoto = { id: string; project_id?: string; file_path: string; created_at: string };
type WorkSession = {
  id: string;
  project_id: string;
  worker_id: string;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  profiles?: { full_name: string; email: string | null } | null;
  projects?: { name: string; client_name: string | null; location: string } | null;
};
type ProjectWorkSession = Pick<WorkSession, 'id' | 'worker_id' | 'started_at' | 'ended_at'>;

type Project = {
  id: string;
  name: string;
  client_name: string | null;
  location: string;
  description: string | null;
  assigned_to: string | null;
  status: string;
  progress: number;
  due_date: string | null;
  updated_at: string;
  profiles?: { full_name: string } | null;
  project_photos?: ProjectPhoto[];
  work_sessions?: ProjectWorkSession[];
};
type StatusHistory = {
  id: string;
  project_id: string;
  old_status: string | null;
  new_status: string;
  note: string | null;
  created_at: string;
  profiles?: { full_name: string } | null;
  project_photos?: ProjectPhoto[];
};

type NewProject = {
  name: string;
  client_name: string;
  location: string;
  description: string;
  assigned_to: string;
  due_date: string;
};

const emptyProject: NewProject = { name: '', client_name: '', location: '', description: '', assigned_to: '', due_date: '' };

const roleLabel: Record<Role, string> = {
  manager: 'מנהל מערכת',
  field_worker: 'עובד שטח'
};

export default function Page() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workers, setWorkers] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [historyItems, setHistoryItems] = useState<StatusHistory[]>([]);
  const [workSessions, setWorkSessions] = useState<WorkSession[]>([]);
  const [tab, setTab] = useState<'mine' | 'all' | 'new' | 'history' | 'report'>('mine');
  const isManager = profile?.role === 'manager';
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [message, setMessage] = useState('');
  const [newProject, setNewProject] = useState<NewProject>(emptyProject);

  useEffect(() => {
    if (!envReady) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    loadProfileAndData();
  }, [session]);

  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel('infrastructure-tracker-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => loadProjects(profile))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'status_history' }, () => loadHistory())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_photos' }, () => loadProjects(profile))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_sessions' }, () => { loadProjects(profile); loadWorkSessions(profile); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  async function login() {
    setMessage('');
    if (!email || !password) {
      setMessage('יש למלא מייל וסיסמה.');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    setMessage(error ? translateAuthError(error.message) : 'התחברת בהצלחה.');
  }

  async function signup() {
    setMessage('');
    if (!email || !password) {
      setMessage('יש למלא מייל וסיסמה.');
      return;
    }
    if (password.length < 6) {
      setMessage('הסיסמה חייבת להכיל לפחות 6 תווים.');
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName || email.split('@')[0] } }
    });

    setMessage(error ? translateAuthError(error.message) : 'המשתמש נוצר. אם נדרש אישור מייל ב-Supabase, אשר את המשתמש דרך Authentication > Users.');
  }

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setProjects([]);
    setHistoryItems([]);
  }

  async function loadProfileAndData() {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    setMessage('');

    let { data: prof, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    // Safety fallback: if the profile was created manually and the app somehow fails to fetch by id,
    // try by email before creating a default field_worker profile.
    if (!prof && user.email && !profileError) {
      const byEmail = await supabase.from('profiles').select('*').eq('email', user.email).maybeSingle();
      prof = byEmail.data;
      profileError = byEmail.error;
    }

    if (!prof && !profileError) {
      const fullNameFromAuth = (user.user_metadata?.full_name as string) || user.email?.split('@')[0] || 'עובד שטח';
      const created = await supabase
        .from('profiles')
        .insert({ id: user.id, email: user.email, full_name: fullNameFromAuth, role: 'field_worker' })
        .select('*')
        .maybeSingle();
      prof = created.data;
      profileError = created.error;
    }

    if (!prof) {
      setProfile(null);
      setProjects([]);
      setHistoryItems([]);
      setMessage(profileError?.message || 'לא נמצא פרופיל למשתמש המחובר. בדוק את טבלת profiles ואת הרשאות RLS.');
      return;
    }

    const typedProfile = prof as Profile;
    setProfile(typedProfile);
    if (typedProfile.role === 'manager') setTab('all');
    await Promise.all([loadProjects(typedProfile), loadWorkers(typedProfile), loadHistory(typedProfile), loadWorkSessions(typedProfile)]);
  }

  async function loadWorkers(activeProfile = profile) {
    if (activeProfile?.role !== 'manager') {
      setWorkers([]);
      return;
    }
    const { data, error } = await supabase.from('profiles').select('*').order('full_name');
    if (error) {
      setMessage(error.message);
      setWorkers([]);
      return;
    }
    setWorkers((data || []) as Profile[]);
  }

  async function loadProjects(activeProfile = profile) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user || !activeProfile) return;

    let request = supabase
      .from('projects')
      .select('*, profiles:assigned_to(full_name), project_photos(id,file_path,created_at), work_sessions(id,worker_id,started_at,ended_at)')
      .order('updated_at', { ascending: false });

    if (activeProfile.role !== 'manager') request = request.eq('assigned_to', user.id);

    const { data, error } = await request;
    if (error) setMessage(error.message);
    setProjects((data || []) as Project[]);
  }

  async function loadHistory(_activeProfile = profile) {
    const { data } = await supabase
      .from('status_history')
      .select('*, profiles:changed_by(full_name)')
      .order('created_at', { ascending: false })
      .limit(100);
    setHistoryItems((data || []) as StatusHistory[]);
  }

  async function loadWorkSessions(activeProfile = profile) {
    if (activeProfile?.role !== 'manager') {
      setWorkSessions([]);
      return;
    }

    const { data, error } = await supabase
      .from('work_sessions')
      .select('*, profiles:worker_id(full_name,email), projects:project_id(name,client_name,location)')
      .order('started_at', { ascending: false });

    if (error) {
      setMessage(error.message);
      setWorkSessions([]);
      return;
    }

    setWorkSessions((data || []) as WorkSession[]);
  }

  async function startWork(project: Project) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const openSession = project.work_sessions?.find((w) => w.worker_id === user.id && !w.ended_at);
    if (openSession) {
      setMessage('כבר קיימת שעת התחלה פתוחה לפרויקט הזה. לחץ סיים עבודה כדי לסגור אותה.');
      return;
    }

    const { error } = await supabase.from('work_sessions').insert({
      project_id: project.id,
      worker_id: user.id,
      started_at: new Date().toISOString()
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.from('status_history').insert({
      project_id: project.id,
      old_status: null,
      new_status: 'התחלת עבודה',
      changed_by: user.id,
      note: `שעת התחלה: ${new Date().toLocaleString('he-IL')}`
    });

    setMessage(`נרשמה שעת התחלה עבור ${project.name}`);
    await Promise.all([loadProjects(), loadHistory(), loadWorkSessions()]);
  }

  async function endWork(project: Project) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const openSession = project.work_sessions?.find((w) => w.worker_id === user.id && !w.ended_at);
    if (!openSession) {
      setMessage('לא נמצאה שעת התחלה פתוחה לפרויקט הזה.');
      return;
    }

    const endedAt = new Date();
    const startedAt = new Date(openSession.started_at);
    const minutes = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));

    const { error } = await supabase
      .from('work_sessions')
      .update({ ended_at: endedAt.toISOString() })
      .eq('id', openSession.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.from('status_history').insert({
      project_id: project.id,
      old_status: null,
      new_status: 'סיום עבודה',
      changed_by: user.id,
      note: `שעת סיום: ${endedAt.toLocaleString('he-IL')} · זמן עבודה: ${formatDuration(minutes)}`
    });

    setMessage(`נרשמה שעת סיום עבור ${project.name}. זמן עבודה: ${formatDuration(minutes)}`);
    await Promise.all([loadProjects(), loadHistory(), loadWorkSessions()]);
  }

  function exportWorkReport() {
    if (!workSessions.length) {
      setMessage('אין נתוני שעות לייצוא כרגע.');
      return;
    }

    const rows = buildWorkReportRows(workSessions);
    const headers = ['עובד', 'מייל', 'פרויקט', 'לקוח', 'מיקום', 'מספר ימים', 'סה״כ דקות', 'סה״כ שעות', 'כניסות פתוחות'];
    const csvRows = [headers, ...rows.map((r) => [r.workerName, r.email, r.projectName, r.clientName, r.location, String(r.days), String(r.totalMinutes), formatHoursDecimal(r.totalMinutes), String(r.openSessions)])];
    const csv = '\uFEFF' + csvRows.map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `דוח-שעות-עובדים-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function updateStatus(project: Project, newStatus: string, note: string) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const nextProgress = statusProgress[newStatus] ?? project.progress;
    const { error } = await supabase
      .from('projects')
      .update({ status: newStatus, progress: nextProgress })
      .eq('id', project.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    const { error: historyError } = await supabase.from('status_history').insert({
      project_id: project.id,
      old_status: project.status,
      new_status: newStatus,
      changed_by: user.id,
      note: note || 'עדכון סטטוס מהשטח'
    });

    if (historyError) {
      setMessage(historyError.message);
      return;
    }

    // Email notifications are sent when a field worker changes status.
    // If the Edge Function is not configured yet, the status update still succeeds.
    if (profile?.role === 'field_worker') {
      const { error: notifyError } = await supabase.functions.invoke('notify-status-change', {
        body: {
          projectId: project.id,
          projectName: project.name,
          clientName: project.client_name,
          location: project.location,
          oldStatus: project.status,
          newStatus,
          note: note || '',
          changedByName: profile.full_name,
          changedByEmail: profile.email,
          changedByRole: profile.role,
          appUrl: typeof window !== 'undefined' ? window.location.origin : ''
        }
      });

      if (notifyError) {
        console.warn('Email notification failed:', notifyError.message);
        setMessage(`הסטטוס עודכן ל: ${newStatus}. שים לב: התראת המייל לא נשלחה (${notifyError.message}).`);
        await Promise.all([loadProjects(), loadHistory()]);
        return;
      }
    }

    setMessage(`הסטטוס של ${project.name} עודכן ל: ${newStatus}`);
    await Promise.all([loadProjects(), loadHistory()]);
  }

  async function uploadPhoto(projectId: string, file: File) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `${projectId}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from('project-photos').upload(path, file, { upsert: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.from('project_photos').insert({ project_id: projectId, uploaded_by: user.id, file_path: path });
    await supabase.from('status_history').insert({ project_id: projectId, old_status: null, new_status: 'הועלתה תמונה', changed_by: user.id, note: file.name });
    setMessage('התמונה הועלתה ונשמרה בפרויקט');
    await loadHistory();
  }


  async function saveProject(projectId: string, changes: Partial<NewProject & { status: string; progress: number }>) {
    if (profile?.role !== 'manager') return;

    const payload = {
      name: changes.name,
      client_name: changes.client_name || null,
      location: changes.location,
      description: changes.description || null,
      assigned_to: changes.assigned_to || null,
      due_date: changes.due_date || null
    };

    const { error } = await supabase.from('projects').update(payload).eq('id', projectId);
    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage('הפרויקט עודכן בהצלחה');
    await loadProjects();
  }

  async function deleteProject(project: Project) {
    if (profile?.role !== 'manager') return;
    const ok = window.confirm(`למחוק את הפרויקט "${project.name}"? פעולה זו תמחק גם היסטוריה ותמונות שמקושרות אליו.`);
    if (!ok) return;

    const { error } = await supabase.from('projects').delete().eq('id', project.id);
    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage('הפרויקט נמחק');
    await Promise.all([loadProjects(), loadHistory()]);
  }

  async function createProject() {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user || profile?.role !== 'manager') return;
    if (!newProject.name || !newProject.location || !newProject.assigned_to) {
      setMessage('חובה למלא שם פרויקט, מיקום ושיוך לעובד.');
      return;
    }

    const { error } = await supabase.from('projects').insert({
      ...newProject,
      due_date: newProject.due_date || null,
      client_name: newProject.client_name || null,
      description: newProject.description || null,
      created_by: user.id,
      status: 'בעבודה בשטח',
      progress: 25
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setNewProject(emptyProject);
    setTab('all');
    setMessage('הפרויקט נוצר ושויך לעובד השטח');
    await loadProjects();
  }

  const visibleProjects = useMemo(() => {
    return projects.filter((p) => {
      const text = `${p.name} ${p.location} ${p.client_name || ''} ${p.description || ''}`.toLowerCase();
      const okQuery = !query || text.includes(query.toLowerCase());
      const okStatus = !statusFilter || p.status === statusFilter;
      const okTab = tab !== 'mine' || profile?.role !== 'manager' || p.assigned_to === session?.user?.id;
      return okQuery && okStatus && okTab;
    });
  }, [projects, query, statusFilter, tab, profile, session]);

  const stats = useMemo(() => ({
    total: projects.length,
    field: projects.filter((p) => p.status === 'בעבודה בשטח').length,
    gpr: projects.filter((p) => p.status === 'נדרש GPR').length,
    done: projects.filter((p) => p.status === 'הושלם').length
  }), [projects]);

  if (!envReady) return <SetupScreen />;

  if (!session) {
    return <main className="login">
      <section className="card">
        <img src="/logo.png" alt="לוגו" />
        <h1>מערכת איתור תשתיות</h1>
        <p className="muted">כניסה מאובטחת עם מייל וסיסמה לעובדי שטח ומנהלים</p>
        <div className="form" style={{ marginTop: 22, textAlign: 'right' }}>
          <label>מייל ארגוני<input type="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>סיסמה<input type="password" placeholder="לפחות 6 תווים" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <label>שם מלא להרשמה ראשונית<input placeholder="שם העובד, אופציונלי" value={fullName} onChange={(e) => setFullName(e.target.value)} /></label>
          <button onClick={login}>כניסה למערכת</button>
          <button className="secondary" onClick={signup}>הרשמה ראשונית עם סיסמה</button>
          <p className="muted">למניעת מגבלת מיילים: מומלץ שהמנהל ייצור עובדים דרך Supabase Authentication עם סיסמה קבועה, ואז העובד פשוט נכנס כאן.</p>
          {message && <p className="muted">{message}</p>}
        </div>
      </section>
    </main>;
  }

  return <main className="page">
    <header className="topbar">
      <div className="brand">
        <img src="/logo.png" alt="לוגו" />
        <div>
          <h1>מערכת איתור תשתיות</h1>
          <p>מעקב פרויקטים לעובדי שטח, שרטוט, GPR והיתרים</p>
        </div>
      </div>
      <div className="userRow">
        <div className="avatar">{profile?.full_name?.[0] || 'ע'}</div>
        <div><b>{profile?.full_name || session?.user?.email}</b><p className="muted">{profile ? roleLabel[profile.role] : 'משתמש'}</p></div>
        <button className="secondary" onClick={logout}><LogOut size={16} /> יציאה</button>
      </div>
    </header>

    <section className="container layout">
      <aside className="sidebar">
        <div className="logoBox"><img src="/logo.png" alt="לוגו" /><b>תשתיות<br />מתקדמות</b></div>
        <button className={`navBtn ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}><span>הפרויקטים שלי</span><FolderKanban size={18} /></button>
        {isManager && <button className={`navBtn ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}><span>כל הפרויקטים</span><Users size={18} /></button>}
        {isManager && <button className={`navBtn ${tab === 'new' ? 'active' : ''}`} onClick={() => setTab('new')}><span>הוספת פרויקט</span><FilePlus2 size={18} /></button>}
        <button className={`navBtn ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}><span>היסטוריית שינויים</span><History size={18} /></button>
        {isManager && <button className={`navBtn ${tab === 'report' ? 'active' : ''}`} onClick={() => setTab('report')}><span>דוח שעות עובדים</span><Download size={18} /></button>}
        <p style={{ marginTop: 30, color: 'rgba(255,255,255,.72)', lineHeight: 1.7 }}>מותאם לאייפון, אנדרואיד ומחשב. עדכונים בזמן אמת דרך Supabase.</p>
      </aside>

      <section>
        <div className="grid">
          <Stat number={stats.total} label="סה״כ פרויקטים" icon={<FolderKanban />} />
          <Stat number={stats.field} label="בעבודה בשטח" icon={<Clock />} />
          <Stat number={stats.gpr} label="נדרש GPR" icon={<Shield />} />
          <Stat number={stats.done} label="הושלמו" icon={<CheckCircle />} />
        </div>

        {profile && <div className="card message">מחובר כ: {profile.email} · הרשאה: {profile ? roleLabel[profile.role] : 'משתמש'}</div>}
        {message && <div className="card message">{message}</div>}

        {tab === 'new' && isManager && <NewProjectForm project={newProject} setProject={setNewProject} workers={workers} createProject={createProject} />}
        {tab === 'history' && <HistoryPanel historyItems={historyItems} projects={projects} />}
        {tab === 'report' && isManager && <WorkReportPanel workSessions={workSessions} exportWorkReport={exportWorkReport} />}
        {tab !== 'new' && tab !== 'history' && tab !== 'report' && <section className="card">
          <div className="toolbar">
            <div style={{ minWidth: 260, flex: 1 }}><input placeholder="חיפוש לפי שם, לקוח או מיקום..." value={query} onChange={(e) => setQuery(e.target.value)} /></div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ maxWidth: 220 }}>
              <option value="">כל הסטטוסים</option>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className="ghost"><Search size={16} /> סינון</button>
          </div>
          <h2>{tab === 'mine' && !isManager ? 'הפרויקטים שלי' : 'כל הפרויקטים'}</h2>
          <div className="projects">
            {visibleProjects.length === 0 && <div className="empty">אין פרויקטים להצגה כרגע</div>}
            {visibleProjects.map((project) => <ProjectCard key={project.id} project={project} historyItems={historyItems.filter((h) => h.project_id === project.id).slice(0, 4)} updateStatus={updateStatus} uploadPhoto={uploadPhoto} isManager={isManager} workers={workers} saveProject={saveProject} deleteProject={deleteProject} currentUserId={session?.user?.id} startWork={startWork} endWork={endWork} />)}
          </div>
        </section>}
      </section>
    </section>
  </main>;
}


function translateAuthError(message: string) {
  if (message.toLowerCase().includes('invalid login credentials')) return 'מייל או סיסמה לא נכונים.';
  if (message.toLowerCase().includes('email not confirmed')) return 'המייל עדיין לא מאושר. אשר את המשתמש ב-Supabase תחת Authentication > Users.';
  if (message.toLowerCase().includes('password')) return message;
  return message;
}

function Stat({ number, label, icon }: { number: number; label: string; icon: React.ReactNode }) {
  return <div className="stat"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong>{number}</strong>{icon}</div><span>{label}</span></div>;
}

function NewProjectForm({ project, setProject, workers, createProject }: { project: NewProject; setProject: (p: NewProject) => void; workers: Profile[]; createProject: () => void }) {
  return <section className="card form">
    <h2>הוספת פרויקט חדש</h2>
    <div className="formGrid">
      <label>שם פרויקט<input value={project.name} onChange={(e) => setProject({ ...project, name: e.target.value })} placeholder="לדוגמה: כביש 531 - קטע צפוני" /></label>
      <label>לקוח<input value={project.client_name} onChange={(e) => setProject({ ...project, client_name: e.target.value })} placeholder="לדוגמה: עיריית הרצליה" /></label>
      <label>מיקום<input value={project.location} onChange={(e) => setProject({ ...project, location: e.target.value })} placeholder="עיר / רחוב / אזור" /></label>
      <label>שיוך לעובד שטח<select value={project.assigned_to} onChange={(e) => setProject({ ...project, assigned_to: e.target.value })}>
        <option value="">בחר עובד</option>
        {workers.map((w) => <option key={w.id} value={w.id}>{w.full_name} - {w.email}</option>)}
      </select></label>
      <label>תאריך יעד<input type="date" value={project.due_date} onChange={(e) => setProject({ ...project, due_date: e.target.value })} /></label>
    </div>
    <label>תיאור העבודה<textarea value={project.description} onChange={(e) => setProject({ ...project, description: e.target.value })} placeholder="פירוט איתור תשתיות, דרישות לקוח, חסמים וכו׳" /></label>
    <button onClick={createProject}>צור פרויקט ושייך לעובד</button>
  </section>;
}

function ProjectCard({ project, historyItems, updateStatus, uploadPhoto, isManager, workers, saveProject, deleteProject, currentUserId, startWork, endWork }: { project: Project; historyItems: StatusHistory[]; updateStatus: (p: Project, s: string, n: string) => void; uploadPhoto: (projectId: string, file: File) => void; isManager: boolean; workers: Profile[]; saveProject: (projectId: string, changes: NewProject) => void; deleteProject: (project: Project) => void; currentUserId?: string; startWork: (project: Project) => void; endWork: (project: Project) => void }) {
  const [status, setStatus] = useState(project.status);
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(false);
  const [editProject, setEditProject] = useState<NewProject>({
    name: project.name,
    client_name: project.client_name || '',
    location: project.location,
    description: project.description || '',
    assigned_to: project.assigned_to || '',
    due_date: project.due_date || ''
  });
  useEffect(() => {
    setStatus(project.status);
    setEditProject({
      name: project.name,
      client_name: project.client_name || '',
      location: project.location,
      description: project.description || '',
      assigned_to: project.assigned_to || '',
      due_date: project.due_date || ''
    });
  }, [project]);

  const myOpenSession = project.work_sessions?.find((w) => w.worker_id === currentUserId && !w.ended_at);
  const lastEndedSession = project.work_sessions
    ?.filter((w) => w.worker_id === currentUserId && w.ended_at)
    .sort((a, b) => new Date(b.ended_at || '').getTime() - new Date(a.ended_at || '').getTime())[0];

  if (editing) {
    return <article className="project editProject">
      <div className="editHeader">
        <h3>עריכת פרויקט</h3>
        <button className="ghost smallBtn" onClick={() => setEditing(false)}><X size={16} /> ביטול</button>
      </div>
      <div className="formGrid editGrid">
        <label>שם פרויקט<input value={editProject.name} onChange={(e) => setEditProject({ ...editProject, name: e.target.value })} /></label>
        <label>לקוח<input value={editProject.client_name} onChange={(e) => setEditProject({ ...editProject, client_name: e.target.value })} /></label>
        <label>מיקום<input value={editProject.location} onChange={(e) => setEditProject({ ...editProject, location: e.target.value })} /></label>
        <label>שיוך לעובד<select value={editProject.assigned_to} onChange={(e) => setEditProject({ ...editProject, assigned_to: e.target.value })}>
          <option value="">לא משויך</option>
          {workers.map((w) => <option key={w.id} value={w.id}>{w.full_name} - {w.email}</option>)}
        </select></label>
        <label>תאריך יעד<input type="date" value={editProject.due_date} onChange={(e) => setEditProject({ ...editProject, due_date: e.target.value })} /></label>
      </div>
      <label>תיאור<textarea value={editProject.description} onChange={(e) => setEditProject({ ...editProject, description: e.target.value })} /></label>
      <div className="actionsRow">
        <button onClick={() => { saveProject(project.id, editProject); setEditing(false); }}>שמור שינויים</button>
        <button className="danger" onClick={() => deleteProject(project)}><Trash2 size={16} /> מחיקת פרויקט</button>
      </div>
    </article>;
  }

  return <article className="project">
    <div>
      <div className="title">{project.name}</div>
      <div className="muted">{project.client_name || 'ללא לקוח'} · {project.description || 'אין תיאור'}</div>
      <div className="muted">עובד אחראי: {project.profiles?.full_name || 'לא משויך'}</div>
      {isManager && <div className="actionsRow cardActions">
        <button className="ghost smallBtn" onClick={() => setEditing(true)}><Pencil size={16} /> עריכה</button>
        <button className="danger ghost smallBtn" onClick={() => deleteProject(project)}><Trash2 size={16} /> מחיקה</button>
      </div>}
    </div>
    <div>
      <StatusPill status={project.status} />
      <div className="muted" style={{ marginTop: 10 }}>{project.location}</div>
      <div className="muted">עודכן: {new Date(project.updated_at).toLocaleDateString('he-IL')}</div>
    </div>
    <div>
      <b>{project.progress}% התקדמות</b>
      <div className="progress"><i style={{ width: `${project.progress}%` }} /></div>
      <div className="muted">יעד: {project.due_date ? new Date(project.due_date).toLocaleDateString('he-IL') : 'לא הוגדר'}</div>
      <PhotoGallery photos={project.project_photos || []} />
    </div>
    <div className="form">
      <div className="timeBox">
        {myOpenSession ? <>
          <div><b>עבודה פעילה</b><br /><span className="muted">התחלה: {new Date(myOpenSession.started_at).toLocaleString('he-IL')}</span></div>
          <button className="smallBtn danger" onClick={() => endWork(project)}><Square size={15} /> סיים עבודה</button>
        </> : <>
          <div><b>שעות עבודה</b><br /><span className="muted">{lastEndedSession ? `סיום אחרון: ${new Date(lastEndedSession.ended_at || '').toLocaleString('he-IL')}` : 'לא נרשמה עבודה פתוחה'}</span></div>
          <button className="smallBtn" onClick={() => startWork(project)}><PlayCircle size={15} /> התחל עבודה</button>
        </>}
      </div>
      <select value={status} onChange={(e) => setStatus(e.target.value)}>{statuses.map((s) => <option key={s} value={s}>{s}</option>)}</select>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="הערה לעדכון, אופציונלי" />
      <button className="smallBtn" onClick={() => { updateStatus(project, status, note); setNote(''); }}>עדכן סטטוס</button>
      <label className="smallBtn secondary" style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Camera size={16} /> העלאת תמונה<input className="photoInput" style={{ display: 'none' }} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadPhoto(project.id, e.target.files[0])} /></label>
    </div>
    <div className="history">
      <b>עדכונים אחרונים</b>
      {historyItems.length === 0 && <div className="muted">אין עדכונים עדיין</div>}
      {historyItems.map((h) => <div className="historyItem" key={h.id}>• {h.new_status}<br /><span>{h.profiles?.full_name || 'משתמש'} · {new Date(h.created_at).toLocaleString('he-IL')}</span>{h.note && <><br /><span>{h.note}</span></>}</div>)}
    </div>
  </article>;
}

function PhotoGallery({ photos }: { photos: ProjectPhoto[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    async function loadUrls() {
      const next: Record<string, string> = {};
      for (const photo of photos) {
        const { data } = await supabase.storage.from('project-photos').createSignedUrl(photo.file_path, 60 * 60);
        if (data?.signedUrl) next[photo.id] = data.signedUrl;
      }
      if (!cancelled) setUrls(next);
    }
    loadUrls();
    return () => { cancelled = true; };
  }, [photos]);

  if (!photos.length) return <div className="muted photosEmpty">אין תמונות בפרויקט</div>;

  return <div className="photos">
    {photos.slice(0, 4).map((photo) => urls[photo.id] ? <a key={photo.id} href={urls[photo.id]} target="_blank" rel="noreferrer"><img src={urls[photo.id]} alt="תמונת שטח" /></a> : <div key={photo.id} className="photoSkeleton" />)}
  </div>;
}

function StatusPill({ status }: { status: string }) {
  const cls = status === 'הושלם' ? 'done' : status === 'עבר לשרטוט' ? 'drafting' : status === 'נדרש GPR' ? 'gpr' : status === 'מחכה להיתרים' ? 'permits' : 'field';
  return <span className={`pill ${cls}`}>{status}</span>;
}


function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours <= 0) return `${mins} דק׳`;
  return `${hours} שעות ו-${mins} דק׳`;
}

function formatHoursDecimal(minutes: number) {
  return (minutes / 60).toFixed(2);
}

function csvEscape(value: string) {
  const text = value ?? '';
  return `"${text.replace(/"/g, '""')}"`;
}

function buildWorkReportRows(workSessions: WorkSession[]) {
  const map = new Map<string, {
    workerName: string;
    email: string;
    projectName: string;
    clientName: string;
    location: string;
    totalMinutes: number;
    daysSet: Set<string>;
    openSessions: number;
  }>();

  for (const item of workSessions) {
    const key = `${item.worker_id}_${item.project_id}`;
    const started = new Date(item.started_at);
    const ended = item.ended_at ? new Date(item.ended_at) : new Date();
    const minutes = Math.max(0, Math.round((ended.getTime() - started.getTime()) / 60000));
    const existing = map.get(key) || {
      workerName: item.profiles?.full_name || 'עובד',
      email: item.profiles?.email || '',
      projectName: item.projects?.name || 'פרויקט',
      clientName: item.projects?.client_name || '',
      location: item.projects?.location || '',
      totalMinutes: 0,
      daysSet: new Set<string>(),
      openSessions: 0
    };

    existing.totalMinutes += minutes;
    existing.daysSet.add(started.toISOString().slice(0, 10));
    if (!item.ended_at) existing.openSessions += 1;
    map.set(key, existing);
  }

  return Array.from(map.values())
    .map((r) => ({ ...r, days: r.daysSet.size }))
    .sort((a, b) => a.workerName.localeCompare(b.workerName, 'he'));
}

function WorkReportPanel({ workSessions, exportWorkReport }: { workSessions: WorkSession[]; exportWorkReport: () => void }) {
  const rows = useMemo(() => buildWorkReportRows(workSessions), [workSessions]);
  const totalMinutes = rows.reduce((sum, row) => sum + row.totalMinutes, 0);

  return <section className="card">
    <div className="reportHeader">
      <div>
        <h2>דוח שעות עובדים</h2>
        <p className="muted">סיכום שעות לפי עובד ופרויקט. הקובץ יורד כ-CSV ונפתח באקסל.</p>
      </div>
      <button onClick={exportWorkReport}><Download size={16} /> ייצוא לאקסל</button>
    </div>
    <div className="reportStats">
      <Stat number={rows.length} label="שורות בדוח" icon={<Users />} />
      <Stat number={Math.round((totalMinutes / 60) * 10) / 10} label="סה״כ שעות" icon={<Clock />} />
    </div>
    <div className="tableWrap">
      <table className="reportTable">
        <thead><tr><th>עובד</th><th>פרויקט</th><th>לקוח</th><th>מיקום</th><th>ימים</th><th>זמן עבודה</th><th>פתוח</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={7}>אין עדיין נתוני שעות</td></tr>}
          {rows.map((row) => <tr key={`${row.email}_${row.projectName}`}>
            <td><b>{row.workerName}</b><br /><span className="muted">{row.email}</span></td>
            <td>{row.projectName}</td>
            <td>{row.clientName || '-'}</td>
            <td>{row.location || '-'}</td>
            <td>{row.days}</td>
            <td>{formatDuration(row.totalMinutes)}<br /><span className="muted">{formatHoursDecimal(row.totalMinutes)} שעות</span></td>
            <td>{row.openSessions ? `${row.openSessions} פתוח` : '-'}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </section>;
}

function HistoryPanel({ historyItems, projects }: { historyItems: StatusHistory[]; projects: Project[] }) {
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name || 'פרויקט';
  return <section className="card">
    <h2>היסטוריית שינויים</h2>
    <div className="projects">
      {historyItems.length === 0 && <div className="empty">אין היסטוריה להצגה</div>}
      {historyItems.map((h) => <div className="historyItem" key={h.id}><b>{projectName(h.project_id)}</b> · {h.new_status}<br /><span className="muted">{h.profiles?.full_name || 'משתמש'} · {new Date(h.created_at).toLocaleString('he-IL')}</span>{h.note && <p className="muted">{h.note}</p>}</div>)}
    </div>
  </section>;
}

function SetupScreen() {
  return <main className="login">
    <section className="card">
      <img src="/logo.png" alt="לוגו" />
      <h1>נדרש חיבור Supabase</h1>
      <p className="muted">צור קובץ <b>.env.local</b> בתיקיית הפרויקט והוסף את הפרטים מ-Supabase:</p>
      <pre className="setupCode">NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co{`\n`}NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY</pre>
    </section>
  </main>;
}
