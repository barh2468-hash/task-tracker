import * as authApi from '../../services/api/auth.js';
import * as projectsApi from '../../services/api/projects.js';
import * as projectWorkersApi from '../../services/api/projectWorkers.js';
import * as projectTasksApi from '../../services/api/projectTasks.js';
import * as projectPhotosApi from '../../services/api/projectPhotos.js';
import * as projectReviewFilesApi from '../../services/api/projectReviewFiles.js';
import * as statusHistoryApi from '../../services/api/statusHistory.js';
import * as storageApi from '../../services/api/storage.js';
import * as edgeFunctions from '../../services/api/edgeFunctions.js';
import { statusProgress, REVIEW_STATUS } from '../../services/supabase.js';
import { createManagerNotification, createUserNotification } from '../notifications/api.js';
import { enqueueOfflineAction } from '../../services/offlineStore.js';

// ---- Loading ----------------------------------------------------------

export async function getProjects(profile) {
  const user = await authApi.getCurrentUser();
  if (!user || !profile) return [];

  if (profile.role === 'drafter') {
    const { data: drafterAssignments } = await projectsApi.getProjectIdsForWorker(user.id);
    const drafterProjectIds = Array.from(
      new Set((drafterAssignments || []).map((row) => row.project_id).filter(Boolean)),
    );
    if (!drafterProjectIds.length) return [];
    const { data, error } = await projectsApi.getProjectsByIdsAndStatuses(drafterProjectIds, [
      'עבר לשרטוט',
      REVIEW_STATUS,
    ]);
    if (error) throw error;
    return data || [];
  }

  if (profile.role !== 'manager') {
    const { data: extraAssignments } = await projectsApi.getProjectIdsForWorker(user.id);
    const extraIds = Array.from(new Set((extraAssignments || []).map((row) => row.project_id).filter(Boolean)));
    const filters = [`assigned_to.eq.${user.id}`];
    if (extraIds.length) filters.push(`id.in.(${extraIds.join(',')})`);
    const { data, error } = await projectsApi.getProjectsByAssignmentOr(filters);
    if (error) throw error;
    return data || [];
  }

  const { data, error } = await projectsApi.getProjectsForManager();
  if (error) throw error;
  return data || [];
}

export async function getHistory() {
  const { data, error } = await statusHistoryApi.getHistory();
  if (error) throw error;
  return data || [];
}

export function getProjectAssets(projectId) {
  return projectsApi.getProjectAssets(projectId);
}

export function getProjectFieldWorkerIds(project) {
  return Array.from(
    new Set(
      [
        project.assigned_to,
        ...(project.project_workers || [])
          .filter((worker) => !worker.profiles?.role || worker.profiles.role === 'field_worker')
          .map((worker) => worker.worker_id),
      ].filter(Boolean),
    ),
  );
}

// ---- Notifications / email side-effects --------------------------------

export async function sendProjectAssignmentEmail(workerId, project, assignedByName) {
  const { error } = await edgeFunctions.notifyProjectAssigned({
    workerId,
    projectId: project.id,
    projectName: project.name,
    clientName: project.client_name || null,
    location: project.location || null,
    contactPhone: project.contact_phone || null,
    description: project.description || null,
    dueDate: project.due_date || null,
    assignedByName: assignedByName || 'מנהל מערכת',
    appUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
  });
  if (error) {
    console.warn('Project assignment email failed:', error.message);
    return false;
  }
  return true;
}

// ---- Status / photos -----------------------------------------------------

