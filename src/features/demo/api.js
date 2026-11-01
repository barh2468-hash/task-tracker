import { supabase } from '../../services/supabase.js';
import { articleDraft, articleTranslations } from './article.js';

export const DEMO_BUCKET = 'demo-case-studies';
export const MAX_CASE_STUDY_SIZE = 20 * 1024 * 1024;

async function unwrap(request) {
  const { data, error } = await request;
  if (error) throw error;
  return data;
}

export function listShowcases() {
  return unwrap(
    supabase
      .from('demo_project_showcases')
      .select(
        'project_id,source_project_id,title,summary,location,is_published,translations,demo_case_studies(id,title,summary,challenge,work_process,solution,outcome,client_name,technical_details,translations,file_name,file_size,demo_case_study_media(id,position,caption,caption_en))',
      )
      .order('title'),
  );
}

export async function loadDemoManagement() {
  const [showcases, projects, users, access] = await Promise.all([
    listShowcases(),
    unwrap(supabase.from('projects').select('id,name').order('name')),
    unwrap(
      supabase.from('profiles').select('id,full_name,email').eq('role', 'demo').order('full_name'),
    ),
    unwrap(supabase.from('demo_project_access').select('user_id,project_id')),
  ]);
  const standalone = showcases.filter((row) => !projects.some((project) => project.id === row.project_id))
    .map((row) => ({ id: row.project_id, name: row.title }));
  return { showcases, projects: [...standalone, ...projects], users, access };
}

export function saveShowcase(showcase) {
  return unwrap(
    supabase.from('demo_project_showcases').upsert(showcase, { onConflict: 'project_id' }),
  );
}

export function setDemoProjectAccess(userId, projectId, enabled) {
  return unwrap(
    enabled
      ? supabase.from('demo_project_access').upsert({ user_id: userId, project_id: projectId })
      : supabase
          .from('demo_project_access')
          .delete()
          .eq('user_id', userId)
          .eq('project_id', projectId),
  );
}

export async function validateCaseStudy(file) {
  if (!file || !/\.pdf$/i.test(file.name) || file.size <= 0 || file.size > MAX_CASE_STUDY_SIZE) {
    throw new Error('demo.pdfInvalid');
  }
  // Do not trust the extension or browser MIME type alone.
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...header) !== '%PDF-') throw new Error('demo.pdfInvalid');
}

export async function uploadCaseStudy(projectId, { file, ...draft }) {
  await validateCaseStudy(file);
  const filePath = `${projectId}/${crypto.randomUUID()}.pdf`;
  await unwrap(
    supabase.storage.from(DEMO_BUCKET).upload(filePath, file, {
      contentType: 'application/pdf',
      upsert: false,
    }),
  );
  try {
    await unwrap(
      supabase.from('demo_case_studies').insert({
        project_id: projectId,
        ...articleDraft(draft),
        client_name: draft.client_name || '',
        technical_details: draft.technical_details || '',
        translations: articleTranslations(draft),
        title: draft.title.trim(),
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
      }),
    );
  } catch (error) {
    // An unreferenced object cannot be read by demo users.
    await supabase.storage.from(DEMO_BUCKET).remove([filePath]);
    throw error;
  }
}

export function saveCaseStudyArticle(id, draft) {
  return unwrap(
    supabase.from('demo_case_studies')
      .update({ ...articleDraft(draft), title: draft.title.trim(),
        client_name: draft.client_name || '', technical_details: draft.technical_details || '',
        ...(draft.translations ? { translations: articleTranslations(draft) } : {}),
      })
      .eq('id', id).select('id').single(),
  );
}

export async function openCaseStudy(id) {
  // Resolve the path afresh: revoked project access must prevent new signed URLs.
  const study = await unwrap(
    supabase.from('demo_case_studies').select('file_path').eq('id', id).single(),
  );
  if (!study.file_path) throw new Error('demo.openError');
  const result = await unwrap(
    supabase.storage.from(DEMO_BUCKET).createSignedUrl(study.file_path, 60),
  );
  return result.signedUrl;
}

export async function deleteCaseStudy(id) {
  const study = await unwrap(
    supabase.from('demo_case_studies').select('file_path').eq('id', id).single(),
  );
  const media = await unwrap(supabase.from('demo_case_study_media').select('file_path').eq('case_study_id', id));
  await unwrap(supabase.from('demo_case_studies').delete().eq('id', id));
  // Metadata is removed first so the document is immediately excluded from new reads.
  const paths = [study.file_path, ...(media || []).map((item) => item.file_path)].filter(Boolean);
  if (paths.length) await unwrap(supabase.storage.from(DEMO_BUCKET).remove(paths));
}

export async function loadCaseStudyMedia(id) {
  const rows = await unwrap(supabase.from('demo_case_study_media')
    .select('id,file_path,position,caption,caption_en').eq('case_study_id', id).order('position'));
  if (!rows.length) return [];
  const signed = await unwrap(supabase.storage.from(DEMO_BUCKET).createSignedUrls(rows.map((row) => row.file_path), 60));
  return rows.map((row) => ({ ...row, url: signed.find((item) => item.path === row.file_path && !item.error)?.signedUrl }));
}
