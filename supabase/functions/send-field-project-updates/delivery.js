export function escapeEmailHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

export async function deliverFieldUpdate({ job, client, sendEmail, sendPush, appUrl = '' }) {
  let emailSent = Boolean(job.email_sent_at);
  async function finish(done, error = null) {
    const result = await client.rpc('finish_field_project_update', {
      p_id: job.id, p_claim_token: job.claim_token, p_email_sent: emailSent, p_done: done, p_error: error,
    });
    if (result.error) throw result.error;
  }
  try {
    if (!emailSent) {
      const { data: worker, error } = await client.from('profiles').select('email,full_name').eq('id', job.recipient_id).single();
      if (error) throw error;
      if (!worker?.email) throw new Error('Employee email address is missing');
      const projectUrl = appUrl ? `${appUrl.replace(/\/$/, '')}/app/projects?project=${encodeURIComponent(job.project_id)}` : '';
      const result = await sendEmail({
        to: [worker.email], subject: job.title,
        text: `${job.title}\n${job.body}${projectUrl ? `\n${projectUrl}` : ''}`,
        html: `<html lang="he" dir="rtl"><body style="font-family:Arial,sans-serif;line-height:1.7;color:#10213f"><h2>${escapeEmailHtml(job.title)}</h2><p>שלום ${escapeEmailHtml(worker.full_name)},</p><p>${escapeEmailHtml(job.body)}</p>${projectUrl ? `<p><a href="${escapeEmailHtml(projectUrl)}">פתיחת הפרויקט</a></p>` : ''}</body></html>`,
      });
      if (result.rejected?.length || !result.accepted?.length) throw new Error('SMTP did not accept the employee email');
      emailSent = true;
      // Persist mail success before Push. A failed Push must never resend mail.
      await finish(false);
    }
    await sendPush(job);
    await finish(true);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finish(false, message);
    return { ok: false, error: message };
  }
}
