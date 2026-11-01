import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../auth/AuthContext.jsx';
import { t, useLanguage } from '../language/LanguageContext.jsx';
import { languageOptions } from '../language/languages.js';
import { DemoPortalView } from './DemoPortal.jsx';
import DemoManagement from './DemoManagement.jsx';
import { validateCaseStudy } from './api.js';
import { articleDraft } from './article.js';

// Local-only fixtures. No account is created, access granted or file uploaded.
const fixtures = [
  {
    project_id: 'preview-1',
    title: 'פרויקט הדגמה · Example Ω',
    location: 'Demo location',
    summary: 'תוכן לדוגמה לבדיקת תצוגה בלבד.\nExample content for layout review.',
    is_published: true,
    demo_case_studies: [
      {
        id: 'preview-study',
        title: 'מקרה בוחן לדוגמה · Sample case study',
        summary: 'אתגר ופתרון לדוגמה לבדיקת התצוגה.',
        challenge: 'זהו תוכן הדגמה לבדיקת עיצוב בלבד.\nכאן יתוארו תנאי השטח, המורכבות והצורך שהוביל לביצוע העבודה.',
        work_process: 'כאן יוצגו שלבי העבודה, הבדיקות והתיאום שבוצעו בפועל, על בסיס מקרה הבוחן המקורי.',
        solution: 'כאן יופיע הפתרון שיושם בפרויקט, לצד הסבר על השיקולים המקצועיים וההתאמה לתנאי השטח.',
        outcome: 'כאן יוצגו התוצאות המתועדות והערך ללקוח. אין בדוגמה זו נתונים מפרויקט אמיתי.',
        file_name: 'sample-case-study.pdf',
        file_size: 1572864,
      },
    ],
  },
  {
    project_id: 'preview-2',
    title: 'Project with a longer client-provided name for mobile layout review',
    location: '',
    summary: '',
    is_published: false,
    demo_case_studies: [],
  },
];
let previewData = {
  projects: fixtures.map((item) => ({ id: item.project_id, name: item.title })),
  showcases: structuredClone(fixtures),
  users: [
    {
      id: 'preview-user',
      full_name: 'לקוח לדוגמה · Example client',
      email: 'demo@example.invalid',
    },
  ],
  access: [{ user_id: 'preview-user', project_id: 'preview-1' }],
};
const previewApi = {
  loadDemoManagement: async () => structuredClone(previewData),
  saveShowcase: async (row) => {
    const index = previewData.showcases.findIndex((item) => item.project_id === row.project_id);
    if (index < 0) previewData.showcases.push({ ...row, demo_case_studies: [] });
    else previewData.showcases[index] = { ...previewData.showcases[index], ...row };
  },
  setDemoProjectAccess: async (user_id, project_id, enabled) => {
    previewData.access = previewData.access.filter(
      (row) => row.user_id !== user_id || row.project_id !== project_id,
    );
    if (enabled) previewData.access.push({ user_id, project_id });
  },
  uploadCaseStudy: async (projectId, { file, ...draft }) => {
    await validateCaseStudy(file);
    previewData.showcases
      .find((row) => row.project_id === projectId)
      .demo_case_studies.push({
        id: crypto.randomUUID(),
        ...articleDraft(draft),
        file_name: file.name,
        file_size: file.size,
      });
  },
  saveCaseStudyArticle: async (id, draft) => {
    for (const row of previewData.showcases) {
      const study = row.demo_case_studies.find((item) => item.id === id);
      if (study) Object.assign(study, articleDraft(draft));
    }
  },
  deleteCaseStudy: async (id) => {
    for (const row of previewData.showcases)
      row.demo_case_studies = row.demo_case_studies.filter((study) => study.id !== id);
  },
};

export default function LocalDemoPreview() {
  useTranslation();
  const { language, setLanguage } = useLanguage();
  const [mode, setMode] = useState('gallery');
  return (
    <>
      {mode === 'manager' ? (
        <AuthContext.Provider value={{ isAdmin: true }}>
          <div className="container">
            <DemoManagement api={previewApi} />
          </div>
        </AuthContext.Provider>
      ) : (
        <DemoPortalView
          projects={mode === 'empty' ? [] : fixtures}
          loading={mode === 'loading'}
          error={mode === 'error'}
          onReload={() => setMode('gallery')}
          profile={{ full_name: 'Example client' }}
          onLogout={() => setMode('empty')}
        />
      )}
      <details className="demoPreviewControls">
        <summary>{t('demo.previewSettings')}</summary>
        <div className="container demoActions">
          <label>
            {t('demo.previewState')}
            <select value={mode} onChange={(event) => setMode(event.target.value)}>
              {['gallery', 'empty', 'loading', 'error', 'manager'].map((key) => (
                <option key={key} value={key}>
                  {t(`demo.preview.${key}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('demo.language')}
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              {languageOptions.map(({ code, labelKey }) => (
                <option key={code} value={code}>
                  {t(labelKey)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>
    </>
  );
}
