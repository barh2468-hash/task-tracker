// Match the drafter candidates supported by the project assignment workflow.
function isDrafter(profile) {
  return profile?.role === 'drafter' ||
    /(^|\s)(דודי|dudi|dudy)(\s|$)/i.test(String(profile?.full_name || '').trim());
}

export async function getStatusEmailRecipients(client, projectId, newStatus) {
  const { data: managers, error: managersError } = await client
    .from('profiles')
    .select('email,full_name')
    .in('role', ['manager', 'admin'])
    .not('email', 'is', null);
  if (managersError) throw managersError;

  const isDrafting = newStatus === 'עבר לשרטוט';
  let drafters = [];
  if (isDrafting || newStatus === 'עבר לבקרה') {
    // Resolve the current assignments on the server, never from request data.
    const { data: assignments, error } = await client
      .from('project_workers')
      .select('profiles:worker_id(id,email,full_name,role)')
      .eq('project_id', projectId);
    if (error) throw error;
    drafters = (assignments || []).map((row) => row.profiles).filter(isDrafter);
  }

  const recipients = Array.from(new Set(
    [...(managers || []), ...drafters]
      .map((profile) => profile.email?.trim().toLowerCase())
      .filter(Boolean),
  ));
  return {
    recipients,
    drafterIds: Array.from(new Set(drafters.map((profile) => profile.id).filter(Boolean))),
    isDrafting,
    awaitingDrafterAssignment: isDrafting && drafters.length === 0,
  };
}
