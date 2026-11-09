import test from 'node:test';
import assert from 'node:assert/strict';
import {heViewer,enViewer,elViewer} from './viewerTranslations.js';
import {enTranslations,elTranslations} from '../language/resources.js';
test('viewer labels and messages have complete English and Greek resources',()=>{
  for(const key of Object.keys(heViewer)){
    assert.ok(enViewer[key],`Missing English: ${key}`);
    assert.ok(elViewer[key],`Missing Greek: ${key}`);
    assert.equal(enTranslations[key],enViewer[key]);
    assert.equal(elTranslations[key],elViewer[key]);
    assert.doesNotMatch(enViewer[key],/[\u0590-\u05ff]/);
    assert.doesNotMatch(elViewer[key],/[\u0590-\u05ff]/);
  }
});
