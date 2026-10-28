# GPR work orders

`/app/gpr` is available to the existing `admin` role only, including in the
desktop sidebar and the mobile More menu. Database RLS also limits SELECT,
INSERT and UPDATE to administrators. Browser clients cannot delete orders;
use the Cancelled status to retain the order and its email.

## Available now

- Manual work orders and plain-text email import with a separate subject field and review before saving.
- Work names are extracted from the project portion of the subject, before the GPR marker.
  Locations use explicit labels or recognizable city suffixes; unknown locations remain blank for review.
  The original subject and body are saved separately. Pasted Subject / נושא headers are also recognized.
- Existing project list styling, status filters, search, order details and contact links.
- Status and requirement completion are independent.
- The ordered workflow is New, Scheduled for fieldwork, Scanning, In interpretation,
  In clarification, Completed, Cancelled. Existing `scheduled`/`clarification` values
  are retained. The retired `approval` value maps to clarification during migration.
- Original email text remains private to administrators.
- Duplicate detection uses the trimmed, case-insensitive order issuer and number.
  Supply the issuer when different companies reuse the same order number.
- Edits use the persisted timestamp to prevent overwriting concurrent changes.
- Link an existing project, or create a project using editable order details.
  Only title, client, location, scope and contact data are copied. Original email,
  private notes and crew identity-document requirements are not copied to projects.
- Hebrew, English and Greek translations and locale-aware dates/numbers.

The database migration is `supabase/migrations/20261025085300_gpr_work_orders.sql`.
Email subject storage is added by `supabase/migrations/20261025102753_gpr_email_subject.sql`.
The seven-stage workflow is enforced by `supabase/migrations/20261028090519_gpr_workflow_statuses.sql`.
`supabase/tests/gpr_workflow_statuses_test.sql` validates all seven stages and rejects retired/unknown values in a rolled-back transaction.
Run `node --test src/features/gpr/model.test.js` for parsing and translation checks.
`supabase/tests/gpr_work_orders_test.sql` verifies database access and uniqueness
inside a rolled-back transaction. It does not send email or modify existing records.

## Progress workspace

The work list uses project-style cards with an inline checklist, progress meter,
status selector and complete/reopen action. Summary buttons filter open, scheduled,
completed or all work. Completing work changes only its status; it does not mark
unfinished actions as done. Checklist changes can be undone by unchecking an item.

Progress updates send only `requirements` or `status`, scoped by both record ID and
the last `updated_at`. Controls on the affected order are disabled until the write
finishes; displayed checkmarks update only after a successful save. Stale writes
refresh the order and display the existing translated conflict message instead of
overwriting newer changes. Incoming linked mail still preserves manual progress.

Connected Microsoft settings and review mail are collapsed by default. An order's
detail view puts the checklist and email history first. History includes the original
import and up to 20 recent imported/linked records, with the saved original as a
fallback. Live email updates refresh through Realtime/polling; attachment contents
remain in Outlook. No email is marked read or changed in Outlook by these controls.

The DEV-only `/local/gpr?compact=1` preview exercises a narrow container without
database writes. Hebrew, English and Greek and the complete/reopen/undo workflow
were checked visually on 2026-10-28. `supabase/tests/gpr_progress_test.sql` verifies
persistence, optimistic concurrency and admin access in a rolled-back transaction.
All 258 Node tests, targeted lint and the production build passed.

## Direct Microsoft 365 connection

The direct Graph connector, settings panel and server scheduler are implemented.
The app registration and server credentials are configured. Administrator
approval took effect on 2026-10-28; OAuth connection and a live synchronization
succeeded. The saved mailbox is `bar@maya-tm.com`. Intake scans approved
senders across the mailbox without a special folder. Every scan revisits the
last 14 days without duplicating imports. See [Microsoft 365 setup](gpr-microsoft-365.md).

## Alternative receiving-service approach (not connected)

An alternative receiving-service integration could use a dedicated receiving
address and an Outlook forwarding rule restricted to GPR notifications, subject
to the organization's external-forwarding policy. This alternative is not used
by the direct Microsoft Graph connector described above.

Before enabling automatic intake:

1. Agree on the receiving address and trusted original senders, using actual
   forwarded samples to check sender authentication and order identification.
2. Verify receiving-provider webhook signatures over the raw body, then fetch
   email text and attachments through the provider API on the server.
3. Treat the email as untrusted data. Restrict processing to structured extraction;
   never execute emailed commands, follow arbitrary email URLs, or send crew documents.
4. Store provider event/message identifiers under unique constraints. Match updates
   by issuer plus order number (or verified thread), append incoming messages, and
   preserve manual edits. Ambiguous matches must go to administrator review.
5. Keep attachments in private storage with admin-only access, validate file size
   and type, and preserve mail that fails processing for retries and review.
6. Notify only administrators. Do not reuse manager-wide project notifications.

`/local/gpr` is a DEV-only, in-memory visual preview. It includes the sample from
the conversation and never calls the database. It is excluded from production.
