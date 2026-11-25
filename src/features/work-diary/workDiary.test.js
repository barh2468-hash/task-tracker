import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { transformSync } from 'esbuild';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { heTranslations, enTranslations, elTranslations } from '../language/resources.js';
import { localeForLanguage } from '../language/locale.js';
import { workKinds, leakKinds } from './utils/helpers.js';
import { exportWorkDiaryPdf } from './utils/exportWorkDiaryPdf.js';
import { heWorkDiary, enWorkDiary, elWorkDiary } from './translations.js';

const require = createRequire(import.meta.url);
const flush = () => new Promise((resolve) => setImmediate(resolve));
const project = { id: 'project', name: 'User project Ω', location: 'User site', client_name: 'User client',
  requires_work_diary: false, work_sessions: [{ worker_id: 'worker', started_at: '2026-11-25T06:00:00Z' }] };
const user = { session: { user: { id: 'worker' } }, profile: { full_name: 'User reporter' } };

// Run the real component handlers with controlled hook state and API responses.
// No live account, location permission or production writes are needed.
function harness(file, imports) {
  const state = [];
  const effects = [];
  let index = 0;
  let mounted = false;
  const react = { ...React,
    useState(initial) {
      const slot = index++;
      if (!(slot in state)) state[slot] = typeof initial === 'function' ? initial() : initial;
      return [state[slot], (next) => { state[slot] = typeof next === 'function' ? next(state[slot]) : next; }];
    },
    useEffect(effect) { if (!mounted) effects.push(effect); },
    useMemo: (callback) => callback(),
    useRef: (value) => ({ current: value }),
  };
  const source = transformSync(readFileSync(new URL(file, import.meta.url), 'utf8'),
    { loader: 'jsx', jsx: 'automatic', format: 'cjs' }).code;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', source)((name) => {
    if (name === 'react') return react;
    if (name === 'react-dom') return { createPortal: (children) => children };
    if (name === 'react-i18next') return { useTranslation() {} };
    if (name.endsWith('.css')) return {};
    return name in imports ? { __esModule: true, ...imports[name] } : require(name);
  }, module, module.exports);
  return {
    render(props) { index = 0; return module.exports.default(props); },
    mount() { mounted = true; effects.splice(0).forEach((effect) => effect()); },
  };
}

