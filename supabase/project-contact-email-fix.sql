-- Add an optional clickable field contact email per project.
-- Safe to run more than once and does not change existing project data.

alter table if exists public.projects
add column if not exists contact_email text;

comment on column public.projects.contact_email is
  'Optional field contact email address for the project. Used by the app as a mailto: clickable link.';