export async function updateStatus(project, newStatus, note, profile) {
  const user = await authApi.getCurrentUser();
  if (!user) return { message: '' };

  const nextProgress = newStatus === REVIEW_STATUS ? 85 : (statusProgress[newStatus] ?? project.progress);
  if (!navigator.onLine) {
    await enqueueOfflineAction('project_status', {
      projectId: project.id,
      newStatus,
      progress: nextProgress,
      history: { project_id: project.id, old_status: project.status, new_status: newStatus, changed_by: user.id, note: note || 'עדכון סטטוס מהשטח' },
    });
    return { message: 'אין חיבור. שינוי הסטטוס נשמר ויסונכרן אוטומטית.', offline: true, optimistic: { status: newStatus, progress: nextProgress } };
  }
  const { error } = await projectsApi.updateProject(project.id, { status: newStatus, progress: nextProgress });
  if (error) return { message: error.message };

  const { error: historyError } = await statusHistoryApi.insertStatusHistory({
    project_id: project.id,
    old_status: project.status,
    new_status: newStatus,
    changed_by: user.id,
    note: note || 'עדכון סטטוס מהשטח',
  });
  if (historyError) return { message: historyError.message };

  if (profile?.role === 'field_worker' || profile?.role === 'manager') {
    await createManagerNotification(
      'status_change',
      `עדכון סטטוס: ${project.name}`,
      `${profile.full_name} עדכן סטטוס בפרויקט ${project.name}: ${project.status} → ${newStatus}${note ? `. הערה: ${note}` : ''}`,
      project.id,
    );

    const { error: notifyError } = await edgeFunctions.notifyStatusChange({
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
      appUrl: typeof window !== 'undefined' ? window.location.origin : '',
    });

    if (notifyError) {
      console.warn('Email notification failed:', notifyError.message);
      return { message: `הסטטוס עודכן ל: ${newStatus}. שים לב: התראת המייל לא נשלחה (${notifyError.message}).` };
    }
  }

  return { message: `הסטטוס של ${project.name} עודכן ל: ${newStatus}` };
}

export async function uploadPhoto(projectId, file, category = 'תמונת שטח') {
  const user = await authApi.getCurrentUser();
  if (!user) return { message: '' };

  if (!navigator.onLine) {
    await enqueueOfflineAction('project_photo', {
      projectId, userId: user.id, file, fileName: file.name, category,
      history: { project_id: projectId, old_status: null, new_status: 'הועלתה תמונה', changed_by: user.id },
    });
    return { message: 'אין חיבור. התמונה נשמרה במכשיר ותועלה אוטומטית.', offline: true };
  }

  const path = `${projectId}/${Date.now()}-${storageApi.safeFileName(file.name)}`;
  const { error } = await storageApi.uploadFile('project-photos', path, file, { upsert: false });
  if (error) return { message: error.message };

  await projectPhotosApi.insertProjectPhoto({
    project_id: projectId,
    uploaded_by: user.id,
    file_path: path,
    category,
  });
  await statusHistoryApi.insertStatusHistory({
    project_id: projectId,
    old_status: null,
    new_status: 'הועלתה תמונה',
    changed_by: user.id,
    note: `${category}: ${file.name}`,
  });

  return { message: 'התמונה הועלתה ונשמרה בפרויקט' };
}

export async function deletePhoto(photo, project, profile) {
  const user = await authApi.getCurrentUser();
  if (!user || !profile || !photo?.id || !photo?.file_path || !project?.id) return { message: '' };

  const isAssignedFieldWorker =
    profile.role === 'field_worker' &&
    (project.assigned_to === user.id ||
      (project.project_workers || []).some((assignment) => assignment.worker_id === user.id));
  if (profile.role !== 'manager' && !isAssignedFieldWorker) {
    return { message: 'אין הרשאה למחוק תמונות מהפרויקט הזה.' };
  }

  const ok = window.confirm(`למחוק את התמונה מסוג "${photo.category || 'תמונת שטח'}"?`);
  if (!ok) return null;

  const { error: storageError } = await storageApi.removeFiles('project-photos', [photo.file_path]);
  if (storageError) return { message: `מחיקת התמונה מהאחסון נכשלה: ${storageError.message}` };

  const { error: deleteError } = await projectPhotosApi.deleteProjectPhoto(photo.id);
  if (deleteError) return { message: `התמונה נמחקה מהאחסון, אבל מחיקת הרשומה נכשלה: ${deleteError.message}` };

  await statusHistoryApi.insertStatusHistory({
    project_id: project.id,
    old_status: null,
    new_status: 'נמחקה תמונה',
    changed_by: user.id,
    note: photo.category || 'תמונת שטח',
  });

  if (isAssignedFieldWorker) {
    await createManagerNotification(
      'photo_deleted',
      `תמונה נמחקה: ${project.name}`,
      `${profile.full_name} מחק תמונה מסוג ${photo.category || 'תמונת שטח'} מהפרויקט ${project.name}.`,
      project.id,
    );
  }

  return { message: 'התמונה נמחקה בהצלחה' };
}