function elements(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap((child) => elements(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...elements(tree.props?.children, predicate)];
}
function button(tree, text) {
  return elements(tree, (item) => item.type === 'button' && renderToStaticMarkup(item).includes(text))[0];
}

for (const [language, dictionary] of Object.entries({ he: heTranslations, en: enTranslations, el: elTranslations })) {
  test(`diary text, form, errors, signatures, permissions and export in ${language}`, async () => {
    const instance = i18next.createInstance();
    await instance.init({ lng: language, fallbackLng: false, keySeparator: false, nsSeparator: false,
      interpolation: { escapeValue: false }, resources: { [language]: { translation: dictionary } } });
    const translate = (key, options) => instance.t(key, { defaultValue: language === 'he' ? key : '', ...options });
    const diaryDictionary = { he: heWorkDiary, en: enWorkDiary, el: elWorkDiary }[language];
    for (const [key, value] of Object.entries(diaryDictionary)) assert.equal(dictionary[key], value, key);
    const locale = localeForLanguage(language);
    const keys = new Set();
    for (const file of ['./components/WorkDiaryPanel.jsx', './components/SignaturePad.jsx', './utils/exportWorkDiaryPdf.js']) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8');
      for (const match of source.matchAll(/(?:\bt|\btext|\brow|\bmetric)\(['"]([^'"\n]+)['"]/g)) keys.add(match[1]);
      for (const match of source.matchAll(/key: '([^']+)'/g)) keys.add(match[1]);
    }
    for (const kind of [...workKinds, ...leakKinds]) keys.add(kind.label);
    keys.add('יומני עבודה');
    keys.add('יומן העבודה ייפתח אוטומטית לאחר שמירת סיום העבודה.');
    for (const key of keys) {
      if (language !== 'he') assert.ok(Object.hasOwn(dictionary, key), key);
      assert.ok(translate(key), key);
    }

    globalThis.document = { body: { style: {} }, documentElement: { style: {} } };
    let inserted;
    let closed = 0;
    let draft;
    const saved = { id: 'diary', diary_number: 7180, profiles: { full_name: 'Reporter Ω' } };
    const component = harness('./components/WorkDiaryPanel.jsx', {
      '../../language/LanguageContext.jsx': { t: translate, useLanguage: () => ({ language }) },
      '../../language/locale.js': { localeForLanguage },
      '../../auth/useAuth.js': { useAuth: () => user },
      '../../../services/api/workDiaries.js': {
        getWorkDiariesForProject: async () => ({ data: [] }),
        insertWorkDiary: async (payload) => { inserted = payload; return { data: { ...saved, ...payload } }; },
      },
      '../../../services/api/auth.js': { getCurrentUser: async () => user.session.user },
      '../../../hooks/useRealtimeRefresh.js': { useRealtimeRefresh() {} },
      '../utils/exportWorkDiaryPdf.js': { exportWorkDiaryPdf },
      '../utils/helpers.js': { workKinds, leakKinds },
      './SignaturePad.jsx': { default: ({ label }) => React.createElement('canvas', { 'aria-label': label }) },
      '../../drafts/useFormDraft.js': { default: ({ initialValue }) => {
        draft ??= { value: initialValue, ready: true, setValue(next) { this.value = next(this.value); }, async clear() {} };
        return draft;
      } },
      '../../drafts/DraftNotice.jsx': { default: () => null },
      '../../projects/utils/projectContacts.js': { primaryProjectPhone: () => '' },
      '../../projects/utils/projectName.js': { projectName: (value) => value.name },
    });
    const props = { project, currentUserName: 'User reporter', canCreate: true, onClose: () => { closed++; } };
    let tree = component.render(props);
    component.mount();
    await flush();
    tree = component.render(props);
    assert.ok(renderToStaticMarkup(tree).includes(translate('עדיין לא נוצר יומן עבודה לפרויקט זה.')));
    button(tree, translate('יומן עבודה חדש')).props.onClick({ preventDefault() {}, stopPropagation() {} });
    tree = component.render(props);
    let markup = renderToStaticMarkup(tree);
    assert.ok(markup.includes(`aria-label="${translate('יומן עבודה חדש')}"`));
    assert.ok(markup.includes(translate('חתימת נציג הלקוח')));
    await button(tree, translate('שמירה וסגירת היומן')).props.onClick();
    tree = component.render(props);
    assert.ok(renderToStaticMarkup(tree).includes(translate('יש למלא תאריך, איש קשר ושעות התחלה וסיום.')));
    draft.value.form = { ...draft.value.form, work_date: '2026-11-25', contact_name: 'Contact Ω', start_time: '08:00', end_time: '16:00',
      customer_name: 'Customer Ω', team_lead_name: 'Lead Ω', additional_notes: 'Original <script> & Ω' };
    await button(component.render(props), translate('שמירה וסגירת היומן')).props.onClick();
    assert.ok(renderToStaticMarkup(component.render(props)).includes(translate('חובה להשלים את שתי החתימות לפני שמירת היומן.')));
    draft.value.customerSignature = 'data:image/png;base64,YQ==';
    draft.value.teamLeadSignature = 'data:image/png;base64,Yg==';
    await button(component.render(props), translate('שמירה וסגירת היומן')).props.onClick();
    assert.equal(inserted.project_id, project.id);
    assert.equal(inserted.created_by, 'worker');
    assert.equal(inserted.form_data.additional_notes, 'Original <script> & Ω');
    assert.equal(closed, 1);
    markup = renderToStaticMarkup(component.render(props));
    assert.ok(markup.includes(new Date('2026-11-25T12:00:00').toLocaleDateString(locale)));
    assert.equal(button(component.render({ ...props, canCreate: false }), translate('יומן עבודה חדש')), undefined);

    let html;
    globalThis.window = { location: { origin: 'http://localhost' }, open: () => ({ document: { open() {}, write(value) { html = value; }, close() {} } }) };
    exportWorkDiaryPdf(project, { ...saved, ...inserted }, { language, t: translate });
    assert.match(html, new RegExp(`lang="${language}" dir="${language === 'he' ? 'rtl' : 'ltr'}"`));
    assert.ok(html.includes('Original &lt;script&gt; &amp; Ω'));
    assert.ok(html.includes('User project Ω'));
    assert.ok(html.includes(translate('יומן עבודה מס׳ {{number}}', { number: (7180).toLocaleString(locale) })));
    assert.doesNotMatch(html, /<script>|\{\{/);
    if (language !== 'he') {
      assert.doesNotMatch(markup, /[\u0590-\u05ff]/);
      assert.doesNotMatch(html, /[\u0590-\u05ff]/);
    }
  });
}

test('both completion dialogs open required diaries only after successful project closure', async () => {
  globalThis.document = { body: {} };
  for (const file of ['../attendance/components/ProjectWorkEndDialog.jsx', '../attendance/components/AttendanceEndDialog.jsx']) {
    for (const required of [true, false]) {
      for (const success of [true, false]) {
        for (const projectSessionClosed of [true, false]) {
          const currentProject = { ...project, requires_work_diary: required };
          const opened = [];
          const attendance = {
            projectWorkEndTarget: currentProject, projectWorkEndBusy: false,
            closeProjectWorkEndDialog() {},
            endWork: async () => ({ success }),
            openWorkDiary: (value) => opened.push(value),
            myAttendanceSessions: [{ id: 'attendance', started_at: '2026-11-25T06:00:00Z', attendance_type: 'work' }],
            workSessions: [{ worker_id: 'worker', project_id: project.id, started_at: '2026-11-25T06:00:00Z' }],
            attendanceEndDialogOpen: true, attendanceEndNote: '', attendanceBusy: false,
            setAttendanceEndNote() {}, setAttendanceEndDialogOpen() {},
            finishAttendance: async () => ({ success, projectSessionClosed }),
          };
          const component = harness(file, {
            '../../language/LanguageContext.jsx': { t: (key) => key, useLanguage: () => ({ language: 'he' }) },
            '../../language/locale.js': { localeForLanguage },
            '../../auth/useAuth.js': { useAuth: () => user },
            '../../projects/ProjectsContext.jsx': { useProjects: () => ({ projects: [currentProject], workers: [] }) },
            '../AttendanceContext.jsx': { useAttendance: () => attendance },
            '../api.js': { attendanceTypeLabel: { work: 'Work' } },
            '../../helpers/crew.js': { helperCrew: () => [] },
            '../../helpers/useCrewHelpers.js': { useCrewHelpers: () => ({ helpers: [] }) },
            '../../helpers/HelperDirectoryStatus.jsx': { default: () => null },
            '../../../services/supabase.js': { statuses: [] },
            '../../projects/utils/projectName.js': { projectName: (value) => value.name },
          });
          const tree = component.render();
          const form = elements(tree, (item) => item.type === 'form')[0];
          form.props.onSubmit({ preventDefault() {} });
          await flush();
          const shouldOpen = required && success && (file.includes('ProjectWorkEndDialog') || projectSessionClosed);
          assert.equal(opened.length, shouldOpen ? 1 : 0, `${file}, required=${required}, success=${success}, closed=${projectSessionClosed}`);
          if (shouldOpen) assert.equal(opened[0].id, project.id);
        }
      }
    }
  }
});

test('every project exposes the diary tab with existing creation and archive permissions', () => {
  const file = '../projects/components/ProjectCard.jsx';
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const Empty = () => null;
  const imports = Object.fromEntries([...source.matchAll(/from '([^']+\.jsx)'/g)]
    .map((match) => [match[1], { default: Empty }]));
  const Diary = () => null;
  for (const role of ['field_worker', 'drafter', 'manager', 'admin', 'viewer']) {
    for (const required of [false, true]) {
      for (const archived of [false, true]) {
        const isManager = ['manager', 'admin'].includes(role);
        const component = harness(file, {
          ...imports,
          '../../language/LanguageContext.jsx': { t: (key) => key, useLanguage: () => ({ language: 'he' }) },
          '../../language/locale.js': { localeForLanguage },
          '../../auth/useAuth.js': { useAuth: () => ({ ...user, profile: { ...user.profile, role }, isManager, isDrafter: role === 'drafter', isViewer: role === 'viewer' }) },
          '../ProjectsContext.jsx': { useProjects: () => ({ historyItems: [], workers: [] }) },
          '../../chat/ChatContext.jsx': { useChat: () => ({ projectChatAvailable: false, projectRoomsByProjectId: new Map() }) },
          '../hooks/useProjectDialog.js': { default: () => null },
          '../../../components/StatusPill.jsx': { default: Empty, getStatusClass: () => '' },
          '../../work-diary/components/WorkDiaryPanel.jsx': { default: Diary },
          '../../../services/supabase.js': { appStatuses: [], FIELD_WORKER_STATUSES: [], roleLabel: () => '' },
          '../utils/exportProjectPdf.js': {},
          '../utils/drafters.js': { findAssignedDrafter: () => null, isDrafterCandidate: () => false },
          '../utils/assignments.js': { getProjectTeamAssignments: () => [], isProjectTeamMember: () => false },
          '../utils/projectContacts.js': { getProjectContacts: () => [], contactLinks: () => [] },
          '../task-reports/model.js': { tasksWithReportHistory: (tasks) => tasks },
          '../../../context/messageTone.js': {},
          '../../../utils/roles.js': { isManagerRole: (value) => ['manager', 'admin'].includes(value) },
          '../utils/projectName.js': { projectName: (value) => value.name },
          '../../../utils/localizedField.js': { TRANSLATED_LANGUAGES: ['en', 'el', 'pt'], translationDraft: () => ({}) },
        });
        const tree = component.render({ project: { ...project, requires_work_diary: required, is_archived: archived }, initialTab: 'work-diaries' });
        const tab = elements(tree, (item) => item.props?.role === 'tab' && item.props.id.endsWith('-work-diaries'))[0];
        assert.ok(tab);
        assert.equal(tab.props['aria-selected'], true);
        const diary = elements(tree, (item) => item.type === Diary)[0];
        assert.ok(diary, `${role}, required=${required}, archived=${archived}`);
        assert.equal(diary.props.canCreate, role !== 'viewer' && (isManager || !archived));
        assert.equal(diary.props.canDelete, isManager);
      }
    }
  }
});
