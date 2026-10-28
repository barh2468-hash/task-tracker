# Microsoft 365 GPR intake

This connector uses Microsoft Graph directly. Resend and mail forwarding are not
part of this connection. The server, schema, scheduler, admin settings and tests
are implemented. Mailbox authorization and a live Graph synchronization succeeded
on 2026-10-28 after tenant administrator approval.

## One-time Microsoft setup

An administrator or permitted application developer in the organization's tenant
must register a **single-tenant** application in Microsoft Entra. Use a **Web**
redirect URI (not SPA, not implicit grant):

```
https://qopsdkmzvncamjrxjwni.supabase.co/functions/v1/gpr-microsoft?callback=1
```

Request Microsoft Graph **delegated** `Mail.Read` and `User.Read`, plus
`offline_access` for unattended synchronization. Do not request application-wide
mail permissions, `Mail.Send` or `Mail.ReadWrite`. Tenant policy may require admin
consent even for delegated mail permissions.

Create a client secret through the organization's normal credential management
process. Store its **value**, the tenant ID and client ID as Supabase Edge secrets:

| Secret               | Value                                            |
| -------------------- | ------------------------------------------------ |
| `M365_TENANT_ID`     | Directory (tenant) UUID                          |
| `M365_CLIENT_ID`     | Application (client) UUID                        |
| `M365_CLIENT_SECRET` | Client secret value, not its identifier          |
| `GPR_M365_TOKEN_KEY` | Independent random 32-byte key encoded as base64 |

The token encryption key was generated and installed during initial setup. Do
not rotate it casually: existing encrypted refresh credentials would require a
new Microsoft sign-in. Microsoft tenant/client credentials are now installed in
Supabase Edge secrets. They are not stored in source code or frontend variables.
Never paste a client secret or tokens into chat, Git, frontend variables or UI.
With the CLI, use an ignored file and `supabase secrets set --env-file <file>`;
remove that temporary file after successful configuration. Do not put literal
secrets into command history.

For a production frontend, add its exact HTTPS origin to `GPR_M365_APP_ORIGINS`
(comma separated), or set the existing `APP_URL`. Local development explicitly
allows `http://localhost:5173` and `http://127.0.0.1:5173`. No wildcard redirect or
arbitrary browser-provided return URL is accepted.

## User setup and trial

Initial registration (2026-10-26): `Maya GPR Mail Intake` was registered as a
single-tenant Web application. Client ID: `f1e070ae-df71-42b6-a310-478e7bf82c23`;
tenant ID: `576333b5-8e39-4f58-9244-55e0a224fc9d`. Its configured delegated
permissions are exactly `Mail.Read`, `User.Read` and `offline_access`. The server
credential expires on 2027-04-24. Its value was transferred through an ignored
temporary file into Edge secrets and the temporary file was removed.

Current status (2026-10-28): the user supplied Microsoft's receipt confirming
submission of the administrator approval request on 2026-10-26. After approval,
a fresh OAuth connection for `bar@maya-tm.com` succeeded at 07:41 UTC on
2026-10-28. A live manual synchronization completed successfully, with no stored
error. Database status confirms the connection is enabled and its server cron
job is active every five minutes. The initial connection test imported no work
orders. At the user's request, intake was then changed to scan a **rolling window
of the last 14 days on every round**, including mail received before connection.
Previously imported messages and work orders retain their existing deduplication
and matching behavior. Older work orders remain in the app when their source mail
ages out of the scanning window.

Live verification of the rolling window on 2026-10-28 imported 4 work orders,
linked 6 email updates, held 8 messages for review and ignored 28 unrelated
messages. A repeat scan completed without error, with all those counts unchanged
and no pending page, confirming that revisiting the window created no duplicates.

1. No Outlook folder or rule is required. Intake scans the connected mailbox
   across folders, filtering by the exact approved sender addresses.
2. In `/app/gpr`, enter the mailbox address and senders. The user saved
   `bar@maya-tm.com` and the four approved senders; the connection is now active.
3. The scan window is fixed to the last 14 days. It applies to both existing and
   newly arriving messages from the approved senders, independently of connection time.
4. Save settings, then choose **Sign in with Microsoft**. Sign in as the exact
   configured mailbox. This step grants mailbox-wide delegated read permission;
   the code retrieves bodies only for the configured senders, across the mailbox.
5. Choose **Test sync**. After that, the existing server scheduler runs every
   five minutes even with the browser closed. With incomplete server secrets,
   scheduled calls are deliberate no-ops and cannot access a mailbox.

## Behavior and data handling

- Email subject and original plain text are retained separately. The same parser
  is used by manual import and Graph intake: `supabase/functions/_shared/gpr-model.js`.
- Graph calls use read-only HTTP GET operations. Mail is not sent, moved, deleted
  or marked read by the connector.