// ---- Drafter / review workflow --------------------------------------------

export async function assignProjectDrafter(project, drafterId, profile, workers) {
  if (profile?.role !== 'manager') return { message: '' };
  const user = await authApi.getCurrentUser();
  if (!user) return { message: '' };

  const drafters = workers.filter((worker) => worker.role === 'drafter');
  const drafterIds = drafters.map((worker) => worker.id);
  const currentDrafterId = project.project_workers?.find((assignment) => assignment.profiles?.role === 'drafter')
    ?.worker_id;
  if ((currentDrafterId || '') === drafterId) {
    return { message: drafterId ? 'הפרויקט כבר משויך לשרטט שנבחר' : 'הפרויקט אינו משויך לשרטט' };
  }

  if (!drafterId) {
    if (drafterIds.length) {
      const { error: deleteError } = await projectWorkersApi.deleteProjectWorkersByProjectAndWorkers(
        project.id,
        drafterIds,
      );
      if (deleteError) return { message: `הסרת שיוך השרטט נכשלה: ${deleteError.message}` };
    }
    return { message: `שיוך השרטט הוסר מהפרויקט ${project.name}` };
  }

  const drafter = drafters.find((worker) => worker.id === drafterId);
  if (!drafter) return { message: 'השרטט שנבחר לא נמצא' };

  const { error: insertError } = await projectWorkersApi.insertProjectWorkers([
    { project_id: project.id, worker_id: drafterId, assigned_by: user.id },
  ]);
  if (insertError) return { message: `שיוך השרטט נכשל: ${insertError.message}` };

  const otherDrafterIds = drafterIds.filter((id) => id !== drafterId);
  if (otherDrafterIds.length) {
    const { error: deleteError } = await projectWorkersApi.deleteProjectWorkersByProjectAndWorkers(
      project.id,
      otherDrafterIds,
    );
    if (deleteError) return { message: `השרטט החדש שויך, אך ניקוי השיוך הקודם נכשל: ${deleteError.message}` };
  }

  await statusHistoryApi.insertStatusHistory({
    project_id: project.id,
    old_status: project.status,
    new_status: project.status,
    changed_by: user.id,
    note: `הפרויקט שויך לשרטט ${drafter.full_name}`,
  });
  await createUserNotification(
    drafterId,
    'drafter_assigned',
    `שויך אליך פרויקט לשרטוט: ${project.name}`,
    `${profile.full_name} שייך אליך את הפרויקט ${project.name} שנמצא בסטטוס עבר לשרטוט.`,
    project.id,
  );
  const emailSent = await sendProjectAssignmentEmail(drafterId, project, profile.full_name);

  return {
    message: emailSent
      ? `${project.name} שויך לשרטט ${drafter.full_name}, ונשלחו התראה ומייל`
      : `${project.name} שויך לשרטט ${drafter.full_name} ונשלחה התראה. המייל לא נשלח`,
  };
}

