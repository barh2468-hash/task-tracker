-- Private one-to-one and group chat for authenticated application users.

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  title text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (title is null or char_length(title) <= 120)
);

create table if not exists public.chat_members (
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists chat_members_user_id_idx
  on public.chat_members(user_id, conversation_id);
create index if not exists chat_messages_conversation_created_idx
  on public.chat_messages(conversation_id, created_at desc);
create index if not exists chat_conversations_updated_idx
  on public.chat_conversations(updated_at desc);

create or replace function public.is_chat_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.chat_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = auth.uid()
  );
$$;

revoke all on function public.is_chat_member(uuid) from public;
revoke all on function public.is_chat_member(uuid) from anon;
grant execute on function public.is_chat_member(uuid) to authenticated;

alter table public.chat_conversations enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "chat conversations read by members" on public.chat_conversations;
drop policy if exists "chat members read conversation" on public.chat_members;
drop policy if exists "chat members update own read state" on public.chat_members;
drop policy if exists "chat messages read by members" on public.chat_messages;
drop policy if exists "chat messages insert by members" on public.chat_messages;

create policy "chat conversations read by members" on public.chat_conversations
for select to authenticated
using (public.is_chat_member(id));

create policy "chat members read conversation" on public.chat_members
for select to authenticated
using (public.is_chat_member(conversation_id));

create policy "chat members update own read state" on public.chat_members
for update to authenticated
using (user_id = auth.uid() and public.is_chat_member(conversation_id))
with check (user_id = auth.uid() and public.is_chat_member(conversation_id));

create policy "chat messages read by members" on public.chat_messages
for select to authenticated
using (public.is_chat_member(conversation_id));

create policy "chat messages insert by members" on public.chat_messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and public.is_chat_member(conversation_id)
);

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

revoke all on function public.create_chat_conversation(uuid[], text) from public;
revoke all on function public.create_chat_conversation(uuid[], text) from anon;
grant execute on function public.create_chat_conversation(uuid[], text) to authenticated;

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
      and m.sender_id <> auth.uid()
      and m.created_at > coalesce(mine.last_read_at, mine.joined_at)
  ) unread
  where mine.user_id = auth.uid()
  order by coalesce(latest.created_at, c.updated_at) desc;
$$;

revoke all on function public.get_chat_conversations() from public;
revoke all on function public.get_chat_conversations() from anon;
grant execute on function public.get_chat_conversations() to authenticated;

create or replace function public.touch_chat_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  update public.chat_conversations
  set updated_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists chat_message_touch_conversation on public.chat_messages;
create trigger chat_message_touch_conversation
after insert on public.chat_messages
for each row execute function public.touch_chat_conversation();

do $$
begin
  begin alter publication supabase_realtime add table public.chat_conversations;
  exception when duplicate_object then null;
  end;
  begin alter publication supabase_realtime add table public.chat_members;
  exception when duplicate_object then null;
  end;
  begin alter publication supabase_realtime add table public.chat_messages;
  exception when duplicate_object then null;
  end;
end $$;
