const ID_BATCH_SIZE = 80;
const MAX_CONCURRENT_READS = 3;

async function readBatches(ids, readBatch) {
  const batchCount = Math.ceil(ids.length / ID_BATCH_SIZE);
  const results = new Array(batchCount);
  let nextBatch = 0;
  let failure = null;
  async function worker() {
    while (!failure && nextBatch < batchCount) {
      const index = nextBatch++;
      try {
        const result = await readBatch(ids.slice(index * ID_BATCH_SIZE, (index + 1) * ID_BATCH_SIZE));
        if (result.error) { failure = result; return; }
        results[index] = result.data || [];
      } catch (error) {
        failure = { error };
        return;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_READS, batchCount) }, worker));
  return failure ? { ...failure, data: null } : { data: results.flat() };
}

// Keep task/report reads separate from the project/team query. The former
// nested embed expanded the same RLS dependency tree at every relation level.
// Only publish a complete graph, preserving the existing UI response shape.
export async function hydrateProjectTasks(result, readTasks, readReports) {
  if (result.error || !result.data?.length) return result;
  const projectIds = result.data.map((project) => project.id);
  const permittedProjects = new Set(projectIds);
  const taskResult = await readBatches(projectIds, readTasks);
  if (taskResult.error) return taskResult;
  const tasks = taskResult.data.filter((task) => permittedProjects.has(task.project_id));
  const reportsByTask = new Map();
  const taskIds = [...new Set(tasks.map((task) => task.id))];
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const reportResult = await readBatches(taskIds, (batchTaskIds) => readReports(batchTaskIds,
    batchTaskIds.map((id) => tasksById.get(id)?.latest_report_id).filter(Boolean)));
  if (reportResult.error) return reportResult;
  for (const report of reportResult.data) {
      const reports = reportsByTask.get(report.task_id) || [];
      reports.push(report);
      reportsByTask.set(report.task_id, reports);
  }
  const tasksByProject = new Map();
  for (const task of tasks) {
    const items = tasksByProject.get(task.project_id) || [];
    items.push({ ...task, project_task_reports: reportsByTask.get(task.id) || [] });
    tasksByProject.set(task.project_id, items);
  }
  return { ...result, data: result.data.map((project) => ({
    ...project, project_tasks: tasksByProject.get(project.id) || [],
  })) };
}