export async function sendProjectToReview(project, file, note, profile) {
  const user = await authApi.getCurrentUser();
  if (!user || !profile) return { message: '' };
  if (profile.role !== 'drafter' && profile.role !== 'manager') {
    return { message: 'רק שרטט או מנהל יכולים לשלוח פרויקט להגהה.' };
  }
  if (project.status !== 'עבר לשרטוט') {
    return { message: 'אפשר לשלוח להגהה רק פרויקט שנמצא בסטטוס עבר לשרטוט.' };
  }
  if (!file) return { message: 'יש לבחור קובץ PDF לפני שליחה להגהה.' };
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) return { message: 'אפשר להעלות להגהה קובץ PDF בלבד.' };

  const path = `${project.id}/${Date.now()}-${storageApi.safeFileName(file.name)}`;
  const { error: uploadError } = await storageApi.uploadFile('project-review-files', path, file, {
    upsert: false,
    contentType: 'application/pdf',
  });
  if (uploadError) return { message: uploadError.message };

  const { error: fileError } = await projectReviewFilesApi.insertProjectReviewFile({
    project_id: project.id,
    uploaded_by: user.id,
    file_path: path,
    file_name: file.name,
  });
  if (fileError) return { message: fileError.message };

  const { error: projectError } = await projectsApi.updateProject(project.id, {
    status: REVIEW_STATUS,
    progress: 85,
  });
  if (projectError) return { message: projectError.message };

  const cleanNote = note.trim();
  await statusHistoryApi.insertStatusHistory({
    project_id: project.id,
    old_status: project.status,
    new_status: REVIEW_STATUS,
    changed_by: user.id,
    note: `נשלח להגהה על ידי ${profile.full_name}. PDF: ${file.name}${cleanNote ? ` · הערה: ${cleanNote}` : ''}`,
  });

  const workerIds = getProjectFieldWorkerIds(project);
  for (const workerId of workerIds) {
    await createUserNotification(
      workerId,
      'project_review_sent',
      `נשלח להגהה: ${project.name}`,
      `השרטט ${profile.full_name} שלח את הפרויקט להגהה וצירף PDF לבדיקה.${cleanNote ? ` הערה: ${cleanNote}` : ''}`,
      project.id,
    );
  }

  const { error: notifyError } = await edgeFunctions.notifyProjectReview({
    projectId: project.id,
    projectName: project.name,
    clientName: project.client_name,
    location: project.location,
    contactPhone: project.contact_phone || null,
    pdfFileName: file.name,
    pdfFilePath: path,
    note: cleanNote,
    changedByName: profile.full_name,
    changedByEmail: profile.email,
    appUrl: typeof window !== 'undefined' ? window.location.origin : '',
  });

  if (notifyError) {
    console.warn('Review email notification failed:', notifyError.message);
    return {
      message: `הפרויקט נשלח להגהה והעובדים קיבלו התראה פנימית. שים לב: מייל ההגהה לא נשלח (${notifyError.message}).`,
    };
  }

  return { message: 'הפרויקט נשלח להגהה, ה-PDF נשמר ונשלחו התראות ומיילים.' };
}

export async function deleteProjectReviewFile(file, projectId, profile) {
  const user = await authApi.getCurrentUser();
  if (!user || !profile) return { message: '' };
  if (profile.role !== 'manager' && profile.role !== 'drafter') {
    return { message: 'רק מנהל או שרטט יכולים למחוק קובץ PDF של הגהה.' };
  }

  const ok = window.confirm(
    `למחוק את קובץ ההגהה "${file.file_name || 'קובץ PDF'}"? פעולה זו מוחקת רק את ה-PDF ולא את הפרויקט.`,
  );
  if (!ok) return null;

  const { error: storageError } = await storageApi.removeFiles('project-review-files', [file.file_path]);
  if (storageError) return { message: `מחיקת הקובץ מהאחסון נכשלה: ${storageError.message}` };

  const { error: deleteError } = await projectReviewFilesApi.deleteProjectReviewFile(file.id);
  if (deleteError) return { message: `הקובץ נמחק מהאחסון, אבל מחיקת הרשומה נכשלה: ${deleteError.message}` };

  await statusHistoryApi.insertStatusHistory({
    project_id: projectId,
    old_status: null,
    new_status: 'נמחק קובץ הגהה',
    changed_by: user.id,
    note: file.file_name || 'קובץ PDF',
  });

  return { message: 'קובץ ה-PDF נמחק מההגהה. הפרויקט עצמו לא נמחק.' };
}

