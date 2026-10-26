-- Project chat rooms: one conversation per project, kept apart from personal
-- chats. Members follow the project's assignments (responsible worker,
-- project_workers incl. drafters) plus all managers. Project activity
-- (status, photos, files, tasks) is posted into the room as silent "event"
-- lines written by triggers; only people's own messages send a push.
-- Personal chats: anyone can hide a chat for themselves (it returns on the
-- next message); deleting a chat for everyone is limited to managers/admins.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---- Schema -------------------------------------------------------------

alter table public.chat_conversations
  add column if not exists project_id uuid unique
    references public.projects(id) on delete cascade;

alter table public.chat_members
  add column if not exists muted boolean not null default false,
  -- "Hide chat" is per member and undone by the next new message.
  add column if not exists hidden_at timestamptz;

alter table public.chat_messages
  add column if not exists kind text not null default 'message',
  add column if not exists event_type text,
  add column if not exists event_data jsonb;

-- Events written by the system (no signed-in actor) have no sender.
alter table public.chat_messages alter column sender_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chat_messages_kind_check'
      and conrelid = 'public.chat_messages'::regclass
  ) then
    alter table public.chat_messages
      add constraint chat_messages_kind_check check (
        (kind = 'message' and sender_id is not null and event_type is null)
        or (kind = 'event' and event_type is not null)
      );
  end if;
end $$;

-- Members may only change their own read position and mute flag.
revoke update on public.chat_members from authenticated;
grant update (last_read_at, muted) on public.chat_members to authenticated;

-- People can only post ordinary messages; events come from triggers.
drop policy if exists "chat messages insert by members" on public.chat_messages;
create policy "chat messages insert by members" on public.chat_messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and kind = 'message'
  and event_type is null
  and public.is_chat_member(conversation_id)
);

-- ---- Membership ---------------------------------------------------------

-- Managers, the responsible worker and everyone in project_workers.
create or replace function private.belongs_in_project_chat(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.profiles pr
    where pr.id = p_user_id
      and (
        pr.role in ('manager', 'admin')
        or exists (
          select 1 from public.projects p
          where p.id = p_project_id and p.assigned_to = p_user_id
        )
        or exists (
          select 1 from public.project_workers pw
          where pw.project_id = p_project_id and pw.worker_id = p_user_id
        )
      )
  );
$$;

