-- Translated project names for the non-Hebrew UI languages (en, el, pt).
--
-- Shape: { "<lang>": { "text": "...", "source": "<Hebrew name it was made from>", "manual": bool } }
-- Existing projects were translated once in bulk (manual: false). Such a
-- translation is shown only while `source` still equals the current name, so
-- a renamed project falls back to Hebrew. Manual entries (typed by a manager
-- in the edit form) are always shown.
alter table public.projects
  add column if not exists name_translations jsonb not null default '{}'::jsonb
    check (jsonb_typeof(name_translations) = 'object' and octet_length(name_translations::text) <= 8192);

-- Filling in translations must not count as "editing" the project: the
-- project lists are ordered by updated_at, and a backfill would otherwise
-- reshuffle every project to the top.
create or replace function private.projects_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) - 'name_translations' - 'updated_at')
     is distinct from (to_jsonb(old) - 'name_translations' - 'updated_at') then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at
  before update on public.projects
  for each row execute function private.projects_set_updated_at();
