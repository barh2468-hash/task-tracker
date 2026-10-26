-- Reply to, edit and delete your own chat messages.
-- Editing is allowed for 24 hours and marks the message as edited. Deleting
-- keeps a "message deleted" placeholder, so replies and the conversation
-- still read correctly, but wipes the text and any project link.

alter table public.chat_messages
  add column if not exists reply_to_id uuid
    references public.chat_messages(id) on delete set null,
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;

create index if not exists chat_messages_reply_to_idx
  on public.chat_messages(reply_to_id)
  where reply_to_id is not null;

-- A reply must point at a message in the same conversation.
create or replace function private.check_chat_reply()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if new.reply_to_id is not null and not exists (
    select 1 from public.chat_messages r
    where r.id = new.reply_to_id
      and r.conversation_id = new.conversation_id
  ) then
    raise exception 'Replies must point at a message in the same conversation';
  end if;
  return new;
end;
$$;

revoke all on function private.check_chat_reply() from public, anon, authenticated;

drop trigger if exists chat_message_reply_check on public.chat_messages;
create trigger chat_message_reply_check
before insert or update of reply_to_id on public.chat_messages
for each row execute function private.check_chat_reply();

-- New messages cannot arrive already edited or deleted.
drop policy if exists "chat messages insert by members" on public.chat_messages;
create policy "chat messages insert by members" on public.chat_messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and kind = 'message'
  and event_type is null
  and edited_at is null
  and deleted_at is null
  and public.is_chat_member(conversation_id)
);

create or replace function public.edit_chat_message(p_message_id uuid, p_body text)
returns public.chat_messages
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_message public.chat_messages;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if nullif(trim(p_body), '') is null then
    raise exception 'Message cannot be empty';
  end if;

  update public.chat_messages m
  set body = left(trim(p_body), 4000),
      edited_at = now()
  where m.id = p_message_id
    and m.sender_id = auth.uid()
    and m.kind = 'message'
    and m.deleted_at is null
    and m.created_at > now() - interval '24 hours'
    and public.is_chat_member(m.conversation_id)
  returning m.* into v_message;

  if not found then
    raise exception 'Only your own messages from the last 24 hours can be edited';
  end if;
  return v_message;
end;
$$;

create or replace function public.delete_chat_message(p_message_id uuid)
returns public.chat_messages
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_message public.chat_messages;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.chat_messages m
  set body = 'ההודעה נמחקה',
      project_id = null,
      project_label = null,
      edited_at = null,
      deleted_at = now()
  where m.id = p_message_id
    and m.sender_id = auth.uid()
    and m.kind = 'message'
    and m.deleted_at is null
    and public.is_chat_member(m.conversation_id)
  returning m.* into v_message;

  if not found then
    raise exception 'Only your own messages can be deleted';
  end if;
  return v_message;
end;
$$;

revoke all on function public.edit_chat_message(uuid, text) from public, anon;
revoke all on function public.delete_chat_message(uuid) from public, anon;
grant execute on function public.edit_chat_message(uuid, text) to authenticated;
grant execute on function public.delete_chat_message(uuid) to authenticated;
