import { taskReportEmail } from './template.js';
export async function deliverTaskReport(job, { client, sendEmail, appUrl, sendPush }) {
  let emailSent = Boolean(job.sent_at),
    pushDone = Boolean(job.push_sent_at);
  const errors = [];
  async function checkpoint(error = null) {
    const { error: finishError } = await client.rpc('finish_task_report_delivery', {
      p_report_id: job.report_id,
      p_recipient_id: job.recipient_id,
      p_token: job.claim_token,
      p_email_sent: emailSent,
      p_push_done: pushDone,
      p_error: error,
    });
    if (finishError) throw finishError;
  }
  if (!pushDone) {
    try {
      await sendPush(job);
      pushDone = true;
      await checkpoint();
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  try {
    if (!emailSent && job.recipient_email) {
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
    emailSent = true;
  } catch (failure) {
    errors.push(failure instanceof Error ? failure.message : String(failure));
  }
  await checkpoint(errors.join('; ') || null);
  return { ok: !errors.length };
}
