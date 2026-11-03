const PAGE_SIZE = 80;

// Bound the expensive embedded project/task/report query, and publish only a
// complete list. A failed later page must not look like revoked project access.
export async function readProjectPages(buildRequest) {
  const rows = new Map();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let result = await buildRequest().range(offset, offset + PAGE_SIZE - 1);
    if (result.error && (result.status >= 500 || result.error.code === '57014')) {
      result = await buildRequest().range(offset, offset + PAGE_SIZE - 1);
    }
    if (result.error) return { ...result, data: null };
    for (const row of result.data || []) rows.set(row.id ?? row.project_id, row);
    if (!result.data || result.data.length < PAGE_SIZE) {
      return { ...result, data: [...rows.values()] };
    }
  }
}
