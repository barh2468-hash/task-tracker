-- Allow a conversation member to delete the conversation and its messages for everyone.

create or replace function public.delete_chat_conversation(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  delete from public.chat_conversations c
  where c.id = p_conversation_id
    and exists (
      select 1
      from public.chat_members cm
      where cm.conversation_id = c.id
        and cm.user_id = v_user_id
    );

  if not found then
    raise exception 'Conversation not found or access denied';
  end if;
end;
$$;

revoke all on function public.delete_chat_conversation(uuid) from public;
revoke all on function public.delete_chat_conversation(uuid) from anon;
grant execute on function public.delete_chat_conversation(uuid) to authenticated;
