// Retain the actual File objects for retry, and never upload a successful file twice.
export async function uploadContinuationAttachments(files, upload) {
  const failedAttachments = [];
  for (const file of files) {
    try {
      const result = await upload(file);
      if (!result?.ok) failedAttachments.push(file);
    } catch {
      failedAttachments.push(file);
    }
  }
  return failedAttachments;
}