// ---- Project CRUD ----------------------------------------------------------

export async function createProject(newProject, profile) {
  const user = await authApi.getCurrentUser();
  if (!user || profile?.role !== 'manager') return { message: '' };
  if (!newProject.name || !newProject.location) {
    return { message: 'חובה למלא שם פרויקט ומיקום. שיוך לעובד אפשר לבצע גם בהמשך.' };
  }

  const { data: insertedProject, error } = await projectsApi.insertProject({
    name: newProject.name,
    client_name: newProject.client_name || null,
    location: newProject.location,
    contact_phone: newProject.contact_phone || null,
    contact_email: newProject.contact_email || null,
    description: newProject.description || null,
    assigned_to: newProject.assigned_to || null,
    due_date: newProject.due_date || null,
    created_by: user.id,
    status: 'בעבודה בשטח',
    progress: 25,
    requires_work_diary: Boolean(newProject.requires_work_diary),
  });

  if (error) return { message: error.message };

  let assignmentEmailSent = true;
  if (insertedProject?.id && newProject.assigned_workers.length) {
    await projectWorkersApi.insertProjectWorkers(
      newProject.assigned_workers.map((workerId) => ({
        project_id: insertedProject.id,
        worker_id: workerId,
        assigned_by: user.id,
      })),
    );
  }

  if (newProject.assigned_to && insertedProject?.id) {
    await createUserNotification(
      newProject.assigned_to,
      'project_assigned',
      `שויך אליך פרויקט חדש: ${newProject.name}`,
      `${profile.full_name} שייך אליך את הפרויקט ${newProject.name}. מיקום: ${newProject.location}`,
      insertedProject.id,
    );
    assignmentEmailSent = await sendProjectAssignmentEmail(
      newProject.assigned_to,
      { id: insertedProject.id, ...newProject },
      profile.full_name,
    );
  }

  if (insertedProject?.id) {
    const workerIdsToNotify = Array.from(new Set([newProject.assigned_to, ...newProject.assigned_workers].filter(Boolean)));
    for (const workerId of workerIdsToNotify) {
      if (workerId === newProject.assigned_to) continue;
      await createUserNotification(
        workerId,
        'project_assigned',
        `שויך אליך פרויקט חדש: ${newProject.name}`,
        `${profile.full_name} צירף אותך לפרויקט ${newProject.name}. מיקום: ${newProject.location}`,
        insertedProject.id,
      );
      const ok = await sendProjectAssignmentEmail(workerId, { id: insertedProject.id, ...newProject }, profile.full_name);
      if (!ok) assignmentEmailSent = false;
    }
  }

  const hasAssignedWorkers = !!newProject.assigned_to || newProject.assigned_workers.length > 0;
  return {
    message: hasAssignedWorkers
      ? assignmentEmailSent
        ? 'הפרויקט נוצר, שויך לעובדים והעובדים קיבלו התראה במערכת ומייל'
        : 'הפרויקט נוצר והעובדים קיבלו התראה במערכת. שים לב: חלק מהמיילים לא נשלחו'
      : 'הפרויקט נוצר ללא שיוך לעובד. אפשר לשייך אותו בהמשך דרך עריכה.',
  };
}

