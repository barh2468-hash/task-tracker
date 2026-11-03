import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendEmail } from '../_shared/smtp.ts';
import { deliverTaskReport } from './delivery.js';
import { deliverTaskReportPush } from './push.js';
import webpush from 'npm:web-push@3.6.7';
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,x-client-info,apikey,content-type,x-cron-secret',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
function secureEquals(a: string, b: string) {
  const left = new TextEncoder().encode(a),
    right = new TextEncoder().encode(b);
  if (!left.length || left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL')!,
      anon = Deno.env.get('SUPABASE_ANON_KEY')!,
      service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    let reportId: string | null = null;
    if (!secureEquals(Deno.env.get('CRON_SECRET') || '', req.headers.get('x-cron-secret') || '')) {
      const caller = createClient(url, anon, {
        global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
      });
      const { data: auth, error } = await caller.auth.getUser();
      if (error || !auth.user) return reply({ error: 'Unauthorized' }, 401);
      const payload = await req.json();
      if (!payload.reportId)
        return reply(
          { error: 'An execution report is required. Refresh the app before completing a task.' },
          409,
        );
      const { data: report, error: readError } = await caller
        .from('project_task_reports')
        .select('id,created_by')
        .eq('id', payload.reportId)
        .single();
      if (readError || !report || report.created_by !== auth.user.id)
        return reply({ error: 'Report access denied' }, 403);
      reportId = report.id;
    }
    const client = createClient(url, service);
    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY'),
      privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    if (publicKey && privateKey)
      webpush.setVapidDetails(
        Deno.env.get('VAPID_SUBJECT') || 'mailto:office@maya-tm.com',
        publicKey,
        privateKey,
      );
    async function deliver() {
      try {
        const { data: jobs, error } = await client.rpc('claim_task_report_emails', {
          p_report_id: reportId,
        });
        if (error) throw error;
        // Bound SMTP connections while draining all recipients from this claim.
        const results = [];
        for (let offset = 0; offset < (jobs || []).length; offset += 5) {
          results.push(
            ...(await Promise.all(
              jobs.slice(offset, offset + 5).map((job: Record<string, unknown>) =>
                deliverTaskReport(job, {
                  client,
                  sendEmail,
                  appUrl: Deno.env.get('APP_URL') || '',
                  sendPush: (notice: Record<string, unknown>) =>
                    deliverTaskReportPush(notice, {
                      client,
                      sendPush: webpush.sendNotification.bind(webpush),
                      configured: Boolean(publicKey && privateKey),
                    }),
                }).catch((error: unknown) => {
                  console.error(
                    'Task report recipient remains queued:',
                    error instanceof Error ? error.message : String(error),
                  );
                  return { ok: false };
                }),
              ),
            )),
          );
        }
        console.log(
          JSON.stringify({
            event: 'task_report_delivery',
            processed: results.length,
            delivered: results.filter((result: { ok: boolean }) => result.ok).length,
          }),
        );
      } catch (error) {
        console.error(
          'Task report delivery remains queued:',
          error instanceof Error ? error.message : String(error),
        );
      }
    }
    EdgeRuntime.waitUntil(deliver());
    return reply({ ok: true, queued: true }, 202);
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
