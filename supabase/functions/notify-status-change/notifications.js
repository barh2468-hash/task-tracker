// Use the caller's authenticated client so the notification records its author
// and the existing Push endpoint can verify it before delivering to devices.
export async function notifyReviewApprovedDrafters(client, drafterIds, projectId, title, body) {
  const results = await Promise.allSettled([...new Set(drafterIds)].map(async (userId) => {
    const notificationTitle = title.slice(0, 180);
    const { error } = await client.rpc('create_user_notification', {
      p_user_id: userId,
      p_type: 'project_review_approved',
      p_title: notificationTitle,
      p_body: body,
      p_project_id: projectId,
      p_task_id: null,
    });
    if (error) throw error;

    // A Push failure leaves the in-app notification available and must not
    // prevent email delivery to this drafter or notifications to other drafters.
    try {
      const { data, error: pushError } = await client.functions.invoke('send-push-notification', {
        body: {
          recipientUserId: userId,
          title: notificationTitle,
          body,
          projectId,
          url: `/app/projects?project=${encodeURIComponent(projectId)}`,
        },
      });
      if (pushError) throw pushError;
      if (data?.error) throw new Error(data.error);
      if (data?.failed) throw new Error('Push delivery failed');
      return { pushFailed: false };
    } catch (pushError) {
      console.warn('Drafter review approval Push failed:', pushError);
      return { pushFailed: true };
    }
  }));
  for (const result of results) {
    if (result.status === 'rejected') console.warn('Drafter review approval notification failed:', result.reason);
  }
  return {
    created: results.filter((result) => result.status === 'fulfilled').length,
    failed: results.filter((result) => result.status === 'rejected').length,
    pushFailed: results.filter((result) => result.status === 'fulfilled' && result.value.pushFailed).length,
  };
}
