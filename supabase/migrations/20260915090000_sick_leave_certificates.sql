-- Private sick-leave certificates and their link to all-day attendance reports.

create table if not exists public.sick_leave_certificates (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles(id) on delete cascade,
  valid_from date not null,
  valid_to date not null,
  file_path text,
  original_name text,
  mime_type text,
  size_bytes bigint,
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to >= valid_from),
  check (size_bytes is null or (size_bytes >= 0 and size_bytes <= 10485760)),
  check (mime_type is null or mime_type in ('application/pdf', 'image/jpeg', 'image/png'))
);

alter table public.attendance_sessions
  add column if not exists sick_leave_certificate_id uuid
    references public.sick_leave_certificates(id) on delete set null;

create index if not exists sick_leave_certificates_worker_idx
  on public.sick_leave_certificates(worker_id, valid_from desc);
create index if not exists attendance_sessions_sick_certificate_idx
  on public.attendance_sessions(sick_leave_certificate_id)
  where sick_leave_certificate_id is not null;

alter table public.sick_leave_certificates enable row level security;

drop policy if exists "sick certificates read own or managers" on public.sick_leave_certificates;
drop policy if exists "sick certificates insert own or managers" on public.sick_leave_certificates;
drop policy if exists "sick certificates update own or managers" on public.sick_leave_certificates;
drop policy if exists "sick certificates delete own or managers" on public.sick_leave_certificates;

create policy "sick certificates read own or managers" on public.sick_leave_certificates
for select using (worker_id = auth.uid() or public.is_manager());

create policy "sick certificates insert own or managers" on public.sick_leave_certificates
for insert with check (worker_id = auth.uid() or public.is_manager());

create policy "sick certificates update own or managers" on public.sick_leave_certificates
for update using (worker_id = auth.uid() or public.is_manager())
with check (worker_id = auth.uid() or public.is_manager());

create policy "sick certificates delete own or managers" on public.sick_leave_certificates
for delete using (worker_id = auth.uid() or public.is_manager());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sick-leave-certificates',
  'sick-leave-certificates',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "sick certificate files read own or managers" on storage.objects;
drop policy if exists "sick certificate files insert own or managers" on storage.objects;
drop policy if exists "sick certificate files update own or managers" on storage.objects;
drop policy if exists "sick certificate files delete own or managers" on storage.objects;

create policy "sick certificate files read own or managers" on storage.objects
for select using (
  bucket_id = 'sick-leave-certificates'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_manager())
);

create policy "sick certificate files insert own or managers" on storage.objects
for insert with check (
  bucket_id = 'sick-leave-certificates'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_manager())
);

create policy "sick certificate files update own or managers" on storage.objects
for update using (
  bucket_id = 'sick-leave-certificates'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_manager())
) with check (
  bucket_id = 'sick-leave-certificates'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_manager())
);

create policy "sick certificate files delete own or managers" on storage.objects
for delete using (
  bucket_id = 'sick-leave-certificates'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_manager())
);

do $$
begin
  begin
    alter publication supabase_realtime add table public.sick_leave_certificates;
  exception when duplicate_object then null;
  end;
end $$;