export async function saveProject(projectId, changes, profile, originalProject) {
  if (profile?.role !== 'manager') return { message: '' };

  const previousAssignedTo = originalProject?.assigned_to || null;
  const nextAssignedTo = changes.assigned_to || null;

  const { error } = await projectsApi.updateProject(projectId, {
    name: changes.name,
    client_name: changes.client_name || null,
    location: changes.location,
    contact_phone: changes.contact_phone || null,
    contact_email: changes.contact_email || null,
    description: changes.description || null,
    assigned_to: nextAssignedTo,
    due_date: changes.due_date || null,
    requires_work_diary: Boolean(changes.requires_work_diary),
  });
  if (error) return { message: error.message };

  const preservedDrafterIds = (originalProject?.project_workers || [])
    .filter((assignment) => assignment.profiles?.role === 'drafter')
    .map((assignment) => assignment.worker_id);
  const previousExtraWorkers = new Set(
    (originalProject?.project_workers || [])
      .filter((assignment) => !assignment.profiles?.role || assignment.profiles.role === 'field_worker')
      .map((assignment) => assignment.worker_id),
  );
  const nextExtraWorkers = new Set(changes.assigned_workers || []);
  const addedExtraWorkers = Array.from(nextExtraWorkers).filter((id) => !previousExtraWorkers.has(id));
  const nextProjectAssignments = Array.from(new Set([...Array.from(nextExtraWorkers), ...preservedDrafterIds]));

  await projectWorkersApi.deleteProjectWorkersByProject(projectId);
  if (nextProjectAssignments.length) {
    const user = await authApi.getCurrentUser();
    await projectWorkersApi.insertProjectWorkers(
      nextProjectAssignments.map((workerId) => ({
        project_id: projectId,
        worker_id: workerId,
        assigned_by: user?.id || null,
      })),
    );
  }

  let assignmentEmailSent = true;
  const projectNameForNotify = changes.name || originalProject?.name || 'פרויקט';
  const managerNameForNotify = profile?.full_name || 'מנהל מערכת';
  const projectForEmail = {
    id: projectId,
    name: projectNameForNotify,
    client_name: changes.client_name || originalProject?.client_name || null,
    location: changes.location || originalProject?.location || null,
    contact_phone: changes.contact_phone || originalProject?.contact_phone || null,
    description: changes.description || originalProject?.description || null,
    due_date: changes.due_date || originalProject?.due_date || null,
  };

  for (const workerId of addedExtraWorkers) {
    await createUserNotification(
      workerId,
      'project_assigned',
      `שויך אליך פרויקט חדש: ${projectNameForNotify}`,
      `${managerNameForNotify} צירף אותך לפרויקט ${projectNameForNotify}.${changes.location ? ` מיקום: ${changes.location}` : ''}`,
      projectId,
    );
    const ok = await sendProjectAssignmentEmail(workerId, projectForEmail, managerNameForNotify);
    if (!ok) assignmentEmailSent = false;
  }

  if (nextAssignedTo && nextAssignedTo !== previousAssignedTo) {
    await createUserNotification(
      nextAssignedTo,
      'project_assigned',
      `שויך אליך פרויקט חדש: ${projectNameForNotify}`,
      `${managerNameForNotify} שייך אליך את הפרויקט ${projectNameForNotify}.${changes.location ? ` מיקום: ${changes.location}` : ''}`,
      projectId,
    );
    assignmentEmailSent = await sendProjectAssignmentEmail(nextAssignedTo, projectForEmail, managerNameForNotify);
  }

  const assignmentChanged = (nextAssignedTo && nextAssignedTo !== previousAssignedTo) || addedExtraWorkers.length > 0;
  return {
    message: assignmentChanged
      ? assignmentEmailSent
        ? 'הפרויקט עודכן והעובדים החדשים קיבלו התראה במערכת ומייל'
        : 'הפרויקט עודכן והעובדים החדשים קיבלו התראה במערכת. שים לב: חלק מהמיילים לא נשלחו'
      : 'הפרויקט עודכן בהצלחה',
  };
}

export async function deleteProject(project, profile) {
  if (profile?.role !== 'manager') return null;
  const ok = window.confirm(`למחוק את הפרויקט "${project.name}"? פעולה זו תמחק גם היסטוריה ותמונות שמקושרות אליו.`);
  if (!ok) return null;

  const { error } = await projectsApi.deleteProject(project.id);
  if (error) return { message: error.message };
  return { message: 'הפרויקט נמחק' };
}