create or replace function private.sync_project_chat_members(
  p_conversation_id uuid,
  p_project_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  -- New members start "read" so they are not flooded with old history.
  insert into public.chat_members (conversation_id, user_id, last_read_at)
  select p_conversation_id, pr.id, now()
  from public.profiles pr
  where private.belongs_in_project_chat(p_project_id, pr.id)
  on conflict (conversation_id, user_id) do nothing;

  delete from public.chat_members cm
  where cm.conversation_id = p_conversation_id
    and not private.belongs_in_project_chat(p_project_id, cm.user_id);
end;
$$;

create or replace function private.ensure_project_conversation(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_conversation_id uuid;
  v_creator uuid;
begin
  select c.id into v_conversation_id
  from public.chat_conversations c
  where c.project_id = p_project_id;

  if v_conversation_id is null then
    select coalesce(auth.uid(), p.created_by, p.assigned_to,
      (select pr.id from public.profiles pr where pr.role = 'admin' order by pr.created_at limit 1))
    into v_creator
    from public.projects p
    where p.id = p_project_id;

    if v_creator is null then
      return null;
    end if;

    insert into public.chat_conversations (project_id, created_by)
    values (p_project_id, v_creator)
    on conflict (project_id) do nothing
    returning id into v_conversation_id;

    if v_conversation_id is null then
      select c.id into v_conversation_id
      from public.chat_conversations c
      where c.project_id = p_project_id;
    end if;
  end if;

  perform private.sync_project_chat_members(v_conversation_id, p_project_id);
  return v_conversation_id;
end;
$$;

-- Opens (creating on first use) the room of a project the caller can see.
create or replace function public.get_project_conversation(p_project_id uuid)
returns table (conversation_id uuid, muted boolean, member_count bigint)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.is_manager()
    or exists (
      select 1 from public.projects p
      where p.id = p_project_id
        and (
          p.assigned_to = auth.uid()
          or exists (
            select 1 from public.project_workers pw
            where pw.project_id = p.id and pw.worker_id = auth.uid()
          )
        )
    )
  ) then
    raise exception 'Project access denied';
  end if;

  v_conversation_id := private.ensure_project_conversation(p_project_id);

  return query
  select
    v_conversation_id,
    coalesce((
      select cm.muted from public.chat_members cm
      where cm.conversation_id = v_conversation_id and cm.user_id = auth.uid()
    ), false),
    (select count(*) from public.chat_members cm where cm.conversation_id = v_conversation_id);
end;
$$;

-- Keep existing rooms in step with assignments and role changes. Rooms that
-- do not exist yet are created (with current members) on first use.
create or replace function private.sync_project_chat_on_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_project_id uuid;
  v_conversation_id uuid;
begin
  if tg_table_name = 'projects' then
    v_project_id := new.id;
  elsif tg_op = 'DELETE' then
    v_project_id := old.project_id;
  else
    v_project_id := new.project_id;
  end if;

  select c.id into v_conversation_id
  from public.chat_conversations c
  where c.project_id = v_project_id;

  if v_conversation_id is not null then
    perform private.sync_project_chat_members(v_conversation_id, v_project_id);
  end if;
  return null;
exception when others then
  -- Chat membership must never block an assignment.
  raise warning 'project chat membership sync failed: %', sqlerrm;
  return null;
end;
$$;

drop trigger if exists sync_project_chat_on_worker_change on public.project_workers;
create trigger sync_project_chat_on_worker_change
after insert or delete on public.project_workers
for each row execute function private.sync_project_chat_on_assignment();

drop trigger if exists sync_project_chat_on_assignee_change on public.projects;
create trigger sync_project_chat_on_assignee_change
after update of assigned_to on public.projects
for each row
when (old.assigned_to is distinct from new.assigned_to)
execute function private.sync_project_chat_on_assignment();

create or replace function private.sync_project_chats_on_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_room record;
begin
  for v_room in
    select c.id, c.project_id from public.chat_conversations c where c.project_id is not null
  loop
    perform private.sync_project_chat_members(v_room.id, v_room.project_id);
  end loop;
  return null;
exception when others then
  raise warning 'project chat role sync failed: %', sqlerrm;
  return null;
end;
$$;

drop trigger if exists sync_project_chats_on_role_change on public.profiles;
create trigger sync_project_chats_on_role_change
after update of role on public.profiles
for each row
when (old.role is distinct from new.role)
execute function private.sync_project_chats_on_role_change();

-- ---- Activity events ----------------------------------------------------

create or replace function private.post_project_chat_event(
  p_project_id uuid,
  p_actor uuid,
  p_event_type text,
  p_event_data jsonb,
  p_body text
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_conversation_id uuid;
  v_last record;
begin
  v_conversation_id := private.ensure_project_conversation(p_project_id);
  if v_conversation_id is null then
    return;
  end if;

  -- Several photos or files uploaded together become one counted line, as
  -- long as nothing else was posted after it. Rows saved in one transaction
  -- share a timestamp, so ties count as "not after".
  if p_event_type in ('photo_added', 'document_added') then
    select m.id
    into v_last
    from public.chat_messages m
    where m.conversation_id = v_conversation_id
      and m.kind = 'event'
      and m.event_type = p_event_type
      and m.sender_id is not distinct from p_actor
      and m.created_at > now() - interval '10 minutes'
      and not exists (
        select 1 from public.chat_messages newer
        where newer.conversation_id = m.conversation_id
          and newer.created_at > m.created_at
      )
    order by m.created_at desc
    limit 1;

    if v_last.id is not null then
      update public.chat_messages m
      set event_data = jsonb_set(
        coalesce(m.event_data, '{}'::jsonb),
        '{count}',
        to_jsonb(coalesce((m.event_data ->> 'count')::int, 1) + 1)
      )
      where m.id = v_last.id;
      return;
    end if;
  end if;

  insert into public.chat_messages (conversation_id, sender_id, body, kind, event_type, event_data)
  values (
    v_conversation_id,
    p_actor,
    left(coalesce(nullif(trim(p_body), ''), p_event_type), 4000),
    'event',
    p_event_type,
    p_event_data
  );
end;
$$;

create or replace function private.project_chat_activity()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if tg_table_name = 'status_history' then
    perform private.post_project_chat_event(
      new.project_id, new.changed_by, 'status_changed',
      jsonb_build_object('from', new.old_status, 'to', new.new_status, 'note', new.note),
      'הסטטוס עודכן: ' || coalesce(new.new_status, '')
    );
  elsif tg_table_name = 'project_photos' then
    perform private.post_project_chat_event(
      new.project_id, new.uploaded_by, 'photo_added',
      jsonb_build_object('count', 1, 'category', new.category),
      'נוספה תמונה'
    );
  elsif tg_table_name = 'project_documents' then
    perform private.post_project_chat_event(
      new.project_id, new.uploaded_by, 'document_added',
      jsonb_build_object('count', 1, 'file_name', new.file_name, 'document_type', new.document_type),
      'נוסף קובץ: ' || coalesce(new.file_name, '')
    );
  elsif tg_table_name = 'project_tasks' and tg_op = 'INSERT' then
    perform private.post_project_chat_event(
      new.project_id, new.created_by, 'task_added',
      jsonb_build_object('task_id', new.id, 'title', new.title),
      'משימה חדשה: ' || coalesce(new.title, '')
    );
  elsif tg_table_name = 'project_tasks' and tg_op = 'UPDATE' then
    perform private.post_project_chat_event(
      new.project_id, coalesce(auth.uid(), new.created_by), 'task_completed',
      jsonb_build_object('task_id', new.id, 'title', new.title),
      'משימה הושלמה: ' || coalesce(new.title, '')
    );
  end if;
  return null;
exception when others then
  -- A chat problem must never fail the project change itself.
  raise warning 'project chat event failed: %', sqlerrm;
  return null;
end;
$$;

drop trigger if exists project_chat_status_event on public.status_history;
create trigger project_chat_status_event
after insert on public.status_history
for each row execute function private.project_chat_activity();

drop trigger if exists project_chat_photo_event on public.project_photos;
create trigger project_chat_photo_event
after insert on public.project_photos
for each row execute function private.project_chat_activity();

drop trigger if exists project_chat_document_event on public.project_documents;
create trigger project_chat_document_event
after insert on public.project_documents
for each row execute function private.project_chat_activity();

drop trigger if exists project_chat_task_added_event on public.project_tasks;
create trigger project_chat_task_added_event
after insert on public.project_tasks
for each row execute function private.project_chat_activity();

drop trigger if exists project_chat_task_completed_event on public.project_tasks;
create trigger project_chat_task_completed_event
after update of is_done on public.project_tasks
for each row
when (new.is_done and not old.is_done)
execute function private.project_chat_activity();

revoke all on function private.belongs_in_project_chat(uuid, uuid) from public, anon, authenticated;
revoke all on function private.sync_project_chat_members(uuid, uuid) from public, anon, authenticated;
revoke all on function private.ensure_project_conversation(uuid) from public, anon, authenticated;
revoke all on function private.sync_project_chat_on_assignment() from public, anon, authenticated;
revoke all on function private.sync_project_chats_on_role_change() from public, anon, authenticated;
revoke all on function private.post_project_chat_event(uuid, uuid, text, jsonb, text) from public, anon, authenticated;
revoke all on function private.project_chat_activity() from public, anon, authenticated;

revoke all on function public.get_project_conversation(uuid) from public, anon;
grant execute on function public.get_project_conversation(uuid) to authenticated;

-- ---- Lists --------------------------------------------------------------

-- Personal chats only; project rooms have their own inbox below.
create or replace function public.get_chat_conversations()
returns table (
  id uuid,
  title text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  member_ids uuid[],
  last_message_body text,
  last_message_at timestamptz,
  last_sender_id uuid,
  unread_count bigint
)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    c.id,
    c.title,
    c.created_by,
    c.created_at,
    c.updated_at,
    member_list.member_ids,
    latest.body,
    latest.created_at,
    latest.sender_id,
    unread.unread_count
  from public.chat_members mine
  join public.chat_conversations c on c.id = mine.conversation_id
  cross join lateral (
    select array_agg(cm.user_id order by cm.joined_at) as member_ids
    from public.chat_members cm
    where cm.conversation_id = c.id
  ) member_list
  left join lateral (
    select m.body, m.created_at, m.sender_id
    from public.chat_messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) latest on true
  cross join lateral (
    select count(*) as unread_count
    from public.chat_messages m
    where m.conversation_id = c.id
      and m.kind = 'message'
      and m.sender_id <> auth.uid()
      and m.created_at > coalesce(mine.last_read_at, mine.joined_at)
  ) unread
  where mine.user_id = auth.uid()
    and c.project_id is null
    -- A hidden chat comes back as soon as something new is posted in it.
    and (mine.hidden_at is null or coalesce(latest.created_at, c.created_at) > mine.hidden_at)
  order by coalesce(latest.created_at, c.updated_at) desc;
$$;

-- Hides a personal chat from the caller's own list only, and marks it read so
-- a hidden chat never leaves an invisible unread count behind.
create or replace function public.hide_chat_conversation(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.chat_members cm
  set hidden_at = now(),
      last_read_at = greatest(coalesce(cm.last_read_at, cm.joined_at), now())
  from public.chat_conversations c
  where c.id = cm.conversation_id
    and c.project_id is null
    and cm.conversation_id = p_conversation_id
    and cm.user_id = auth.uid();

  if not found then
    raise exception 'Conversation not found or access denied';
  end if;
end;
$$;

revoke all on function public.hide_chat_conversation(uuid) from public, anon;
grant execute on function public.hide_chat_conversation(uuid) to authenticated;

-- Project rooms with unread messages or recent activity, newest first.
-- Events never count as unread; archived projects show only when unread.
create or replace function public.get_project_chat_inbox()
returns table (
  conversation_id uuid,
  project_id uuid,
  project_name text,
  project_status text,
  muted boolean,
  member_count bigint,
  last_message_body text,
  last_message_kind text,
  last_event_type text,
  last_event_data jsonb,
  last_sender_id uuid,
  last_message_at timestamptz,
  unread_count bigint
)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    c.id,
    p.id,
    p.name,
    p.status,
    mine.muted,
    (select count(*) from public.chat_members cm where cm.conversation_id = c.id),
    latest.body,
    latest.kind,
    latest.event_type,
    latest.event_data,
    latest.sender_id,
    latest.created_at,
    unread.unread_count
  from public.chat_members mine
  join public.chat_conversations c on c.id = mine.conversation_id
  join public.projects p on p.id = c.project_id
  join lateral (
    select m.body, m.kind, m.event_type, m.event_data, m.sender_id, m.created_at
    from public.chat_messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) latest on true
  cross join lateral (
    select count(*) as unread_count
    from public.chat_messages m
    where m.conversation_id = c.id
      and m.kind = 'message'
      and m.sender_id <> auth.uid()
      and m.created_at > coalesce(mine.last_read_at, mine.joined_at)
  ) unread
  where mine.user_id = auth.uid()
    and (unread.unread_count > 0 or latest.created_at > now() - interval '14 days')
    and (not coalesce(p.is_archived, false) or unread.unread_count > 0)
  order by latest.created_at desc
  limit 100;
$$;

revoke all on function public.get_project_chat_inbox() from public, anon;
grant execute on function public.get_project_chat_inbox() to authenticated;

-- App-icon badge for push notifications: one query instead of one per room.
-- Only the push Edge Function (service role) may ask about another user.
create or replace function public.chat_unread_count_for(p_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select count(*)
  from public.chat_members cm
  join public.chat_messages m on m.conversation_id = cm.conversation_id
  where cm.user_id = p_user_id
    and not cm.muted
    and m.kind = 'message'
    and m.sender_id <> p_user_id
    and m.created_at > coalesce(cm.last_read_at, cm.joined_at);
$$;

revoke all on function public.chat_unread_count_for(uuid) from public, anon, authenticated;
grant execute on function public.chat_unread_count_for(uuid) to service_role;

-- ---- Personal-chat functions must not touch project rooms --------------

-- Deleting a chat removes it and its messages for everyone, so only managers
-- and admins may do it; everyone else hides chats for themselves instead.
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

  if not public.is_manager() then
    raise exception 'Only managers can delete conversations for everyone';
  end if;

  delete from public.chat_conversations c
  where c.id = p_conversation_id
    and c.project_id is null
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

create or replace function public.create_chat_conversation(
  p_member_ids uuid[],
  p_title text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_user_id uuid := auth.uid();
  v_member_ids uuid[];
  v_conversation_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select coalesce(array_agg(distinct candidate_id), '{}'::uuid[])
  into v_member_ids
  from unnest(coalesce(p_member_ids, '{}'::uuid[])) candidate_id
  join public.profiles p on p.id = candidate_id
  where candidate_id <> v_user_id;

  if cardinality(v_member_ids) = 0 then
    raise exception 'Select at least one participant';
  end if;

  -- Reopen an existing direct chat instead of creating duplicates.
  if cardinality(v_member_ids) = 1 and nullif(trim(p_title), '') is null then
    select c.id
    into v_conversation_id
    from public.chat_conversations c
    where c.title is null
      and c.project_id is null
      and exists (
        select 1 from public.chat_members cm
        where cm.conversation_id = c.id and cm.user_id = v_user_id
      )
      and exists (
        select 1 from public.chat_members cm
        where cm.conversation_id = c.id and cm.user_id = v_member_ids[1]
      )
      and (select count(*) from public.chat_members cm where cm.conversation_id = c.id) = 2
    order by c.updated_at desc
    limit 1;

    if v_conversation_id is not null then
      -- Starting a chat with someone again brings a hidden chat back.
      update public.chat_members
      set hidden_at = null
      where conversation_id = v_conversation_id and user_id = v_user_id;
      return v_conversation_id;
    end if;
  end if;

  insert into public.chat_conversations (title, created_by)
  values (left(nullif(trim(p_title), ''), 120), v_user_id)
  returning id into v_conversation_id;

  insert into public.chat_members (conversation_id, user_id, last_read_at)
  select v_conversation_id, member_id,
    case when member_id = v_user_id then now() else null end
  from unnest(array_prepend(v_user_id, v_member_ids)) member_id;

  return v_conversation_id;
end;
$$;
