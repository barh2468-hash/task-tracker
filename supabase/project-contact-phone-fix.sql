-- Add optional clickable field contact phone per project.
-- Safe to run more than once.

alter table if exists public.projects
add column if not exists contact_phone text;

comment on column public.projects.contact_phone is 'Optional field contact phone number for the project. Used by the app as a tel: clickable link.';
