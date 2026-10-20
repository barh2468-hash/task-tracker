import assert from 'node:assert/strict';
import test from 'node:test';
import {
  documentTypeAllowsImages,
  isPdfFile,
  isSupportedImageFile,
  isImageDocument,
  projectFileMimeType,
} from './projectFiles.js';

test('general project files and existing document categories accept supported images', () => {
  for (const type of ['general', 'drawing_source', 'drawing_correction', 'boundary_sketch']) {
    assert.equal(documentTypeAllowsImages(type), true);
  }
  assert.equal(documentTypeAllowsImages('unknown'), false);
});

test('PDFs and supported image formats retain their upload content type', () => {
  assert.equal(isPdfFile({ name: 'plan.PDF', type: 'application/pdf' }), true);
  for (const [extension, mime] of [
    ['jpg', 'image/jpeg'],
    ['jpeg', 'image/jpeg'],
    ['png', 'image/png'],
    ['webp', 'image/webp'],
    ['heic', 'image/heic'],
  ]) {
    const file = { name: `photo.${extension.toUpperCase()}`, type: mime };
    assert.equal(isSupportedImageFile(file), true);
    assert.equal(projectFileMimeType(file), mime);
  }
});

test('mobile files with no MIME type infer the storage content type from their extension', () => {
  for (const [name, mime] of [
    ['plan.pdf', 'application/pdf'],
    ['photo.JPG', 'image/jpeg'],
    ['photo.png', 'image/png'],
    ['photo.webp', 'image/webp'],
    ['photo.heic', 'image/heic'],
  ]) {
    assert.equal(projectFileMimeType({ name, type: '' }), mime);
    assert.equal(isImageDocument({ file_name: name, mime_type: null }), mime.startsWith('image/'));
  }
});

test('other file types and executable or SVG images remain unsupported', () => {
  for (const file of [
    { name: 'script.svg', type: 'image/svg+xml' },
    { name: 'document.docx', type: '' },
    { name: 'archive.zip', type: '' },
    { name: 'fake.jpg', type: 'application/javascript' },
    { name: 'fake.exe', type: 'image/png' },
  ]) {
    assert.equal(isSupportedImageFile(file), false);
    assert.equal(isPdfFile(file), false);
    assert.equal(projectFileMimeType(file), null);
  }
});