- The server checks both the From address and, when present, the actual sender
  against the exact allowlist. `GPR` may appear in either the subject or plain-text
  body; an order number and work description are required for automatic creation.
  Ordinary correspondence creates no work order; only its deduplication metadata
  is retained, without its body. Unclear GPR messages are held for review.
  Draft messages are skipped. An allowlist is a filter,
  not a guarantee that an external sender has not been impersonated. Imported
  work remains in the New state for administrator review; no downstream execution
  or external communication is triggered from email contents.
- Body retrieval occurs only after metadata filtering. HTML, oversized or
  unrecognized messages are held for administrator review rather than executed.
- Known work orders receive appended email updates. Their existing title, notes,
  status, requirements and source email are never overwritten by subsequent mail.
- Matching uses existing conversation mapping or issuer plus order number.
  Ambiguous orders, including a manual order whose issuer is missing, are held
  for review. An administrator can link a pending message to an existing work.
- Provider message identifiers are unique per mailbox. Transactional matching,
  advisory locks and synchronization leases prevent retries creating duplicate work.
- Mailbox-wide scans use `/me/messages`, a sender filter and bounded received-date
  windows. Graph nextLink URLs are pinned to the same mailbox and consumed unchanged.
  A page is checkpointed only after ingestion succeeds. After finishing a scan,
  the next round starts a fresh 14-day window, newest first. Pending pages retain
  their original bounded window and opaque nextLink; an additional local date check
  rejects messages older than the current 14-day cutoff. Immutable message keys
  prevent duplicate imports across repeated scans. Legacy cursors restart within
  the rolling window. The legacy `folder_name`, `folder_id` and `include_existing`
  database columns are unused; `delta_url` stores version 3 mailbox polling state.
  This version does not access an online archive or import older-than-14-day mail.
- Attachments remain in Outlook in this version. Message metadata records their
  presence; linked updates provide a validated Outlook URL.
- Connection configuration and OAuth state are server-only tables with RLS and
  no browser privileges. Refresh tokens and PKCE verifiers use AES-256-GCM with
  an independent key. OAuth state is hashed, expires in ten minutes and is consumed
  once. Callback handling rechecks admin role, config version and mailbox identity.
- Disconnecting deletes the saved refresh credential and pending states, and
  invalidates leases. Existing work and mail history remain. Removing the separate
  Microsoft tenant consent is managed through Microsoft, not by this button.
- User-facing errors are translated codes. Tokens and provider error descriptions
  are never logged, put in browser URLs, or returned to the frontend.
- Manual GPR synchronization has a bounded 90-second frontend request timeout
  so it can finish the server's bounded scan. Other requests retain the normal
  seven-second timeout, cancellation handling and retry rules.
- Each newly imported work order creates one unread in-app notification for the
  connected mailbox's `admin_id` only (currently Bar's account). No manager fan-out,
  Push or outgoing email is requested. Duplicate mail, linked updates, review items
  and manual creation do not notify. Work, email and notification commit atomically;
  a unique recipient/work index provides a second duplicate guard. There is no
  backfill for work imported before this feature. Existing notification RLS limits
  reading and marking as read to the recipient. The bell updates through the existing
  Realtime subscription, with polling as a fallback. Clicking opens `/app/gpr?order=…`.
  Text and action labels follow the selected Hebrew, English or Greek language.

## Deployment and validation

- Migration: `supabase/migrations/20261026102749_gpr_microsoft_365_intake.sql`.
- Mailbox intake migration: `supabase/migrations/20261026111947_gpr_mailbox_intake.sql`.
- Private email notification migration: `supabase/migrations/20261028080958_gpr_email_notifications.sql`.
- Edge Function: `gpr-microsoft`, deployed with gateway JWT verification disabled
  because it has a public OAuth callback. Every POST checks either an admin
  Supabase session or, only for `sync-all`, the existing `CRON_SECRET`.
- The cron job uses the existing Vault secret `maya_cron_secret`. It runs at
  `*/5 * * * *`; it creates no mailbox access until Microsoft consent succeeds.
- Node tests: `node --test supabase/functions/gpr-microsoft/*.test.js`.
- Database test: `supabase/tests/gpr_microsoft_365_test.sql`, in a rolled-back transaction.
- UI has Hebrew, English and Greek resources and a DEV-only in-memory preview.

Real consent, encrypted credential retrieval, token refresh, mailbox listing and
real email-to-work-order ingestion were validated on 2026-10-28, including a
repeat scan with no duplicate imports. The live scan completed on cursor version 3.

Private in-app notifications were deployed and validated on 2026-10-28. A rolled-back
database test covered one notification per new import, no notification for duplicate,
linked, ignored, review or manual records, and recipient-only SELECT/UPDATE access.
All 255 Node tests, targeted lint and the production build passed. Hebrew, English
and Greek notification text/actions and keyboard opening were checked in the DEV
preview (`/local/gpr?notifications=1`); the signed-in notifications page also loaded
with the new relation. Preview data never writes to the database.

References: [Microsoft authorization code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow),
[Graph list messages](https://learn.microsoft.com/en-us/graph/api/user-list-messages?view=graph-rest-1.0),
[Supabase scheduled functions](https://supabase.com/docs/guides/functions/schedule-functions).
