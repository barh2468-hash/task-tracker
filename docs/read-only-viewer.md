# Johnny read-only access

The named `Johnny-maya` account uses the existing `demo` database role and its
restrictive RLS policies. It does not receive manager or administrator privileges.
The server-owned Auth app metadata flag `maya_view_all: true`, together with the
exact internal email and a demo profile, enables `viewer-read-api` for this account.
Do not grant this flag through editable user metadata.

Johnny's default UI language is English. Explicit language choices use his own
`maya-language:user:<user-id>` browser preference. Other accounts retain their
existing `maya-language` preference, including on a shared device.

Company vehicles (including related vehicle reports and files), GPR work orders
and the published daily work plan are excluded from Johnny's access. Their
navigation entries and direct routes are blocked, and their tables, nested
relationships and vehicle-document signing are denied by the gateway.

The gateway authenticates with Supabase Auth, verifies the current profile, then
allows GET/HEAD requests to an explicit business-table list. It parses nested
projections, excludes credentials and computed functions, and rejects every RPC,
data mutation and other Edge Function request. Storage permits only signing view
URLs in the business buckets, with expiry at most one hour. Server credentials
stay in the Edge Function environment. Responses use `Cache-Control: no-store`.

The browser renders this account with the `viewer` presentation role, uses the
gateway for reads, hides/disables mutation controls and skips offline writes and
attendance reconciliation. Ordinary staff use their existing client and access.
There are no database schema or global permission changes for this feature.

Deploy `viewer-read-api` before the frontend. Revoking `maya_view_all` or disabling
the account prevents further gateway access. A previously signed file URL can
remain valid until its expiry, as with existing document previews.

Validation: `node --test src/utils/roles.test.js src/services/viewerAccess.test.js
src/features/auth/viewerTranslations.test.js
supabase/functions/viewer-read-api/policy.test.js` and the production build.
The one-time provisioning endpoint is disabled after account creation and always
returns HTTP 410. No password is stored in source files.
