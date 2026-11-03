const PAGE_SIZE = 80;

// Bound database reads, and publish only a
// complete list. A failed later page must not look like revoked project access.
export async function readProjectPages(buildRequest, { pageSize = PAGE_SIZE } = {}) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) {
    throw new RangeError('Project read page size must be between 1 and 500');
  }
  const rows = new Map();
  for (let offset = 0; ; offset += pageSize) {
    let result = await buildRequest().range(offset, offset + pageSize - 1);
    if (result.error && (result.status >= 500 || result.error.code === '57014')) {
      result = await buildRequest().range(offset, offset + pageSize - 1);
    }
    if (result.error) return { ...result, data: null };
    for (const row of result.data || []) rows.set(row.id ?? row.project_id, row);
    if (!result.data || result.data.length < pageSize) {
      return { ...result, data: [...rows.values()] };
    }
  }
}
