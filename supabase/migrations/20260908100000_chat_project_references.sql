-- Add an optional project reference to chat messages.

alter table public.chat_messages
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists project_label text;

create index if not exists chat_messages_project_id_idx
  on public.chat_messages(project_id)
  where project_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chat_messages_project_label_length'
      and conrelid = 'public.chat_messages'::regclass
  ) then
    alter table public.chat_messages
      add constraint chat_messages_project_label_length
      check (project_label is null or char_length(project_label) <= 240);
  end if;
end $$;
