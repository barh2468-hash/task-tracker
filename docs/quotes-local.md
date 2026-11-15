# Quotation workspace and Microsoft 365

## Active server connection

The signed-in `/app/quotes` route stores records on the server through the authenticated `quotes-microsoft` Edge Function. This private rollout is limited to the verified Bar and Peleg accounts (`bar@maya-tm.com` and `peleg@maya-tm.com`), each with their own workspace. Navigation and direct routes are restricted, and every server action independently checks the server-only `quote_feature_access` table. Other administrators and managers have no access. The independent `/local/quotes` preview is development-only, remains local and never connects to a mailbox.

In **Settings and Peleg’s mailbox**, save the mailbox address and choose `Inbox` or an existing quotation folder. Select **Connect Microsoft 365**, sign in to the exact mailbox account and grant delegated `Mail.ReadWrite`, `Mail.Send` and `User.Read` permissions with offline access. Organizational policy may require an administrator to approve consent. No password is collected by this app.

The OAuth flow shares the existing registered GPR redirect URL, but uses a distinct `q_` state prefix, separate encrypted credentials and separate connection tables. Existing GPR credentials are not changed. The callback bridge forwards only quote-prefixed state requests to the quote handler.

After connection, incoming relevant messages and sent quotation messages are scanned every five minutes. Messages from configured senders or known quotation contacts are queued for human review; other correspondence and drafts are not imported. A matching incoming customer response pauses further reminders. A new quotation email can be used to start a quotation form; the user reviews the customer and quotation number before saving.

Sending is disabled until **Enable automatic follow-ups** is selected and confirmed. Delivery runs Sunday–Thursday between 08:00 and 16:00 in `Asia/Jerusalem`. Default intervals are 14 days then 7 days, with a maximum of three sent messages and a minimum gap of 48 hours. Each delivery has a unique durable job and immutable Microsoft draft ID. An uncertain response is reconciled against the same message before retrying. Unknown or repeatedly failed delivery is escalated for review.

Customers respond by email to Peleg. The email includes response choices that open a reply in the customer’s mail application; the customer must send that reply. The received response pauses reminders and awaits review in the app. There is no unauthenticated HTML response page or promise of one-click automatic status changes in this version.

Old local records can be moved explicitly into an empty server workspace with **Move local records to the server**. Local originals are preserved. The database migration, scheduled worker and backend functions are deployed. The frontend is included in the private main-branch rollout.

## Validation and storage

Run the quote model and translation tests, the quote Microsoft handler tests, and the GPR regression tests. Browser contract tests in outputs/quotes-local cover disconnected and connected mailbox states, OAuth navigation, enabling and stopping automation, synchronization and disconnection in Hebrew, English and Greek, including mobile layouts.

The production build passes. The deployed endpoint rejects anonymous access, server-only tables have RLS and no anon/authenticated grants, and the cron worker returned an empty successful result before any mailbox was connected. No real customer email was sent during testing. Actual mailbox consent and delivery still require Peleg’s sign-in.

The local preview uses browser storage, separately from signed-in server workspaces. Clearing browser storage removes only local records. Local originals are retained after explicit migration. Server workspaces reject stale revisions and use an expiring lease to serialize edits with receiving and delivery. Current capacity is 5,000 quotations and 1,000 reviewed/unreviewed messages per workspace, with a 6 MB state cap.
