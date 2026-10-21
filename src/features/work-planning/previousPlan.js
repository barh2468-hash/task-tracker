import { copyPlanRows, planStorageKey, readPlan, shiftPlanDate } from './localPlans.js';

export async function copyPreviousPlan({ date, storageScope, storage, loadPublished }) {
  const previousDate = shiftPlanDate(date, -1);
  // A shared publication is the company-wide source, even on a new device or
  // when this device still has a different unpublished draft for yesterday.
  if (loadPublished) {
    const publication = await loadPublished(previousDate);
    if (publication?.rows.length) return {
      rows: copyPlanRows(publication.rows), rosterNames: [...publication.roster_names],
    };
  }
  const previous = readPlan(storage, planStorageKey(storageScope, previousDate));
  const rows = previous?.rows.length ? previous.rows : previous?.publishedRows;
  if (!rows?.length) return null;
  return { rows: copyPlanRows(rows), rosterNames: previous.rosterNames ? [...previous.rosterNames] : undefined };
}