export async function archiveProject(project, profile) {
  if (profile?.role !== 'manager') return null;
  const ok = window.confirm(
    `להעביר את הפרויקט "${project.name}" לארכיון? הפרויקט לא יופיע ברשימת הפרויקטים הפעילים, אבל כל הנתונים יישמרו.`,
  );
  if (!ok) return null;

  const { error } = await projectsApi.updateProject(project.id, {
    is_archived: true,
    archived_at: new Date().toISOString(),
  });
  if (error) return { message: error.message };

  const user = await authApi.getCurrentUser();
  if (user) {
    await statusHistoryApi.insertStatusHistory({
      project_id: project.id,
      old_status: project.status,
      new_status: 'הועבר לארכיון',
      changed_by: user.id,
      note: 'הפרויקט נשמר בארכיון ואינו מוצג ברשימת הפרויקטים הפעילים',
    });
  }
  return { message: 'הפרויקט הועבר לארכיון' };
}

export async function restoreProject(project, profile) {
  if (profile?.role !== 'manager') return { message: '' };

  const { error } = await projectsApi.updateProject(project.id, { is_archived: false, archived_at: null });
  if (error) return { message: error.message };

  const user = await authApi.getCurrentUser();
  if (user) {
    await statusHistoryApi.insertStatusHistory({
      project_id: project.id,
      old_status: project.status,
      new_status: 'שוחזר מהארכיון',
      changed_by: user.id,
      note: 'הפרויקט חזר לרשימת הפרויקטים הפעילים',
    });
  }
  return { message: 'הפרויקט שוחזר מהארכיון' };
}

// ---- Tasks ------------------------------------------------------------

export async function addProjectTask(projectId, title, description, profile, project) {
  const user = await authApi.getCurrentUser();
  if (!user || !profile) return { message: '' };
  const isAssignedFieldWorker =
    profile.role === 'field_worker' &&
    (project?.assigned_to === user.id ||
      (project?.project_workers || []).some((assignment) => assignment.worker_id === user.id));
  if (profile.role !== 'manager' && !isAssignedFieldWorker) {
    return { message: 'אפשר להוסיף משימה רק בפרויקט שמשויך אליך.' };
  }
  const cleanTitle = title.trim();
  if (!cleanTitle) return { message: 'יש למלא כותרת למשימה.' };

  if (!navigator.onLine) {
    const task = { id: crypto.randomUUID(), project_id: projectId, title: cleanTitle, description: description.trim() || null, created_by: user.id, is_done: false, created_at: new Date().toISOString(), pending_sync: true, profiles: { full_name: profile.full_name } };
    await enqueueOfflineAction('project_task_add', {
      task,
      history: { project_id: projectId, old_status: null, new_status: 'נוספה משימה', changed_by: user.id, note: `${cleanTitle} · נשמר במצב אופליין` },
    });
    return { message: 'אין חיבור. המשימה נשמרה ותסונכרן אוטומטית.', offline: true, offlineTask: task };
  }

  const { data: insertedTask, error } = await projectTasksApi.insertProjectTask({
    project_id: projectId,
    title: cleanTitle,
    description: description.trim() || null,
    created_by: user.id,
    is_done: false,
  });
  if (error) return { message: error.message };

  await statusHistoryApi.insertStatusHistory({
    project_id: projectId,
    old_status: null,
    new_status: 'נוספה משימה',
    changed_by: user.id,
    note: `${cleanTitle}${isAssignedFieldWorker ? ' · נשלחה למנהלים' : ''}`,
  });

  if (isAssignedFieldWorker) {
    await createManagerNotification(
      'task_from_worker',
      `משימה מעובד שטח: ${project.name}`,
      `${profile.full_name} השאיר משימה למנהלים בפרויקט ${project.name}: ${cleanTitle}${description.trim() ? `. פירוט: ${description.trim()}` : ''}`,
      projectId,
      insertedTask?.id,
    );
    return { message: 'המשימה נוספה ונשלחה למנהלים' };
  }

  if (project?.assigned_to) {
    await createUserNotification(
      project.assigned_to,
      'task_added',
      `משימה חדשה: ${project.name}`,
      `נוספה משימה חדשה לפרויקט ${project.name}: ${cleanTitle}`,
      projectId,
    );
  }

  return { message: 'המשימה נוספה לפרויקט' };
}

