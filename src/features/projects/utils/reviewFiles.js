export function appendReviewFiles(selectedFiles, addedFiles) {
  const result = [...selectedFiles];
  for (const file of addedFiles) {
    if (
      !result.some(
        (selected) =>
          selected.name === file.name &&
          selected.size === file.size &&
          selected.lastModified === file.lastModified,
      )
    ) {
      result.push(file);
    }
  }
  return result;
}

export function getReviewFileVersions(files) {
  const scope = (file) => `${file.project_id || ''}/${file.drawing_batch_id || ''}`;
  const time = (file) => Date.parse(file.created_at) || 0;
  const latestByScope = new Map();
  for (const file of files) {
    latestByScope.set(scope(file), Math.max(latestByScope.get(scope(file)) || 0, time(file)));
  }
  // One bulk insert gives every PDF in a submission the same database timestamp.
  // Keep that whole set current, independently for each project/drawing batch.
  return [...files]
    .sort((left, right) => time(right) - time(left))
    .map((file) => ({
      file,
      isSuperseded: time(file) > 0 && time(file) < latestByScope.get(scope(file)),
    }));
}
