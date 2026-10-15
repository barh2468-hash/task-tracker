-- New projects wait for coordination before field work starts.
-- Existing projects retain their status and progress.
begin;

alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects
  add constraint projects_status_check check (
    status in (
      'ממתין לתיאום',
      'בעבודה בשטח',
      'נדרש GPR',
      'מחכה להיתרים',
      'עבר לשרטוט',
      'נשלח להגהה',
      'עבר לבקרה',
      'הושלם'
    )
  );

alter table public.projects
  alter column status set default 'ממתין לתיאום',
  alter column progress set default 0;

commit;
