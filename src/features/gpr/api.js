import { supabase } from '../../services/supabase.js';
import { orderPayload } from './model.js';
import { progressPatch } from './progress.js';

export async function updateOrderProgress(order, change) {
  const { data, error } = await supabase
    .from('gpr_work_orders')
    .update(progressPatch(order, change))
    .eq('id', order.id)
    .eq('updated_at', order.updated_at)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getOrders() {
  const { data, error } = await supabase
    .from('gpr_work_orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveOrder(form, userId) {
  const payload = orderPayload(form);
  const query = form.id
    ? supabase
        .from('gpr_work_orders')
        .update(payload)
        .eq('id', form.id)
        .eq('updated_at', form.updated_at)
    : supabase.from('gpr_work_orders').insert({ ...payload, created_by: userId });
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}

export async function linkOrderToProject(id, projectId, updatedAt) {
  const { error } = await supabase
    .from('gpr_work_orders')
    .update({ project_id: projectId })
    .eq('id', id)
    .eq('updated_at', updatedAt)
    .select('id')
    .single();
  if (error) throw error;
}

export async function microsoftAction(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('gpr-microsoft', {
    body: { action, ...payload },
  });
  if (error) {
    let code = 'service_unavailable';
    try {
      code = (await error.context?.json())?.error || code;
    } catch {
      /* No provider details are shown. */
    }
    throw Object.assign(new Error(code), { code });
  }
  return data;
}

export async function getOrderEmails(orderId) {
  const { data, error } = await supabase
    .from('gpr_order_emails')
    .select('id,sender,subject,body_text,received_at,has_attachments,web_url,status')
    .eq('order_id', orderId)
    .in('status', ['imported', 'linked'])
    .order('received_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data || [];
}
