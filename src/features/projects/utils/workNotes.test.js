import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { transformSync } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { heTranslations, enTranslations, elTranslations } from '../../language/resources.js';
import { localeForLanguage } from '../../language/locale.js';
import { projectWorkNotes } from './workNotes.js';
import { escapeHtml } from '../../../utils/escapeHtml.js';
import { mapsLink } from '../../../utils/format.js';

const require = createRequire(import.meta.url);
const sessions = [
  { id: 'older', started_at: '2026-11-01T22:30:00Z', end_note: 'Earlier note', profiles: { full_name: 'Reporter One' } },
  { id: 'empty', started_at: '2026-11-03T06:00:00Z', end_note: ' \n ' },
  { id: 'latest', started_at: '2026-11-02T06:00:00Z', ended_at: '2026-11-02T14:00:00Z',
    end_note: '  Original <script>alert("x")</script> & Ω\nSecond line  ', profiles: { full_name: 'Reporter Two' },
    crew_members: [{ name: 'Crew Ω' }], started_lat: 32, started_lng: 34 },
];

function loadModule(path, language, translate) {
  const source = transformSync(readFileSync(new URL(path, import.meta.url), 'utf8'),
    { loader: path.endsWith('.jsx') ? 'jsx' : 'js', format: 'cjs', jsx: 'automatic' }).code;
  const module = { exports: {} };
  const imports = {
    'react-i18next': { useTranslation() {} },
    '../../language/LanguageContext.jsx': { t: translate, useLanguage: () => ({ language }) },
    '../../language/locale.js': { localeForLanguage },
    '../utils/workNotes.js': { projectWorkNotes },
    './workNotes.js': { projectWorkNotes },
    '../../../utils/escapeHtml.js': { escapeHtml },
    '../../../utils/format.js': { mapsLink },
  };
  new Function('require', 'module', 'exports', source)((name) => name in imports ? imports[name] : require(name), module, module.exports);
  return module.exports;
}

test('work notes retain original text, omit blank notes and sort by work date without mutating sessions', () => {
  const before = structuredClone(sessions);
  assert.deepEqual(projectWorkNotes(sessions).map((session) => session.id), ['latest', 'older']);
  assert.equal(projectWorkNotes(sessions)[0].end_note, sessions[2].end_note);
  assert.deepEqual(sessions, before);
});

for (const [language, dictionary] of Object.entries({ he: heTranslations, en: enTranslations, el: elTranslations })) {
  test(`work note UI states and exported report are localized and preserve notes safely in ${language}`, async () => {
    const instance = i18next.createInstance();
    await instance.init({ lng: language, fallbackLng: false, keySeparator: false, nsSeparator: false,
      interpolation: { escapeValue: false }, resources: { [language]: { translation: dictionary } } });
    const translate = (key, values) => instance.t(key, { defaultValue: language === 'he' ? key : '', ...values });
    const Component = loadModule('../components/ProjectWorkNotes.jsx', language, translate).default;
    const render = (props) => renderToStaticMarkup(createElement(Component, props));
    const populated = render({ sessions });
    assert.ok(populated.includes(escapeHtml(sessions[2].end_note)));
    assert.ok(populated.indexOf('Reporter Two') < populated.indexOf('Reporter One'));
    assert.doesNotMatch(populated, /<script>/);
    assert.ok(populated.includes(new Date(sessions[0].started_at).toLocaleString(localeForLanguage(language), { timeZone: 'Asia/Jerusalem' })));
    for (const [props, key] of [
      [{ sessions: [], loading: true }, 'loading'], [{ sessions: [], error: true }, 'error'],
      [{ sessions: [] }, 'empty'], [{}, 'unavailable'],
    ]) {
      const markup = render(props);
      assert.ok(markup.includes(translate(`projectWorkNotes.${key}`)), key);
      if (props.loading) assert.match(markup, /role="status"/);
      if (props.error) assert.match(markup, /role="alert"/);
      if (language !== 'he') assert.doesNotMatch(markup, /[\u0590-\u05ff]/);
    }
    const { projectReportHtml } = loadModule('./exportProjectPdf.js', language, translate);
    const html = projectReportHtml({ name: 'User project Ω', status: 'בעבודה', progress: 25,
      description: 'User description', additional_notes: 'Additional user text', work_sessions: sessions }, [], language);
    assert.match(html, new RegExp(`lang="${language}" dir="${language === 'he' ? 'rtl' : 'ltr'}"`));
    assert.ok(html.includes(escapeHtml(sessions[2].end_note)));
    assert.ok(html.includes('Reporter Two'));
    assert.ok(html.includes('Crew Ω'));
    assert.ok(html.includes('https://www.google.com/maps?q=32,34'));
    assert.ok(html.includes(translate('projectWorkNotes.title')));
    assert.doesNotMatch(html, /<script>|\{\{|projectReport\.|projectWorkNotes\./);
    if (language !== 'he') assert.doesNotMatch(html, /[\u0590-\u05ff]/);
    for (const key of Object.keys(heTranslations).filter((key) => /^(projectWorkNotes|projectReport)\./.test(key))) {
      assert.ok(dictionary[key], key);
    }
  });
}
