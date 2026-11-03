const ID_BATCH_SIZE = 80;

// Keep task/report reads separate from the project/team query. The former
// nested embed expanded the same RLS dependency tree at every relation level.
// Only publish a complete graph, preserving the existing UI response shape.
export async function hydrateProjectTasks(result, readTasks, readReports) {
  if (result.error || !result.data?.length) return result;
  const projectIds = result.data.map((project) => project.id);
  const permittedProjects = new Set(projectIds);
  const tasks = [];
  for (let offset = 0; offset < projectIds.length; offset += ID_BATCH_SIZE) {
    const batch = await readTasks(projectIds.slice(offset, offset + ID_BATCH_SIZE));
    if (batch.error) return { ...batch, data: null };
    tasks.push(...(batch.data || []).filter((task) => permittedProjects.has(task.project_id)));
  }
  const reportsByTask = new Map();
  const taskIds = [...new Set(tasks.map((task) => task.id))];
  for (let offset = 0; offset < taskIds.length; offset += ID_BATCH_SIZE) {
    const batch = await readReports(taskIds.slice(offset, offset + ID_BATCH_SIZE));
    if (batch.error) return { ...batch, data: null };
    for (const report of batch.data || []) {
      const reports = reportsByTask.get(report.task_id) || [];
      reports.push(report);
      reportsByTask.set(report.task_id, reports);
    }
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
