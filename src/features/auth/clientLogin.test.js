import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { clientUsernameFromEmail } from '../../../supabase/functions/_shared/client-login.js';
import { heClientLogin, enClientLogin, elClientLogin, ptClientLogin } from './translations.js';
import { heTranslations, enTranslations, elTranslations, ptTranslations } from '../language/resources.js';

for (const [language, dictionary, resources] of [
  ['he', heClientLogin, heTranslations], ['en', enClientLogin, enTranslations], ['el', elClientLogin, elTranslations], ['pt', ptClientLogin, ptTranslations],
]) test(`username sign-in and account creation have complete ${language} translations`, () => {
  assert.deepEqual(Object.keys(dictionary), Object.keys(heClientLogin));
  for (const [key, value] of Object.entries(dictionary)) {
    assert.ok(value); assert.equal(resources[key], value);
    if (language !== 'he') assert.doesNotMatch(value, /[\u0590-\u05ff]/);
  }
  for (const path of ['components/LoginForm.jsx', '../users/CreateClientUser.jsx']) {
    for (const [, key] of readFileSync(new URL(path, import.meta.url), 'utf8').matchAll(/['"](clientLogin\.[A-Za-z]+)['"]/g)) assert.ok(dictionary[key], key);
  }
});

test('a missing client profile cannot fall back to automatic employee provisioning', async () => {
  let creates = 0;
  const profilesApi = {
    getProfileById: async () => ({ data: null }),
    getProfileByEmail: async () => ({ data: null }),
    createProfile: async () => { creates++; return { data: { role: 'field_worker' } }; },
  };
  const source = transformSync(readFileSync(new URL('./api.js', import.meta.url), 'utf8')
    .replace(/^import .*?;\s*/gm, '').replaceAll('export ', ''), { loader: 'js' }).code;
  const getOrCreateProfile = new Function('authApi', 'profilesApi', 'clientUsernameFromEmail', source + ';return getOrCreateProfile;')({}, profilesApi, clientUsernameFromEmail);
  const client = await getOrCreateProfile({ id: 'client', email: 'maya-client@clients.maya.invalid' });
  assert.equal(client.profile, null);
  assert.equal(client.error.message, 'clientLogin.profileMissing');
  assert.equal(creates, 0);
  await getOrCreateProfile({ id: 'employee', email: 'staff@example.com' });
  assert.equal(creates, 1);
});
