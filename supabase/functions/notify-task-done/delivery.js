import { taskReportEmail } from './template.js';
export async function deliverTaskReport(job, { client, sendEmail, appUrl }) {
  let error = null;
  try {
    const { data: preference, error: preferenceError } = await client
      .from('notification_preferences')
      .select('enabled')
      .eq('user_id', job.recipient_id)
      .eq('category', 'completed_tasks')
      .maybeSingle();
    if (preferenceError && !['42P01', 'PGRST205'].includes(preferenceError.code))
      throw preferenceError;
    if (job.recipient_email && preference?.enabled !== false) {
      const links = [];
      for (const file of job.report.attachments || []) {
        if (!file.file_path.startsWith(`${job.report.project_id}/`))
          throw new Error('Invalid attachment path');
        const { data, error: signError } = await client.storage
          .from('project-documents')
          .createSignedUrl(file.file_path, 7 * 86400);
        if (
          signError &&
          !/not found|does not exist/i.test(signError.message || '') &&
          String(signError.statusCode) !== '404'
        )
          throw signError;
        links.push({ name: file.file_name, url: signError ? null : data.signedUrl });
      }
      const receipt = await sendEmail({
        to: [job.recipient_email],
        ...taskReportEmail({ ...job, links, appUrl }),
      });
      if (
        Array.isArray(receipt?.accepted) &&
        !receipt.accepted.some(
          (address) => String(address).toLowerCase() === job.recipient_email.toLowerCase(),
        )
      )
        throw new Error('Email recipient was rejected');
    }
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  }
  const { error: finishError } = await client.rpc('finish_task_report_email', {
    p_report_id: job.report_id,
    p_recipient_id: job.recipient_id,
    p_token: job.claim_token,
    p_error: error,
  });
  if (finishError) throw finishError;
  return { ok: !error };
}