export async function toggleProjectTask(task, project, profile, isManager) {
  const user = await authApi.getCurrentUser();
  if (!user || !profile) return { message: '' };

  const isAssignedWorker =
    profile.role === 'field_worker' &&
    (project.assigned_to === user.id || (project.project_workers || []).some((assignment) => assignment.worker_id === user.id));
  if (!isManager && !isAssignedWorker) return { message: '' };

  const nextDone = !task.is_done;
  if (!navigator.onLine) {
    await enqueueOfflineAction('project_task_toggle', {
      taskId: task.id, isDone: nextDone,
      history: { project_id: project.id, old_status: null, new_status: nextDone ? 'משימה בוצעה' : 'משימה נפתחה מחדש', changed_by: user.id, note: `${task.title} · נשמר במצב אופליין` },
    });
    return { message: 'אין חיבור. מצב המשימה נשמר ויסונכרן אוטומטית.', offline: true, optimistic: { is_done: nextDone } };
  }
  const { error } = await projectTasksApi.updateProjectTask(task.id, { is_done: nextDone });
  if (error) return { message: error.message };

  await statusHistoryApi.insertStatusHistory({
    project_id: project.id,
    old_status: null,
    new_status: nextDone ? 'משימה בוצעה' : 'משימה נפתחה מחדש',
    changed_by: user.id,
    note: task.title,
  });

  if (nextDone && profile.role === 'field_worker') {
    await createManagerNotification(
      'task_done',
      `משימה בוצעה: ${project.name}`,
      `${profile.full_name} סימן משימה כבוצעה בפרויקט ${project.name}: ${task.title}`,
      project.id,
      task.id,
    );

    const { error: notifyError } = await edgeFunctions.notifyTaskDone({
      projectId: project.id,
      projectName: project.name,
      clientName: project.client_name,
      location: project.location,
      taskId: task.id,
      taskTitle: task.title,
      taskDescription: task.description,
      changedByName: profile.full_name,
      changedByEmail: profile.email,
      appUrl: typeof window !== 'undefined' ? window.location.origin : '',
    });

    if (notifyError) {
      console.warn('Task email notification failed:', notifyError.message);
      return { message: `המשימה סומנה כבוצעה. שים לב: התראת המייל לא נשלחה (${notifyError.message}).` };
    }
  }

  return { message: nextDone ? 'המשימה סומנה כבוצעה' : 'המשימה סומנה כפתוחה' };
}

export async function updateProjectTask(task, project, title, description, profile) {
  if (profile?.role !== 'manager') return { message: '' };
  const cleanTitle = title.trim();
  if (!cleanTitle) return { message: 'יש למלא כותרת למשימה.' };

  const { error } = await projectTasksApi.updateProjectTask(task.id, {
    title: cleanTitle,
    description: description.trim() || null,
  });
  if (error) return { message: error.message };

  const user = await authApi.getCurrentUser();
  if (user) {
    await statusHistoryApi.insertStatusHistory({
      project_id: project.id,
      old_status: null,
      new_status: 'משימה נערכה',
      changed_by: user.id,
      note: cleanTitle,
    });
  }

  return { message: 'המשימה עודכנה בהצלחה' };
}

export async function deleteProjectTask(task, profile) {
  if (profile?.role !== 'manager') return null;
  const ok = window.confirm(`למחוק את המשימה "${task.title}"?`);
  if (!ok) return null;

  const { error } = await projectTasksApi.deleteProjectTask(task.id);
  if (error) return { message: error.message };
  return { message: 'המשימה נמחקה' };
}
