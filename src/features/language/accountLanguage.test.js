import test from 'node:test';
import assert from 'node:assert/strict';
import { languagePreferenceForUser, readLanguagePreference } from './accountLanguage.js';

const johnny = 'ab110d9f-1202-4e92-878a-ec5d0b2a8c86';
const storage = entries => ({getItem: key => entries[key] ?? null});

test('Johnny defaults to English even when another user chose Hebrew on this device', () => {
  assert.equal(readLanguagePreference(storage({'maya-language':'he'}),johnny),'en');
  assert.equal(readLanguagePreference(storage({}),johnny),'en');
});

test('Johnny can keep an explicit language choice separately from other accounts', () => {
  const {key}=languagePreferenceForUser(johnny);
  for(const language of ['he','en','el'])
    assert.equal(readLanguagePreference(storage({[key]:language,'maya-language':'pt'}),johnny),language);
  assert.equal(readLanguagePreference(storage({[key]:'el','maya-language':'he'}),'other-user'),'he');
});

test('other users and the login screen retain the existing device language preference', () => {
  for(const userId of [null,'another-user']) {
    assert.equal(readLanguagePreference(storage({'maya-language':'el'}),userId),'el');
    assert.equal(readLanguagePreference(storage({}),userId),'he');
  }
});

test('unsupported account preferences fall back to that accounts default', () => {
  const {key}=languagePreferenceForUser(johnny);
  assert.equal(readLanguagePreference(storage({[key]:'unsupported'}),johnny),'en');
});
