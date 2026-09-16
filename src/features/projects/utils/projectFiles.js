export const MAX_PROJECT_FILE_SIZE = 20 * 1024 * 1024;

export const PDF_ACCEPT = 'application/pdf,.pdf';
export const PDF_OR_IMAGE_ACCEPT =
  'application/pdf,image/jpeg,image/png,image/webp,image/heic,.pdf,.jpg,.jpeg,.png,.webp,.heic';

const supportedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
const supportedImageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic'];

export function documentTypeAllowsImages(documentType) {
  return documentType === 'boundary_sketch' || documentType === 'drawing_correction';
}

export function isPdfFile(file) {
  const fileName = String(file?.name || '').toLowerCase();
  return fileName.endsWith('.pdf') && (!file?.type || file.type === 'application/pdf');
}

export function isSupportedImageFile(file) {
  const fileName = String(file?.name || '').toLowerCase();
  const hasSupportedExtension = supportedImageExtensions.some((extension) =>
    fileName.endsWith(extension),
  );
  return hasSupportedExtension && (!file?.type || supportedImageTypes.has(file.type));
}

export function isImageDocument(document) {
  if (String(document?.mime_type || '').startsWith('image/')) return true;
  const fileName = String(document?.file_name || '').toLowerCase();
  return supportedImageExtensions.some((extension) => fileName.endsWith(extension));
}
